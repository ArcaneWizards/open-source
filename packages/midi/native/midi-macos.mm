#include <CoreFoundation/CoreFoundation.h>
#include <CoreMIDI/CoreMIDI.h>
#include <node_api.h>

#include <cstdlib>
#include <cstdint>
#include <memory>
#include <mutex>
#include <string>
#include <vector>

namespace {

MIDIClientRef gClient = 0;
std::mutex gClientMutex;

struct EndpointInfo {
  std::string name;
  MIDIEndpointRef endpoint;
};

std::string OSStatusMessage(const char *action, OSStatus status) {
  return std::string(action) + " failed with Core MIDI status " +
         std::to_string(status) + ".";
}

void Throw(napi_env env, const std::string &message) {
  napi_throw_error(env, nullptr, message.c_str());
}

bool ThrowIfFailed(napi_env env, const char *action, OSStatus status) {
  if (status == noErr) {
    return false;
  }
  Throw(env, OSStatusMessage(action, status));
  return true;
}

OSStatus EnsureClientStatus() {
  std::lock_guard<std::mutex> lock(gClientMutex);
  if (gClient != 0) {
    return noErr;
  }

  return MIDIClientCreate(CFSTR("Arcane Wizards MIDI"), nullptr, nullptr,
                          &gClient);
}

bool EnsureClient(napi_env env) {
  OSStatus status = EnsureClientStatus();
  return !ThrowIfFailed(env, "MIDIClientCreate", status);
}

std::string CFStringToString(CFStringRef value) {
  if (value == nullptr) {
    return "";
  }

  CFIndex length = CFStringGetLength(value);
  CFIndex maxSize =
      CFStringGetMaximumSizeForEncoding(length, kCFStringEncodingUTF8) + 1;
  std::vector<char> buffer(static_cast<size_t>(maxSize));
  if (!CFStringGetCString(value, buffer.data(), maxSize,
                          kCFStringEncodingUTF8)) {
    return "";
  }
  return std::string(buffer.data());
}

std::string GetEndpointName(MIDIEndpointRef endpoint, const char *fallback) {
  CFStringRef value = nullptr;
  OSStatus status =
      MIDIObjectGetStringProperty(endpoint, kMIDIPropertyDisplayName, &value);
  if (status != noErr || value == nullptr) {
    status = MIDIObjectGetStringProperty(endpoint, kMIDIPropertyName, &value);
  }

  std::string name = value != nullptr ? CFStringToString(value) : "";
  if (value != nullptr) {
    CFRelease(value);
  }

  if (name.empty()) {
    return fallback;
  }
  return name;
}

CFStringRef CreateCFString(const std::string &value) {
  return CFStringCreateWithCString(kCFAllocatorDefault, value.c_str(),
                                   kCFStringEncodingUTF8);
}

bool GetStringArgument(napi_env env, napi_value value, std::string *result) {
  size_t length = 0;
  if (napi_get_value_string_utf8(env, value, nullptr, 0, &length) != napi_ok) {
    Throw(env, "Expected a string.");
    return false;
  }

  std::vector<char> buffer(length + 1);
  if (napi_get_value_string_utf8(env, value, buffer.data(), buffer.size(),
                                 &length) != napi_ok) {
    Throw(env, "Unable to read string value.");
    return false;
  }

  *result = std::string(buffer.data(), length);
  return true;
}

bool GetObjectStringProperty(napi_env env, napi_value object,
                             const char *propertyName, std::string *result) {
  bool hasProperty = false;
  if (napi_has_named_property(env, object, propertyName, &hasProperty) !=
          napi_ok ||
      !hasProperty) {
    return true;
  }

  napi_value property;
  if (napi_get_named_property(env, object, propertyName, &property) != napi_ok) {
    Throw(env, "Unable to read options property.");
    return false;
  }

  napi_valuetype type;
  if (napi_typeof(env, property, &type) != napi_ok) {
    Throw(env, "Unable to inspect options property.");
    return false;
  }

  if (type == napi_undefined || type == napi_null) {
    return true;
  }

  if (type != napi_string) {
    Throw(env, std::string("Expected options.") + propertyName +
                   " to be a string.");
    return false;
  }

  return GetStringArgument(env, property, result);
}

bool ReadVirtualOptions(napi_env env, napi_value value,
                        std::string *manufacturer, std::string *model) {
  napi_valuetype type;
  if (napi_typeof(env, value, &type) != napi_ok) {
    Throw(env, "Unable to inspect virtual port options.");
    return false;
  }

  if (type == napi_undefined || type == napi_null) {
    return true;
  }

  if (type != napi_object) {
    Throw(env, "Expected virtual port options to be an object.");
    return false;
  }

  return GetObjectStringProperty(env, value, "manufacturer", manufacturer) &&
         GetObjectStringProperty(env, value, "model", model);
}

void ApplyVirtualOptions(MIDIEndpointRef endpoint,
                         const std::string &manufacturer,
                         const std::string &model) {
  if (!manufacturer.empty()) {
    CFStringRef value = CreateCFString(manufacturer);
    if (value != nullptr) {
      MIDIObjectSetStringProperty(endpoint, kMIDIPropertyManufacturer, value);
      CFRelease(value);
    }
  }

  if (!model.empty()) {
    CFStringRef value = CreateCFString(model);
    if (value != nullptr) {
      MIDIObjectSetStringProperty(endpoint, kMIDIPropertyModel, value);
      CFRelease(value);
    }
  }
}

napi_value CreateUndefined(napi_env env) {
  napi_value value;
  napi_get_undefined(env, &value);
  return value;
}

napi_value CreateEndpointInfoObject(napi_env env, const EndpointInfo &info) {
  napi_value object;
  napi_create_object(env, &object);

  napi_value name;
  napi_create_string_utf8(env, info.name.c_str(), NAPI_AUTO_LENGTH, &name);
  napi_set_named_property(env, object, "name", name);

  napi_value portId;
  napi_create_uint32(env, static_cast<uint32_t>(info.endpoint), &portId);
  napi_set_named_property(env, object, "portId", portId);

  return object;
}

bool ReadEndpointInfo(napi_env env, napi_value value, EndpointInfo *info) {
  napi_valuetype type;
  if (napi_typeof(env, value, &type) != napi_ok || type != napi_object) {
    Throw(env, "Expected a MIDI endpoint object.");
    return false;
  }

  napi_value portIdValue;
  if (napi_get_named_property(env, value, "portId", &portIdValue) != napi_ok) {
    Throw(env, "MIDI endpoint is missing portId.");
    return false;
  }

  uint32_t portId = 0;
  if (napi_get_value_uint32(env, portIdValue, &portId) != napi_ok ||
      portId == 0) {
    Throw(env, "MIDI endpoint portId must be a positive number.");
    return false;
  }

  std::string name;
  napi_value nameValue;
  if (napi_get_named_property(env, value, "name", &nameValue) == napi_ok) {
    napi_valuetype nameType;
    if (napi_typeof(env, nameValue, &nameType) == napi_ok &&
        nameType == napi_string) {
      if (!GetStringArgument(env, nameValue, &name)) {
        return false;
      }
    }
  }

  info->endpoint = static_cast<MIDIEndpointRef>(portId);
  info->name = name.empty() ? GetEndpointName(info->endpoint, "MIDI Endpoint")
                            : name;
  return true;
}

bool ReadMessage(napi_env env, napi_value value,
                 std::vector<uint8_t> *message) {
  bool isArray = false;
  if (napi_is_array(env, value, &isArray) != napi_ok || !isArray) {
    Throw(env, "MIDI message must be an array of bytes.");
    return false;
  }

  uint32_t length = 0;
  if (napi_get_array_length(env, value, &length) != napi_ok) {
    Throw(env, "Unable to read MIDI message length.");
    return false;
  }

  if (length == 0) {
    Throw(env, "MIDI message must contain at least one byte.");
    return false;
  }

  if (length > 65535) {
    Throw(env, "MIDI message cannot exceed 65535 bytes.");
    return false;
  }

  message->reserve(length);
  for (uint32_t i = 0; i < length; i += 1) {
    napi_value element;
    if (napi_get_element(env, value, i, &element) != napi_ok) {
      Throw(env, "Unable to read MIDI message byte.");
      return false;
    }

    uint32_t byte = 0;
    if (napi_get_value_uint32(env, element, &byte) != napi_ok || byte > 255) {
      Throw(env, "MIDI message bytes must be integers from 0 to 255.");
      return false;
    }
    message->push_back(static_cast<uint8_t>(byte));
  }

  return true;
}

void FreePacketList(MIDIPacketList *packetList) { free(packetList); }

using PacketListPtr =
    std::unique_ptr<MIDIPacketList, decltype(&FreePacketList)>;

PacketListPtr CreatePacketList(const std::vector<uint8_t> &message) {
  size_t allocationSize = sizeof(MIDIPacketList) + message.size();
  auto *packetList = static_cast<MIDIPacketList *>(calloc(1, allocationSize));
  if (packetList == nullptr) {
    return {nullptr, FreePacketList};
  }

  MIDIPacket *packet = MIDIPacketListInit(packetList);
  MIDIPacketListAdd(packetList, allocationSize, packet, 0,
                    static_cast<UInt16>(message.size()), message.data());
  return {packetList, FreePacketList};
}

void MessageCallback(napi_env env, napi_value jsCallback, void *,
                     void *data) {
  std::unique_ptr<std::vector<uint8_t>> message(
      static_cast<std::vector<uint8_t> *>(data));

  if (env == nullptr || jsCallback == nullptr) {
    return;
  }

  napi_value array;
  napi_create_array_with_length(env, message->size(), &array);
  for (size_t i = 0; i < message->size(); i += 1) {
    napi_value byte;
    napi_create_uint32(env, (*message)[i], &byte);
    napi_set_element(env, array, static_cast<uint32_t>(i), byte);
  }

  napi_value global;
  napi_get_global(env, &global);
  napi_call_function(env, global, jsCallback, 1, &array, nullptr);
}

class NativeInput {
public:
  explicit NativeInput(EndpointInfo endpointInfo, bool virtualDestination)
      : info(std::move(endpointInfo)), isVirtualDestination(virtualDestination) {
  }

