#define WIN32_LEAN_AND_MEAN

#include <windows.h>
#include <delayimp.h>
#include <mmsystem.h>
#include <node_api.h>
#include <winrt/Windows.Devices.Enumeration.h>
#include <winrt/Windows.Devices.Midi.h>
#include <winrt/Windows.Foundation.h>
#include <winrt/base.h>

#include <algorithm>
#include <atomic>
#include <cstring>
#include <cstdint>
#include <iterator>
#include <memory>
#include <mutex>
#include <string>
#include <vector>

#pragma comment(lib, "winmm.lib")
#pragma comment(lib, "windowsapp.lib")

FARPROC WINAPI NodeDelayLoadHook(unsigned dliNotify, PDelayLoadInfo pdli) {
  if (dliNotify != dliNotePreLoadLibrary || pdli == nullptr ||
      pdli->szDll == nullptr || _stricmp(pdli->szDll, "node.exe") != 0) {
    return nullptr;
  }

  return reinterpret_cast<FARPROC>(GetModuleHandle(nullptr));
}

ExternC const PfnDliHook __pfnDliNotifyHook2 = NodeDelayLoadHook;

namespace {

using winrt::Windows::Devices::Enumeration::DeviceInformation;
using winrt::Windows::Devices::Enumeration::DeviceInformationUpdate;
using winrt::Windows::Devices::Enumeration::DeviceWatcher;
using winrt::Windows::Devices::Midi::MidiInPort;
using winrt::Windows::Devices::Midi::MidiOutPort;

struct Listener {
  napi_ref callbackRef = nullptr;
  napi_threadsafe_function tsfn = nullptr;
};

struct InputPort {
  napi_env env = nullptr;
  HMIDIIN handle = nullptr;
  UINT portId = 0;
  std::wstring name;
  std::atomic_bool closed = false;
  std::mutex listenersMutex;
  std::vector<Listener> listeners;
};

struct OutputPort {
  napi_env env = nullptr;
  HMIDIOUT handle = nullptr;
  UINT portId = 0;
  std::wstring name;
  std::atomic_bool closed = false;
};

std::once_flag gWinrtInitOnce;
HRESULT gWinrtInitStatus = S_OK;
std::once_flag gDeviceWatcherOnce;
HRESULT gDeviceWatcherStatus = S_OK;
DeviceWatcher gInputDeviceWatcher = nullptr;
DeviceWatcher gOutputDeviceWatcher = nullptr;
winrt::event_token gInputAddedToken = {};
winrt::event_token gInputRemovedToken = {};
winrt::event_token gInputUpdatedToken = {};
winrt::event_token gOutputAddedToken = {};
winrt::event_token gOutputRemovedToken = {};
winrt::event_token gOutputUpdatedToken = {};
std::mutex gDeviceNotificationMutex;
napi_threadsafe_function gDeviceNotificationCallback = nullptr;

napi_value Undefined(napi_env env) {
  napi_value value;
  napi_get_undefined(env, &value);
  return value;
}

void ThrowError(napi_env env, const char* message) {
  napi_throw_error(env, nullptr, message);
}

std::string WideToUtf8(const std::wstring& value) {
  if (value.empty()) {
    return {};
  }

  const int size = WideCharToMultiByte(
    CP_UTF8,
    0,
    value.c_str(),
    static_cast<int>(value.size()),
    nullptr,
    0,
    nullptr,
    nullptr
  );

  std::string result(size, '\0');
  WideCharToMultiByte(
    CP_UTF8,
    0,
    value.c_str(),
    static_cast<int>(value.size()),
    result.data(),
    size,
    nullptr,
    nullptr
  );
  return result;
}

std::string MidiInErrorText(MMRESULT result) {
  wchar_t message[MAXERRORLENGTH] = {};
  if (midiInGetErrorTextW(result, message, MAXERRORLENGTH) == MMSYSERR_NOERROR) {
    return WideToUtf8(message);
  }
  return "WinMM MIDI input error " + std::to_string(result);
}

std::string MidiOutErrorText(MMRESULT result) {
  wchar_t message[MAXERRORLENGTH] = {};
  if (midiOutGetErrorTextW(result, message, MAXERRORLENGTH) == MMSYSERR_NOERROR) {
    return WideToUtf8(message);
  }
  return "WinMM MIDI output error " + std::to_string(result);
}

std::string HResultText(HRESULT result) {
  LPWSTR rawMessage = nullptr;
  const DWORD length = FormatMessageW(
    FORMAT_MESSAGE_ALLOCATE_BUFFER | FORMAT_MESSAGE_FROM_SYSTEM |
      FORMAT_MESSAGE_IGNORE_INSERTS,
    nullptr,
    result,
    MAKELANGID(LANG_NEUTRAL, SUBLANG_DEFAULT),
    reinterpret_cast<LPWSTR>(&rawMessage),
    0,
    nullptr
  );

  if (length == 0 || rawMessage == nullptr) {
    return "HRESULT " + std::to_string(static_cast<long>(result));
  }

  std::wstring message(rawMessage, length);
  LocalFree(rawMessage);
  while (!message.empty() &&
         (message.back() == L'\r' || message.back() == L'\n')) {
    message.pop_back();
  }
  return WideToUtf8(message);
}

void ThrowMidiInError(napi_env env, const char* operation, MMRESULT result) {
  const std::string message =
    std::string(operation) + " failed: " + MidiInErrorText(result);
  napi_throw_error(env, nullptr, message.c_str());
}

void ThrowMidiOutError(napi_env env, const char* operation, MMRESULT result) {
  const std::string message =
    std::string(operation) + " failed: " + MidiOutErrorText(result);
  napi_throw_error(env, nullptr, message.c_str());
}

void ThrowHResultError(napi_env env, const char* operation, HRESULT result) {
  const std::string message =
    std::string(operation) + " failed: " + HResultText(result);
  napi_throw_error(env, nullptr, message.c_str());
}

napi_value CreateUtf16String(napi_env env, const std::wstring& value) {
  napi_value result;
  napi_create_string_utf16(
    env,
    reinterpret_cast<const char16_t*>(value.c_str()),
    value.size(),
    &result
  );
  return result;
}

void SetNamedProperty(napi_env env, napi_value object, const char* name, napi_value value) {
  napi_set_named_property(env, object, name, value);
}

napi_value CreateBoolean(napi_env env, bool value) {
  napi_value result;
  napi_get_boolean(env, value, &result);
  return result;
}

napi_value CreateEndpointInfo(napi_env env, const std::wstring& name, UINT portId) {
  napi_value endpoint;
  napi_create_object(env, &endpoint);

  napi_value jsName = CreateUtf16String(env, name);
  napi_value jsPortId;
  napi_create_uint32(env, portId, &jsPortId);

  SetNamedProperty(env, endpoint, "name", jsName);
  SetNamedProperty(env, endpoint, "portId", jsPortId);

  return endpoint;
}

bool GetEndpointPortId(napi_env env, napi_value value, UINT* portId) {
  napi_value jsPortId;
  napi_status status = napi_get_named_property(env, value, "portId", &jsPortId);
  if (status != napi_ok) {
    ThrowError(env, "MIDI endpoint must include a portId.");
    return false;
  }

  uint32_t parsedPortId = 0;
  status = napi_get_value_uint32(env, jsPortId, &parsedPortId);
  if (status != napi_ok) {
    ThrowError(env, "MIDI endpoint portId must be a number.");
    return false;
  }

  *portId = static_cast<UINT>(parsedPortId);
  return true;
}

std::wstring GetInputName(UINT portId) {
  MIDIINCAPSW caps = {};
  if (midiInGetDevCapsW(portId, &caps, sizeof(caps)) != MMSYSERR_NOERROR) {
    return L"Unknown MIDI Input";
  }
  return caps.szPname;
}

std::wstring GetOutputName(UINT portId) {
  MIDIOUTCAPSW caps = {};
  if (midiOutGetDevCapsW(portId, &caps, sizeof(caps)) != MMSYSERR_NOERROR) {
    return L"Unknown MIDI Output";
  }
  return caps.szPname;
}

void MessageThreadsafeCallback(
  napi_env env,
  napi_value jsCallback,
  void*,
  void* data
) {
  std::unique_ptr<std::vector<uint8_t>> message(
    static_cast<std::vector<uint8_t>*>(data)
  );

  if (env == nullptr || jsCallback == nullptr) {
    return;
  }

  napi_value jsMessage;
  napi_create_array_with_length(env, message->size(), &jsMessage);
  for (size_t index = 0; index < message->size(); index += 1) {
    napi_value byte;
    napi_create_uint32(env, message->at(index), &byte);
    napi_set_element(env, jsMessage, static_cast<uint32_t>(index), byte);
  }

  napi_value global;
  napi_get_global(env, &global);
  napi_value argv[] = { jsMessage };
  napi_call_function(env, global, jsCallback, 1, argv, nullptr);
}

std::vector<uint8_t> ShortMessageFromWinMM(DWORD_PTR payload) {
  const DWORD message = static_cast<DWORD>(payload);
  const uint8_t status = static_cast<uint8_t>(message & 0xff);
  const uint8_t first = static_cast<uint8_t>((message >> 8) & 0xff);
  const uint8_t second = static_cast<uint8_t>((message >> 16) & 0xff);

  if (status >= 0xc0 && status <= 0xdf) {
    return { status, first };
  }

  if (status == 0xf1 || status == 0xf3) {
    return { status, first };
  }

  if (status == 0xf2) {
    return { status, first, second };
  }

  if (status >= 0xf4) {
    return { status };
  }

  return { status, first, second };
}

void DeviceNotificationCallback(
  napi_env env,
  napi_value jsCallback,
  void*,
  void* data
) {
  std::unique_ptr<int32_t> messageId(static_cast<int32_t*>(data));

  if (env == nullptr || jsCallback == nullptr) {
    return;
  }

  napi_value jsMessageId;
  napi_create_int32(env, *messageId, &jsMessageId);

  napi_value global;
  napi_get_global(env, &global);
  napi_value argv[] = { jsMessageId };
  napi_call_function(env, global, jsCallback, 1, argv, nullptr);
}

void NotifyDeviceChange(int32_t messageId) {
  std::lock_guard<std::mutex> lock(gDeviceNotificationMutex);
  if (gDeviceNotificationCallback == nullptr) {
    return;
  }

  auto* payload = new int32_t(messageId);
  const napi_status status = napi_call_threadsafe_function(
    gDeviceNotificationCallback,
    payload,
    napi_tsfn_nonblocking
  );
  if (status != napi_ok) {
    delete payload;
  }
}

HRESULT EnsureWinRTInitialized() {
  std::call_once(gWinrtInitOnce, []() {
    try {
      winrt::init_apartment(winrt::apartment_type::multi_threaded);
    } catch (const winrt::hresult_error& error) {
      const HRESULT code = static_cast<HRESULT>(error.code());
      gWinrtInitStatus = code == RPC_E_CHANGED_MODE ? S_OK : code;
    }
  });

  return gWinrtInitStatus;
}

HRESULT StartDeviceWatchers() {
  HRESULT initStatus = EnsureWinRTInitialized();
  if (FAILED(initStatus)) {
    return initStatus;
  }

  std::call_once(gDeviceWatcherOnce, []() {
    try {
      gInputDeviceWatcher =
        DeviceInformation::CreateWatcher(MidiInPort::GetDeviceSelector());
      gOutputDeviceWatcher =
        DeviceInformation::CreateWatcher(MidiOutPort::GetDeviceSelector());

      gInputAddedToken = gInputDeviceWatcher.Added(
        [](const DeviceWatcher&, const DeviceInformation&) {
          NotifyDeviceChange(1);
        }
      );
      gInputRemovedToken = gInputDeviceWatcher.Removed(
        [](const DeviceWatcher&, const DeviceInformationUpdate&) {
          NotifyDeviceChange(2);
        }
      );
      gInputUpdatedToken = gInputDeviceWatcher.Updated(
        [](const DeviceWatcher&, const DeviceInformationUpdate&) {
          NotifyDeviceChange(3);
        }
      );
      gOutputAddedToken = gOutputDeviceWatcher.Added(
        [](const DeviceWatcher&, const DeviceInformation&) {
          NotifyDeviceChange(4);
        }
      );
      gOutputRemovedToken = gOutputDeviceWatcher.Removed(
        [](const DeviceWatcher&, const DeviceInformationUpdate&) {
          NotifyDeviceChange(5);
        }
      );
      gOutputUpdatedToken = gOutputDeviceWatcher.Updated(
        [](const DeviceWatcher&, const DeviceInformationUpdate&) {
          NotifyDeviceChange(6);
        }
      );

      gInputDeviceWatcher.Start();
      gOutputDeviceWatcher.Start();
      gDeviceWatcherStatus = S_OK;
    } catch (const winrt::hresult_error& error) {
      gDeviceWatcherStatus = static_cast<HRESULT>(error.code());
    } catch (...) {
      gDeviceWatcherStatus = E_FAIL;
    }
  });

  return gDeviceWatcherStatus;
}

void CALLBACK MidiInCallback(
  HMIDIIN,
  UINT message,
  DWORD_PTR instance,
  DWORD_PTR param1,
  DWORD_PTR
) {
  auto* port = reinterpret_cast<InputPort*>(instance);
  if (port == nullptr || port->closed.load()) {
    return;
  }

  std::vector<uint8_t> midiMessage;
  if (message == MIM_DATA) {
    midiMessage = ShortMessageFromWinMM(param1);
  } else {
    return;
  }

  std::lock_guard<std::mutex> lock(port->listenersMutex);
  for (const Listener& listener : port->listeners) {
    auto* queuedMessage = new std::vector<uint8_t>(midiMessage);
    const napi_status status = napi_call_threadsafe_function(
      listener.tsfn,
      queuedMessage,
      napi_tsfn_nonblocking
    );
    if (status != napi_ok) {
      delete queuedMessage;
    }
  }
}

void ReleaseListeners(InputPort* port) {
  std::vector<Listener> listeners;
  {
    std::lock_guard<std::mutex> lock(port->listenersMutex);
    listeners.swap(port->listeners);
  }

  for (const Listener& listener : listeners) {
    if (listener.tsfn != nullptr) {
      napi_release_threadsafe_function(listener.tsfn, napi_tsfn_abort);
    }
    if (listener.callbackRef != nullptr) {
      napi_delete_reference(port->env, listener.callbackRef);
    }
  }
}

void CloseInputPort(InputPort* port) {
  if (port == nullptr || port->closed.exchange(true)) {
    return;
  }

  if (port->handle != nullptr) {
    midiInStop(port->handle);
    midiInReset(port->handle);
    midiInClose(port->handle);
    port->handle = nullptr;
  }

  ReleaseListeners(port);
}

void CloseOutputPort(OutputPort* port) {
  if (port == nullptr || port->closed.exchange(true)) {
    return;
  }

  if (port->handle != nullptr) {
    midiOutReset(port->handle);
    midiOutClose(port->handle);
    port->handle = nullptr;
  }
}

InputPort* GetInputPort(napi_env env, napi_callback_info info) {
  size_t argc = 0;
  napi_value thisArg;
  napi_get_cb_info(env, info, &argc, nullptr, &thisArg, nullptr);

  InputPort* port = nullptr;
  napi_unwrap(env, thisArg, reinterpret_cast<void**>(&port));
  if (port == nullptr || port->closed.load()) {
    ThrowError(env, "MIDI input is closed.");
    return nullptr;
  }
  return port;
}

OutputPort* GetOutputPort(napi_env env, napi_callback_info info) {
  size_t argc = 0;
  napi_value thisArg;
  napi_get_cb_info(env, info, &argc, nullptr, &thisArg, nullptr);

  OutputPort* port = nullptr;
  napi_unwrap(env, thisArg, reinterpret_cast<void**>(&port));
  if (port == nullptr || port->closed.load()) {
    ThrowError(env, "MIDI output is closed.");
    return nullptr;
  }
  return port;
}

napi_value InputGetInfo(napi_env env, napi_callback_info info) {
  InputPort* port = GetInputPort(env, info);
  if (port == nullptr) {
    return nullptr;
  }
  return CreateEndpointInfo(env, port->name, port->portId);
}

napi_value InputAddMessageListener(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value args[1];
  napi_value thisArg;
  napi_get_cb_info(env, info, &argc, args, &thisArg, nullptr);

  InputPort* port = nullptr;
  napi_unwrap(env, thisArg, reinterpret_cast<void**>(&port));
  if (port == nullptr || port->closed.load()) {
    ThrowError(env, "MIDI input is closed.");
    return nullptr;
  }

  if (argc < 1) {
    ThrowError(env, "addMessageListener requires a listener function.");
    return nullptr;
  }

  napi_valuetype type;
  napi_typeof(env, args[0], &type);
  if (type != napi_function) {
    ThrowError(env, "MIDI message listener must be a function.");
    return nullptr;
  }

  napi_ref callbackRef;
  napi_create_reference(env, args[0], 1, &callbackRef);

  napi_value resourceName;
  napi_create_string_utf8(env, "MIDI input listener", NAPI_AUTO_LENGTH, &resourceName);

  napi_threadsafe_function tsfn;
  napi_status status = napi_create_threadsafe_function(
    env,
    args[0],
    nullptr,
    resourceName,
    0,
    1,
    nullptr,
    nullptr,
    nullptr,
    MessageThreadsafeCallback,
    &tsfn
  );

  if (status != napi_ok) {
    napi_delete_reference(env, callbackRef);
    ThrowError(env, "Unable to create MIDI listener.");
    return nullptr;
  }

  {
    std::lock_guard<std::mutex> lock(port->listenersMutex);
    port->listeners.push_back({ callbackRef, tsfn });
  }

  return Undefined(env);
}

napi_value InputRemoveMessageListener(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value args[1];
  napi_value thisArg;
  napi_get_cb_info(env, info, &argc, args, &thisArg, nullptr);

  InputPort* port = nullptr;
  napi_unwrap(env, thisArg, reinterpret_cast<void**>(&port));
  if (port == nullptr || port->closed.load()) {
    ThrowError(env, "MIDI input is closed.");
    return nullptr;
  }

  if (argc < 1) {
    ThrowError(env, "removeMessageListener requires a listener function.");
    return nullptr;
  }

  std::lock_guard<std::mutex> lock(port->listenersMutex);
  const auto found = std::find_if(
    port->listeners.begin(),
    port->listeners.end(),
    [&](const Listener& listener) {
      napi_value callback;
      napi_get_reference_value(env, listener.callbackRef, &callback);

      bool equal = false;
      napi_strict_equals(env, callback, args[0], &equal);
      return equal;
    }
  );

  if (found != port->listeners.end()) {
    napi_release_threadsafe_function(found->tsfn, napi_tsfn_abort);
    napi_delete_reference(env, found->callbackRef);
    port->listeners.erase(found);
  }

  return Undefined(env);
}

napi_value InputClose(napi_env env, napi_callback_info info) {
  size_t argc = 0;
  napi_value thisArg;
  napi_get_cb_info(env, info, &argc, nullptr, &thisArg, nullptr);

  InputPort* port = nullptr;
  napi_unwrap(env, thisArg, reinterpret_cast<void**>(&port));
  CloseInputPort(port);
  return Undefined(env);
}

void InputFinalizer(napi_env, void* data, void*) {
  auto* port = static_cast<InputPort*>(data);
  CloseInputPort(port);
  delete port;
}

napi_value OutputGetInfo(napi_env env, napi_callback_info info) {
  OutputPort* port = GetOutputPort(env, info);
  if (port == nullptr) {
    return nullptr;
  }
  return CreateEndpointInfo(env, port->name, port->portId);
}

bool ReadMessageArray(napi_env env, napi_value value, std::vector<uint8_t>* message) {
  bool isArray = false;
  napi_is_array(env, value, &isArray);
  if (!isArray) {
    ThrowError(env, "MIDI message must be an array of bytes.");
    return false;
  }

  uint32_t length = 0;
  napi_get_array_length(env, value, &length);
  if (length == 0) {
    ThrowError(env, "MIDI message cannot be empty.");
    return false;
  }

  message->reserve(length);
  for (uint32_t index = 0; index < length; index += 1) {
    napi_value jsByte;
    napi_get_element(env, value, index, &jsByte);

    uint32_t byte = 0;
    if (napi_get_value_uint32(env, jsByte, &byte) != napi_ok || byte > 0xff) {
      ThrowError(env, "MIDI message bytes must be numbers between 0 and 255.");
      return false;
    }

    message->push_back(static_cast<uint8_t>(byte));
  }

  return true;
}

napi_value OutputSendMessage(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value args[1];
  napi_value thisArg;
  napi_get_cb_info(env, info, &argc, args, &thisArg, nullptr);

  OutputPort* port = nullptr;
  napi_unwrap(env, thisArg, reinterpret_cast<void**>(&port));
  if (port == nullptr || port->closed.load()) {
    ThrowError(env, "MIDI output is closed.");
    return nullptr;
  }

  if (argc < 1) {
    ThrowError(env, "sendMessage requires a MIDI message.");
    return nullptr;
  }

  std::vector<uint8_t> message;
  if (!ReadMessageArray(env, args[0], &message)) {
    return nullptr;
  }

  if (message.size() <= 3 && message[0] != 0xf0) {
    DWORD packedMessage = message[0];
    if (message.size() > 1) {
      packedMessage |= static_cast<DWORD>(message[1]) << 8;
    }
    if (message.size() > 2) {
      packedMessage |= static_cast<DWORD>(message[2]) << 16;
    }

    const MMRESULT result = midiOutShortMsg(port->handle, packedMessage);
    if (result != MMSYSERR_NOERROR) {
      ThrowMidiOutError(env, "midiOutShortMsg", result);
      return nullptr;
    }
    return Undefined(env);
  }

  if (message.front() != 0xf0 || message.back() != 0xf7) {
    ThrowError(env, "Long MIDI messages must be complete SysEx messages.");
    return nullptr;
  }

  MIDIHDR header = {};
  header.lpData = reinterpret_cast<LPSTR>(message.data());
  header.dwBufferLength = static_cast<DWORD>(message.size());

  MMRESULT result = midiOutPrepareHeader(port->handle, &header, sizeof(header));
  if (result != MMSYSERR_NOERROR) {
    ThrowMidiOutError(env, "midiOutPrepareHeader", result);
    return nullptr;
  }

  result = midiOutLongMsg(port->handle, &header, sizeof(header));
  if (result != MMSYSERR_NOERROR) {
    midiOutUnprepareHeader(port->handle, &header, sizeof(header));
    ThrowMidiOutError(env, "midiOutLongMsg", result);
    return nullptr;
  }

  const DWORD start = GetTickCount();
  while ((header.dwFlags & MHDR_DONE) == 0) {
    if (GetTickCount() - start > 5000) {
      midiOutReset(port->handle);
      midiOutUnprepareHeader(port->handle, &header, sizeof(header));
      ThrowError(env, "Timed out while sending SysEx MIDI message.");
      return nullptr;
    }
    Sleep(1);
  }

  midiOutUnprepareHeader(port->handle, &header, sizeof(header));
  return Undefined(env);
}

napi_value OutputClose(napi_env env, napi_callback_info info) {
  size_t argc = 0;
  napi_value thisArg;
  napi_get_cb_info(env, info, &argc, nullptr, &thisArg, nullptr);

  OutputPort* port = nullptr;
  napi_unwrap(env, thisArg, reinterpret_cast<void**>(&port));
  CloseOutputPort(port);
  return Undefined(env);
}

void OutputFinalizer(napi_env, void* data, void*) {
  auto* port = static_cast<OutputPort*>(data);
  CloseOutputPort(port);
  delete port;
}

napi_value GetSupportInfo(napi_env env, napi_callback_info) {
  napi_value result;
  napi_create_object(env, &result);
  SetNamedProperty(env, result, "supported", CreateBoolean(env, true));

  napi_value notificationsInfo;
  napi_create_object(env, &notificationsInfo);
  SetNamedProperty(env, notificationsInfo, "supported", CreateBoolean(env, true));
  SetNamedProperty(env, result, "notifications", notificationsInfo);

  napi_value virtualInfo;
  napi_create_object(env, &virtualInfo);
  SetNamedProperty(env, virtualInfo, "supported", CreateBoolean(env, false));

  napi_value reason;
  napi_create_string_utf8(
    env,
    "Virtual MIDI ports are not supported by this Windows WinMM backend.",
    NAPI_AUTO_LENGTH,
    &reason
  );
  SetNamedProperty(env, virtualInfo, "reason", reason);
  SetNamedProperty(env, result, "virtual", virtualInfo);

  return result;
}

napi_value SetNotificationCallback(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value args[1];
  napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);

