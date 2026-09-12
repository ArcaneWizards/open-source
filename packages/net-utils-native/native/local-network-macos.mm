#include <Network/Network.h>
#include <dispatch/dispatch.h>
#include <node_api.h>

#include <cstdint>
#include <memory>
#include <mutex>
#include <string>
#include <utility>

namespace {

/**
 * A single observation delivered from the browser's dispatch queue back to the
 * JavaScript thread. The JS layer records every event it receives so that the
 * granted/denied rule can be derived (and revised) without changing this file.
 */
struct BrowseEvent {
  std::string type;
  std::string state;
  std::string change;
  std::string name;
  uint32_t total = 0;
  bool hasError = false;
  int32_t errorDomain = 0;
  int32_t errorCode = 0;
};

std::string BrowserStateName(nw_browser_state_t state) {
  switch (state) {
  case nw_browser_state_ready:
    return "ready";
  case nw_browser_state_failed:
    return "failed";
  case nw_browser_state_cancelled:
    return "cancelled";
  case nw_browser_state_waiting:
    return "waiting";
  case nw_browser_state_invalid:
  default:
    return "invalid";
  }
}

void Throw(napi_env env, const std::string &message) {
  napi_throw_error(env, nullptr, message.c_str());
}

napi_value CreateUndefined(napi_env env) {
  napi_value undefined;
  napi_get_undefined(env, &undefined);
  return undefined;
}

void SetString(napi_env env, napi_value object, const char *key,
               const std::string &value) {
  napi_value string;
  napi_create_string_utf8(env, value.c_str(), NAPI_AUTO_LENGTH, &string);
  napi_set_named_property(env, object, key, string);
}

/**
 * Delivers one BrowseEvent to the JavaScript callback.
 */
void EmitEvent(napi_env env, napi_value jsCallback, void *, void *data) {
  std::unique_ptr<BrowseEvent> event(static_cast<BrowseEvent *>(data));

  if (env == nullptr || jsCallback == nullptr) {
    return;
  }

  napi_value object;
  napi_create_object(env, &object);

  SetString(env, object, "type", event->type);

  if (!event->state.empty()) {
    SetString(env, object, "state", event->state);
  }
  if (!event->change.empty()) {
    SetString(env, object, "change", event->change);
  }
  if (!event->name.empty()) {
    SetString(env, object, "name", event->name);
  }

  if (event->type == "result") {
    napi_value total;
    napi_create_uint32(env, event->total, &total);
    napi_set_named_property(env, object, "total", total);
  }

  if (event->hasError) {
    napi_value errorDomain;
    napi_value errorCode;
    napi_create_int32(env, event->errorDomain, &errorDomain);
    napi_create_int32(env, event->errorCode, &errorCode);
    napi_set_named_property(env, object, "errorDomain", errorDomain);
    napi_set_named_property(env, object, "errorCode", errorCode);
  }

  napi_value global;
  napi_get_global(env, &global);
  napi_call_function(env, global, jsCallback, 1, &object, nullptr);
}

/**
 * Shared between the wrapped handle and the Network.framework handler blocks.
 *
 * The blocks are copied and retained by the browser, and may run after the
 * handle has been finalized, so the state is held by shared_ptr and captured by
 * value rather than capturing the handle itself.
 */
struct BrowserState {
  std::mutex mutex;
  napi_threadsafe_function callback = nullptr;
  bool finished = false;
  uint32_t total = 0;

  void Emit(std::unique_ptr<BrowseEvent> event) {
    std::lock_guard<std::mutex> lock(mutex);
    if (callback == nullptr || finished) {
      return;
    }

    BrowseEvent *payload = event.release();
    napi_status status =
        napi_call_threadsafe_function(callback, payload, napi_tsfn_nonblocking);
    if (status != napi_ok) {
      delete payload;
    }
  }