  ~NativeInput() { Close(); }

  bool SetMessageCallback(napi_env env, napi_value callback) {
    napi_threadsafe_function oldCallback = nullptr;

    {
      std::lock_guard<std::mutex> lock(callbackMutex);
      oldCallback = messageCallback;
      messageCallback = nullptr;
    }

    if (oldCallback != nullptr) {
      napi_release_threadsafe_function(oldCallback, napi_tsfn_abort);
    }

    napi_valuetype type;
    if (napi_typeof(env, callback, &type) != napi_ok) {
      Throw(env, "Unable to inspect callback.");
      return false;
    }

    if (type == napi_undefined || type == napi_null) {
      return true;
    }

    if (type != napi_function) {
      Throw(env, "Expected callback to be a function or null.");
      return false;
    }

    napi_value resourceName;
    napi_create_string_utf8(env, "Core MIDI message callback",
                            NAPI_AUTO_LENGTH, &resourceName);

    napi_threadsafe_function newCallback = nullptr;
    napi_status status = napi_create_threadsafe_function(
        env, callback, nullptr, resourceName, 0, 1, nullptr, nullptr, nullptr,
        MessageCallback, &newCallback);
    if (status != napi_ok) {
      Throw(env, "Unable to create MIDI message callback.");
      return false;
    }

    {
      std::lock_guard<std::mutex> lock(callbackMutex);
      if (closed) {
        napi_release_threadsafe_function(newCallback, napi_tsfn_abort);
        Throw(env, "MIDI input is closed.");
        return false;
      }
      messageCallback = newCallback;
    }

    return true;
  }