  napi_value callback = argc > 0 ? args[0] : Undefined(env);
  napi_valuetype type;
  if (napi_typeof(env, callback, &type) != napi_ok) {
    ThrowError(env, "Unable to inspect device change callback.");
    return nullptr;
  }

  napi_threadsafe_function oldCallback = nullptr;
  {
    std::lock_guard<std::mutex> lock(gDeviceNotificationMutex);
    oldCallback = gDeviceNotificationCallback;
    gDeviceNotificationCallback = nullptr;
  }

  if (oldCallback != nullptr) {
    napi_release_threadsafe_function(oldCallback, napi_tsfn_abort);
  }

  if (type == napi_undefined || type == napi_null) {
    return Undefined(env);
  }

  if (type != napi_function) {
    ThrowError(env, "Expected device change callback to be a function or null.");
    return nullptr;
  }

  const HRESULT watcherStatus = StartDeviceWatchers();
  if (FAILED(watcherStatus)) {
    ThrowHResultError(env, "DeviceInformation::CreateWatcher", watcherStatus);
    return nullptr;
  }

  napi_value resourceName;
  napi_create_string_utf8(
    env,
    "WinRT MIDI device notification callback",
    NAPI_AUTO_LENGTH,
    &resourceName
  );

  napi_threadsafe_function newCallback = nullptr;
  const napi_status status = napi_create_threadsafe_function(
    env,
    callback,
    nullptr,
    resourceName,
    0,
    1,
    nullptr,
    nullptr,
    nullptr,
    DeviceNotificationCallback,
    &newCallback
  );