  /**
   * Stops further delivery and hands back the callback so the caller can
   * release it outside of the lock.
   */
  napi_threadsafe_function Finish() {
    std::lock_guard<std::mutex> lock(mutex);
    if (finished) {
      return nullptr;
    }
    finished = true;
    napi_threadsafe_function released = callback;
    callback = nullptr;
    return released;
  }
};

void FinishAndRelease(const std::shared_ptr<BrowserState> &state) {
  napi_threadsafe_function callback = state->Finish();
  if (callback != nullptr) {
    // napi_tsfn_release rather than napi_tsfn_abort, so that the final
    // state event is still delivered to JavaScript.
    napi_release_threadsafe_function(callback, napi_tsfn_release);
  }
}

class NativeBrowser {
public:
  NativeBrowser(nw_browser_t browserRef, dispatch_queue_t queueRef,
                std::shared_ptr<BrowserState> sharedState)
      : browser(browserRef), queue(queueRef), state(std::move(sharedState)) {}

  ~NativeBrowser() { Cancel(); }

  void Cancel() {
    if (browser != nullptr) {
      nw_browser_cancel(browser);
      nw_release(browser);
      browser = nullptr;
    }
    if (queue != nullptr) {
      dispatch_release(queue);
      queue = nullptr;
    }
    FinishAndRelease(state);
  }

private:
  nw_browser_t browser = nullptr;
  dispatch_queue_t queue = nullptr;
  std::shared_ptr<BrowserState> state;
};

void BrowserFinalizer(napi_env, void *data, void *) {
  delete static_cast<NativeBrowser *>(data);
}

napi_value BrowserCancel(napi_env env, napi_callback_info callbackInfo) {
  napi_value self;
  napi_get_cb_info(env, callbackInfo, nullptr, nullptr, &self, nullptr);

  NativeBrowser *browser = nullptr;
  if (napi_unwrap(env, self, reinterpret_cast<void **>(&browser)) != napi_ok ||
      browser == nullptr) {
    Throw(env, "Local network browser handle is invalid.");
    return CreateUndefined(env);
  }

  browser->Cancel();
  return CreateUndefined(env);
}

bool ReadStringArgument(napi_env env, napi_value value, std::string &out) {
  size_t length = 0;
  if (napi_get_value_string_utf8(env, value, nullptr, 0, &length) != napi_ok) {
    return false;
  }

  out.resize(length);
  return napi_get_value_string_utf8(env, value, out.data(), length + 1,
                                    &length) == napi_ok;
}

/**
 * startBrowse(serviceType, domain, callback) -> { cancel() }
 *
 * Starts an NWBrowser for the given Bonjour service type. Browsing is the
 * operation macOS uses to evaluate local network access, so starting it both
 * triggers the permission prompt and surfaces the system's answer through the
 * state handler.
 */
napi_value StartBrowse(napi_env env, napi_callback_info callbackInfo) {
  size_t argc = 3;
  napi_value args[3];
  napi_get_cb_info(env, callbackInfo, &argc, args, nullptr, nullptr);

  if (argc < 3) {
    Throw(env, "startBrowse requires a service type, domain and callback.");
    return CreateUndefined(env);
  }

  std::string serviceType;
  if (!ReadStringArgument(env, args[0], serviceType) || serviceType.empty()) {
    Throw(env, "startBrowse requires a non-empty service type.");
    return CreateUndefined(env);
  }

  napi_valuetype domainType;
  if (napi_typeof(env, args[1], &domainType) != napi_ok) {
    Throw(env, "Unable to inspect domain.");
    return CreateUndefined(env);
  }

  std::string domain;
  bool hasDomain = domainType != napi_undefined && domainType != napi_null;
  if (hasDomain && !ReadStringArgument(env, args[1], domain)) {
    Throw(env, "startBrowse requires the domain to be a string or null.");
    return CreateUndefined(env);
  }

  napi_valuetype callbackType;
  if (napi_typeof(env, args[2], &callbackType) != napi_ok ||
      callbackType != napi_function) {
    Throw(env, "startBrowse requires the callback to be a function.");
    return CreateUndefined(env);
  }

  nw_browse_descriptor_t descriptor =
      nw_browse_descriptor_create_bonjour_service(
          serviceType.c_str(), hasDomain ? domain.c_str() : nullptr);
  if (descriptor == nullptr) {
    Throw(env, "Unable to create a Bonjour browse descriptor.");
    return CreateUndefined(env);
  }

  nw_parameters_t parameters = nw_parameters_create();
  nw_browser_t browser = nw_browser_create(descriptor, parameters);
  nw_release(descriptor);
  if (parameters != nullptr) {
    nw_release(parameters);
  }

  if (browser == nullptr) {
    Throw(env, "Unable to create a local network browser.");
    return CreateUndefined(env);
  }

  napi_value resourceName;
  napi_create_string_utf8(env, "Local network browse callback",
                          NAPI_AUTO_LENGTH, &resourceName);

  napi_threadsafe_function callback = nullptr;
  napi_status status = napi_create_threadsafe_function(
      env, args[2], nullptr, resourceName, 0, 1, nullptr, nullptr, nullptr,
      EmitEvent, &callback);
  if (status != napi_ok) {
    nw_release(browser);
    Throw(env, "Unable to create the local network browse callback.");
    return CreateUndefined(env);
  }

  // The JS layer keeps the event loop alive with its own timeout, so the
  // callback should not hold the process open on its own.
  napi_unref_threadsafe_function(env, callback);

  auto state = std::make_shared<BrowserState>();
  state->callback = callback;

  dispatch_queue_t queue = dispatch_queue_create(
      "com.arcanewizards.net-utils-native.browser", DISPATCH_QUEUE_SERIAL);
  nw_browser_set_queue(browser, queue);

  nw_browser_set_state_changed_handler(
      browser, ^(nw_browser_state_t browserState, nw_error_t error) {
        auto event = std::make_unique<BrowseEvent>();
        event->type = "state";
        event->state = BrowserStateName(browserState);

        if (error != nullptr) {
          event->hasError = true;
          event->errorDomain =
              static_cast<int32_t>(nw_error_get_error_domain(error));
          event->errorCode = nw_error_get_error_code(error);
        }

        state->Emit(std::move(event));

        // Both states are terminal, so stop delivering after reporting them.
        if (browserState == nw_browser_state_cancelled ||
            browserState == nw_browser_state_failed) {
          FinishAndRelease(state);
        }
      });

  nw_browser_set_browse_results_changed_handler(
      browser, ^(nw_browse_result_t oldResult, nw_browse_result_t newResult,
                 bool /* batchComplete */) {
        auto event = std::make_unique<BrowseEvent>();
        event->type = "result";

        nw_browse_result_t current = newResult != nullptr ? newResult
                                                          : oldResult;
        if (current != nullptr) {
          nw_endpoint_t endpoint = nw_browse_result_copy_endpoint(current);
          if (endpoint != nullptr) {
            const char *name = nw_endpoint_get_bonjour_service_name(endpoint);
            if (name != nullptr) {
              event->name = name;
            }
            nw_release(endpoint);
          }
        }

        {
          std::lock_guard<std::mutex> lock(state->mutex);
          if (oldResult == nullptr && newResult != nullptr) {
            event->change = "added";
            state->total += 1;
          } else if (newResult == nullptr && oldResult != nullptr) {
            event->change = "removed";
            if (state->total > 0) {
              state->total -= 1;
            }
          } else {
            event->change = "changed";
          }
          event->total = state->total;
        }

        state->Emit(std::move(event));
      });

  nw_browser_start(browser);

  auto handle = std::make_unique<NativeBrowser>(browser, queue, state);

  napi_value object;
  napi_create_object(env, &object);
  napi_property_descriptor properties[] = {
      {"cancel", nullptr, BrowserCancel, nullptr, nullptr, nullptr,
       napi_default, nullptr},
  };
  napi_define_properties(env, object, 1, properties);
  napi_wrap(env, object, handle.get(), BrowserFinalizer, nullptr, nullptr);
  handle.release();

  return object;
}

napi_value Init(napi_env env, napi_value exports) {
  napi_property_descriptor properties[] = {
      {"startBrowse", nullptr, StartBrowse, nullptr, nullptr, nullptr,
       napi_default, nullptr},
  };

  napi_define_properties(env, exports, 1, properties);
  return exports;
}

} // namespace

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