  void Dispatch(const MIDIPacketList *packetList) {
    const MIDIPacket *packet = &packetList->packet[0];
    for (UInt32 i = 0; i < packetList->numPackets; i += 1) {
      std::vector<uint8_t> message(packet->data, packet->data + packet->length);

      std::lock_guard<std::mutex> lock(callbackMutex);
      if (messageCallback != nullptr && !closed) {
        auto *payload = new std::vector<uint8_t>(std::move(message));
        napi_status status = napi_call_threadsafe_function(
            messageCallback, payload, napi_tsfn_nonblocking);
        if (status != napi_ok) {
          delete payload;
        }
      }

      packet = MIDIPacketNext(packet);
    }
  }

  void Close() {
    MIDIPortRef portToDispose = 0;
    MIDIEndpointRef sourceToDisconnect = 0;
    MIDIEndpointRef endpointToDispose = 0;
    napi_threadsafe_function callbackToRelease = nullptr;

    {
      std::lock_guard<std::mutex> lock(callbackMutex);
      if (closed) {
        return;
      }
      closed = true;
      callbackToRelease = messageCallback;
      messageCallback = nullptr;
    }

    portToDispose = inputPort;
    sourceToDisconnect = sourceEndpoint;
    endpointToDispose = isVirtualDestination ? info.endpoint : 0;
    inputPort = 0;
    sourceEndpoint = 0;

    if (portToDispose != 0 && sourceToDisconnect != 0) {
      MIDIPortDisconnectSource(portToDispose, sourceToDisconnect);
    }
    if (portToDispose != 0) {
      MIDIPortDispose(portToDispose);
    }
    if (endpointToDispose != 0) {
      MIDIEndpointDispose(endpointToDispose);
    }
    if (callbackToRelease != nullptr) {
      napi_release_threadsafe_function(callbackToRelease, napi_tsfn_abort);
    }
  }