  if (status != napi_ok) {
    ThrowError(env, "Unable to create MIDI device change callback.");
    return nullptr;
  }
  napi_unref_threadsafe_function(env, newCallback);

  {
    std::lock_guard<std::mutex> lock(gDeviceNotificationMutex);
    gDeviceNotificationCallback = newCallback;
  }

  return Undefined(env);
}

napi_value GetInputs(napi_env env, napi_callback_info) {
  const UINT count = midiInGetNumDevs();

  napi_value endpoints;
  napi_create_array_with_length(env, count, &endpoints);

  for (UINT portId = 0; portId < count; portId += 1) {
    napi_set_element(env, endpoints, portId, CreateEndpointInfo(env, GetInputName(portId), portId));
  }

  return endpoints;
}

napi_value GetOutputs(napi_env env, napi_callback_info) {
  const UINT count = midiOutGetNumDevs();

  napi_value endpoints;
  napi_create_array_with_length(env, count, &endpoints);

  for (UINT portId = 0; portId < count; portId += 1) {
    napi_set_element(env, endpoints, portId, CreateEndpointInfo(env, GetOutputName(portId), portId));
  }

  return endpoints;
}

napi_value OpenInput(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value args[1];
  napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);

  if (argc < 1) {
    ThrowError(env, "openInput requires a MIDI endpoint.");
    return nullptr;
  }

  UINT portId = 0;
  if (!GetEndpointPortId(env, args[0], &portId)) {
    return nullptr;
  }

  const UINT count = midiInGetNumDevs();
  if (portId >= count) {
    ThrowError(env, "MIDI input portId is out of range.");
    return nullptr;
  }

  auto* port = new InputPort();
  port->env = env;
  port->portId = portId;
  port->name = GetInputName(portId);

  MMRESULT result = midiInOpen(
    &port->handle,
    portId,
    reinterpret_cast<DWORD_PTR>(MidiInCallback),
    reinterpret_cast<DWORD_PTR>(port),
    CALLBACK_FUNCTION
  );
  if (result != MMSYSERR_NOERROR) {
    delete port;
    ThrowMidiInError(env, "midiInOpen", result);
    return nullptr;
  }

  result = midiInStart(port->handle);
  if (result != MMSYSERR_NOERROR) {
    midiInClose(port->handle);
    delete port;
    ThrowMidiInError(env, "midiInStart", result);
    return nullptr;
  }

  napi_value object;
  napi_create_object(env, &object);

  napi_property_descriptor properties[] = {
    { "getInfo", nullptr, InputGetInfo, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "addMessageListener", nullptr, InputAddMessageListener, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "removeMessageListener", nullptr, InputRemoveMessageListener, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "close", nullptr, InputClose, nullptr, nullptr, nullptr, napi_default, nullptr },
  };
  napi_define_properties(env, object, std::size(properties), properties);
  napi_wrap(env, object, port, InputFinalizer, nullptr, nullptr);

  return object;
}

napi_value OpenOutput(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value args[1];
  napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);

  if (argc < 1) {
    ThrowError(env, "openOutput requires a MIDI endpoint.");
    return nullptr;
  }

  UINT portId = 0;
  if (!GetEndpointPortId(env, args[0], &portId)) {
    return nullptr;
  }

  const UINT count = midiOutGetNumDevs();
  if (portId >= count) {
    ThrowError(env, "MIDI output portId is out of range.");
    return nullptr;
  }

  auto* port = new OutputPort();
  port->env = env;
  port->portId = portId;
  port->name = GetOutputName(portId);

  const MMRESULT result = midiOutOpen(&port->handle, portId, 0, 0, CALLBACK_NULL);
  if (result != MMSYSERR_NOERROR) {
    delete port;
    ThrowMidiOutError(env, "midiOutOpen", result);
    return nullptr;
  }

  napi_value object;
  napi_create_object(env, &object);

  napi_property_descriptor properties[] = {
    { "getInfo", nullptr, OutputGetInfo, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "sendMessage", nullptr, OutputSendMessage, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "close", nullptr, OutputClose, nullptr, nullptr, nullptr, napi_default, nullptr },
  };
  napi_define_properties(env, object, std::size(properties), properties);
  napi_wrap(env, object, port, OutputFinalizer, nullptr, nullptr);

  return object;
}

napi_value CreateVirtualPort(napi_env env, napi_callback_info) {
  ThrowError(env, "Virtual MIDI ports are not supported on Windows.");
  return nullptr;
}

} // namespace

NAPI_MODULE_INIT() {
  napi_property_descriptor properties[] = {
    { "getSupportInfo", nullptr, GetSupportInfo, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "getInputs", nullptr, GetInputs, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "getOutputs", nullptr, GetOutputs, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "setNotificationCallback", nullptr, SetNotificationCallback, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "openInput", nullptr, OpenInput, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "openOutput", nullptr, OpenOutput, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "createVirtualInput", nullptr, CreateVirtualPort, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "createVirtualOutput", nullptr, CreateVirtualPort, nullptr, nullptr, nullptr, napi_default, nullptr },
  };

  napi_define_properties(env, exports, std::size(properties), properties);
  return exports;
}