  EndpointInfo info;
  MIDIPortRef inputPort = 0;
  MIDIEndpointRef sourceEndpoint = 0;
  bool isVirtualDestination = false;

private:
  std::mutex callbackMutex;
  napi_threadsafe_function messageCallback = nullptr;
  bool closed = false;
};

class NativeOutput {
public:
  explicit NativeOutput(EndpointInfo endpointInfo, bool virtualSource)
      : info(std::move(endpointInfo)), isVirtualSource(virtualSource) {}

  ~NativeOutput() { Close(); }

  bool Send(napi_env env, const std::vector<uint8_t> &message) {
    if (closed) {
      Throw(env, "MIDI output is closed.");
      return false;
    }

    auto packetList = CreatePacketList(message);
    if (packetList.get() == nullptr) {
      Throw(env, "Unable to allocate MIDI packet list.");
      return false;
    }

    OSStatus status = noErr;
    if (isVirtualSource) {
      status = MIDIReceived(info.endpoint, packetList.get());
    } else {
      status = MIDISend(outputPort, info.endpoint, packetList.get());
    }

    return !ThrowIfFailed(env, isVirtualSource ? "MIDIReceived" : "MIDISend",
                          status);
  }

  void Close() {
    if (closed) {
      return;
    }
    closed = true;

    if (outputPort != 0) {
      MIDIPortDispose(outputPort);
      outputPort = 0;
    }
    if (isVirtualSource && info.endpoint != 0) {
      MIDIEndpointDispose(info.endpoint);
      info.endpoint = 0;
    }
  }

  EndpointInfo info;
  MIDIPortRef outputPort = 0;
  bool isVirtualSource = false;
  bool closed = false;
};

void InputReadProc(const MIDIPacketList *packetList, void *readProcRefCon,
                   void *) {
  auto *input = static_cast<NativeInput *>(readProcRefCon);
  if (input != nullptr) {
    input->Dispatch(packetList);
  }
}

NativeInput *UnwrapInput(napi_env env, napi_callback_info callbackInfo) {
  napi_value self;
  napi_get_cb_info(env, callbackInfo, nullptr, nullptr, &self, nullptr);
  NativeInput *input = nullptr;
  napi_unwrap(env, self, reinterpret_cast<void **>(&input));
  if (input == nullptr) {
    Throw(env, "Invalid MIDI input object.");
  }
  return input;
}

NativeOutput *UnwrapOutput(napi_env env, napi_callback_info callbackInfo) {
  napi_value self;
  napi_get_cb_info(env, callbackInfo, nullptr, nullptr, &self, nullptr);
  NativeOutput *output = nullptr;
  napi_unwrap(env, self, reinterpret_cast<void **>(&output));
  if (output == nullptr) {
    Throw(env, "Invalid MIDI output object.");
  }
  return output;
}

napi_value InputGetInfo(napi_env env, napi_callback_info callbackInfo) {
  NativeInput *input = UnwrapInput(env, callbackInfo);
  if (input == nullptr) {
    return CreateUndefined(env);
  }
  return CreateEndpointInfoObject(env, input->info);
}

napi_value InputSetMessageCallback(napi_env env,
                                   napi_callback_info callbackInfo) {
  size_t argc = 1;
  napi_value args[1];
  napi_value self;
  napi_get_cb_info(env, callbackInfo, &argc, args, &self, nullptr);

  NativeInput *input = nullptr;
  napi_unwrap(env, self, reinterpret_cast<void **>(&input));
  if (input == nullptr) {
    Throw(env, "Invalid MIDI input object.");
    return CreateUndefined(env);
  }

  napi_value callback = argc > 0 ? args[0] : CreateUndefined(env);
  input->SetMessageCallback(env, callback);
  return CreateUndefined(env);
}

napi_value InputClose(napi_env env, napi_callback_info callbackInfo) {
  NativeInput *input = UnwrapInput(env, callbackInfo);
  if (input != nullptr) {
    input->Close();
  }
  return CreateUndefined(env);
}

napi_value OutputGetInfo(napi_env env, napi_callback_info callbackInfo) {
  NativeOutput *output = UnwrapOutput(env, callbackInfo);
  if (output == nullptr) {
    return CreateUndefined(env);
  }
  return CreateEndpointInfoObject(env, output->info);
}

napi_value OutputSendMessage(napi_env env, napi_callback_info callbackInfo) {
  size_t argc = 1;
  napi_value args[1];
  napi_value self;
  napi_get_cb_info(env, callbackInfo, &argc, args, &self, nullptr);

  NativeOutput *output = nullptr;
  napi_unwrap(env, self, reinterpret_cast<void **>(&output));
  if (output == nullptr) {
    Throw(env, "Invalid MIDI output object.");
    return CreateUndefined(env);
  }

  if (argc < 1) {
    Throw(env, "sendMessage requires a MIDI message.");
    return CreateUndefined(env);
  }

  std::vector<uint8_t> message;
  if (ReadMessage(env, args[0], &message)) {
    output->Send(env, message);
  }

  return CreateUndefined(env);
}

napi_value OutputClose(napi_env env, napi_callback_info callbackInfo) {
  NativeOutput *output = UnwrapOutput(env, callbackInfo);
  if (output != nullptr) {
    output->Close();
  }
  return CreateUndefined(env);
}

void InputFinalizer(napi_env, void *data, void *) {
  delete static_cast<NativeInput *>(data);
}

void OutputFinalizer(napi_env, void *data, void *) {
  delete static_cast<NativeOutput *>(data);
}

napi_value CreateInputObject(napi_env env, NativeInput *input) {
  napi_value object;
  napi_create_object(env, &object);

  napi_property_descriptor properties[] = {
      {"getInfo", nullptr, InputGetInfo, nullptr, nullptr, nullptr,
       napi_default, nullptr},
      {"setMessageCallback", nullptr, InputSetMessageCallback, nullptr, nullptr,
       nullptr, napi_default, nullptr},
      {"close", nullptr, InputClose, nullptr, nullptr, nullptr, napi_default,
       nullptr},
  };
  napi_define_properties(env, object, 3, properties);
  napi_wrap(env, object, input, InputFinalizer, nullptr, nullptr);
  return object;
}

napi_value CreateOutputObject(napi_env env, NativeOutput *output) {
  napi_value object;
  napi_create_object(env, &object);

  napi_property_descriptor properties[] = {
      {"getInfo", nullptr, OutputGetInfo, nullptr, nullptr, nullptr,
       napi_default, nullptr},
      {"sendMessage", nullptr, OutputSendMessage, nullptr, nullptr, nullptr,
       napi_default, nullptr},
      {"close", nullptr, OutputClose, nullptr, nullptr, nullptr, napi_default,
       nullptr},
  };
  napi_define_properties(env, object, 3, properties);
  napi_wrap(env, object, output, OutputFinalizer, nullptr, nullptr);
  return object;
}

napi_value GetSupportInfo(napi_env env, napi_callback_info) {
  napi_value object;
  napi_create_object(env, &object);

  OSStatus status = EnsureClientStatus();
  if (status != noErr) {
    napi_value supported;
    napi_get_boolean(env, false, &supported);
    napi_set_named_property(env, object, "supported", supported);

    std::string reason = OSStatusMessage("MIDIClientCreate", status);
    napi_value reasonValue;
    napi_create_string_utf8(env, reason.c_str(), NAPI_AUTO_LENGTH,
                            &reasonValue);
    napi_set_named_property(env, object, "reason", reasonValue);
    return object;
  }

  napi_value supported;
  napi_get_boolean(env, true, &supported);
  napi_set_named_property(env, object, "supported", supported);

  napi_value virtualInfo;
  napi_create_object(env, &virtualInfo);
  napi_value virtualSupported;
  napi_get_boolean(env, true, &virtualSupported);
  napi_set_named_property(env, virtualInfo, "supported", virtualSupported);
  napi_set_named_property(env, object, "virtual", virtualInfo);

  return object;
}

napi_value GetInputs(napi_env env, napi_callback_info) {
  napi_value array;
  napi_create_array(env, &array);

  ItemCount count = MIDIGetNumberOfSources();
  for (ItemCount i = 0; i < count; i += 1) {
    MIDIEndpointRef endpoint = MIDIGetSource(i);
    EndpointInfo info{GetEndpointName(endpoint, "MIDI Input"), endpoint};
    napi_set_element(env, array, static_cast<uint32_t>(i),
                     CreateEndpointInfoObject(env, info));
  }

  return array;
}

napi_value GetOutputs(napi_env env, napi_callback_info) {
  napi_value array;
  napi_create_array(env, &array);

  ItemCount count = MIDIGetNumberOfDestinations();
  for (ItemCount i = 0; i < count; i += 1) {
    MIDIEndpointRef endpoint = MIDIGetDestination(i);
    EndpointInfo info{GetEndpointName(endpoint, "MIDI Output"), endpoint};
    napi_set_element(env, array, static_cast<uint32_t>(i),
                     CreateEndpointInfoObject(env, info));
  }

  return array;
}

napi_value OpenInput(napi_env env, napi_callback_info callbackInfo) {
  if (!EnsureClient(env)) {
    return CreateUndefined(env);
  }

  size_t argc = 1;
  napi_value args[1];
  napi_get_cb_info(env, callbackInfo, &argc, args, nullptr, nullptr);
  if (argc < 1) {
    Throw(env, "openInput requires a MIDI endpoint.");
    return CreateUndefined(env);
  }

  EndpointInfo info;
  if (!ReadEndpointInfo(env, args[0], &info)) {
    return CreateUndefined(env);
  }

  auto input = std::make_unique<NativeInput>(info, false);
  OSStatus status =
      MIDIInputPortCreate(gClient, CFSTR("Arcane Wizards MIDI Input"),
                          InputReadProc, input.get(), &input->inputPort);
  if (ThrowIfFailed(env, "MIDIInputPortCreate", status)) {
    return CreateUndefined(env);
  }

  status = MIDIPortConnectSource(input->inputPort, info.endpoint, nullptr);
  if (ThrowIfFailed(env, "MIDIPortConnectSource", status)) {
    return CreateUndefined(env);
  }

  input->sourceEndpoint = info.endpoint;
  return CreateInputObject(env, input.release());
}

napi_value OpenOutput(napi_env env, napi_callback_info callbackInfo) {
  if (!EnsureClient(env)) {
    return CreateUndefined(env);
  }

  size_t argc = 1;
  napi_value args[1];
  napi_get_cb_info(env, callbackInfo, &argc, args, nullptr, nullptr);
  if (argc < 1) {
    Throw(env, "openOutput requires a MIDI endpoint.");
    return CreateUndefined(env);
  }

  EndpointInfo info;
  if (!ReadEndpointInfo(env, args[0], &info)) {
    return CreateUndefined(env);
  }

  auto output = std::make_unique<NativeOutput>(info, false);
  OSStatus status = MIDIOutputPortCreate(
      gClient, CFSTR("Arcane Wizards MIDI Output"), &output->outputPort);
  if (ThrowIfFailed(env, "MIDIOutputPortCreate", status)) {
    return CreateUndefined(env);
  }

  return CreateOutputObject(env, output.release());
}

napi_value CreateVirtualInput(napi_env env, napi_callback_info callbackInfo) {
  if (!EnsureClient(env)) {
    return CreateUndefined(env);
  }

  size_t argc = 2;
  napi_value args[2];
  napi_get_cb_info(env, callbackInfo, &argc, args, nullptr, nullptr);
  if (argc < 1) {
    Throw(env, "createVirtualInput requires a port name.");
    return CreateUndefined(env);
  }

  std::string name;
  if (!GetStringArgument(env, args[0], &name) || name.empty()) {
    Throw(env, "Virtual input name must be a non-empty string.");
    return CreateUndefined(env);
  }

  std::string manufacturer;
  std::string model;
  if (argc > 1 && !ReadVirtualOptions(env, args[1], &manufacturer, &model)) {
    return CreateUndefined(env);
  }

  CFStringRef portName = CreateCFString(name);
  if (portName == nullptr) {
    Throw(env, "Unable to create virtual input name.");
    return CreateUndefined(env);
  }

  MIDIEndpointRef endpoint = 0;
  auto input = std::make_unique<NativeInput>(EndpointInfo{name, endpoint}, true);
  OSStatus status = MIDIDestinationCreate(gClient, portName, InputReadProc,
                                          input.get(), &endpoint);
  CFRelease(portName);
  if (ThrowIfFailed(env, "MIDIDestinationCreate", status)) {
    return CreateUndefined(env);
  }

  input->info.endpoint = endpoint;
  ApplyVirtualOptions(endpoint, manufacturer, model);
  return CreateInputObject(env, input.release());
}

napi_value CreateVirtualOutput(napi_env env, napi_callback_info callbackInfo) {
  if (!EnsureClient(env)) {
    return CreateUndefined(env);
  }

  size_t argc = 2;
  napi_value args[2];
  napi_get_cb_info(env, callbackInfo, &argc, args, nullptr, nullptr);
  if (argc < 1) {
    Throw(env, "createVirtualOutput requires a port name.");
    return CreateUndefined(env);
  }

  std::string name;
  if (!GetStringArgument(env, args[0], &name) || name.empty()) {
    Throw(env, "Virtual output name must be a non-empty string.");
    return CreateUndefined(env);
  }

  std::string manufacturer;
  std::string model;
  if (argc > 1 && !ReadVirtualOptions(env, args[1], &manufacturer, &model)) {
    return CreateUndefined(env);
  }

  CFStringRef portName = CreateCFString(name);
  if (portName == nullptr) {
    Throw(env, "Unable to create virtual output name.");
    return CreateUndefined(env);
  }

  MIDIEndpointRef endpoint = 0;
  OSStatus status = MIDISourceCreate(gClient, portName, &endpoint);
  CFRelease(portName);
  if (ThrowIfFailed(env, "MIDISourceCreate", status)) {
    return CreateUndefined(env);
  }

  ApplyVirtualOptions(endpoint, manufacturer, model);
  auto output =
      std::make_unique<NativeOutput>(EndpointInfo{name, endpoint}, true);
  return CreateOutputObject(env, output.release());
}

napi_value Init(napi_env env, napi_value exports) {
  napi_property_descriptor properties[] = {
      {"getSupportInfo", nullptr, GetSupportInfo, nullptr, nullptr, nullptr,
       napi_default, nullptr},
      {"getInputs", nullptr, GetInputs, nullptr, nullptr, nullptr, napi_default,
       nullptr},
      {"getOutputs", nullptr, GetOutputs, nullptr, nullptr, nullptr,
       napi_default, nullptr},
      {"openInput", nullptr, OpenInput, nullptr, nullptr, nullptr, napi_default,
       nullptr},
      {"openOutput", nullptr, OpenOutput, nullptr, nullptr, nullptr,
       napi_default, nullptr},
      {"createVirtualInput", nullptr, CreateVirtualInput, nullptr, nullptr,
       nullptr, napi_default, nullptr},
      {"createVirtualOutput", nullptr, CreateVirtualOutput, nullptr, nullptr,
       nullptr, napi_default, nullptr},
  };

  napi_define_properties(env, exports, 7, properties);
  return exports;
}

} // namespace

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
