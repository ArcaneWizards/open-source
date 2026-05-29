import type {
  MidiEndpointInfo,
  MidiEndpoints,
  MIDIInputEventMap,
  MIDIInput,
  MIDIInterfaceEventMap,
  MIDIInterface,
  MIDIOutputEventMap,
  MIDIOutput,
  MIDISupportResponse,
  VirtualPortOptions,
  MIDIMessageEvent,
  MIDIEndpointClosedEvent,
  MIDIEndpointsChangedEvent,
} from './types.js';
import { createMIDIEvent } from './types.js';
import {
  MIDIEndpointClosedError,
  MIDIInvalidArgumentError,
  MIDINativeError,
  toMIDINativeError,
} from './errors.js';
import { EventEmitter } from 'node:events';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

type NativeMIDIInput = {
  getInfo(): MidiEndpointInfo;
  setMessageCallback(listener: ((message: number[]) => void) | null): void;
  close(): void;
};

type NativeMIDIOutput = {
  getInfo(): MidiEndpointInfo;
  sendMessage(message: number[]): void;
  close(): void;
};

type NativeMIDIInterface = {
  getSources(): MidiEndpointInfo[];
  getDestinations(): MidiEndpointInfo[];
  setNotificationCallback(listener: ((messageId: number) => void) | null): void;
  connectSource(endpoint: MidiEndpointInfo): NativeMIDIInput;
  openDestination(endpoint: MidiEndpointInfo): NativeMIDIOutput;
  createVirtualDestination(
    name: string,
    options?: VirtualPortOptions,
  ): NativeMIDIInput;
  createVirtualSource(
    name: string,
    options?: VirtualPortOptions,
  ): NativeMIDIOutput;
};

const requireNative = createRequire(join(process.cwd(), 'package.json'));

type MIDIState = MidiEndpoints;

let midiDeviceState: MIDIState | null = null;
let midiDeviceStateListenerConfigured = false;
const midiDeviceStateListeners = new Set<
  (event: MIDIInterfaceEventMap['endpointschanged']) => void
>();
const openEndpointHandles = new Set<{
  closeWhenRemovedFrom: keyof MidiEndpoints;
  endpoint: MidiEndpointInfo;
  closeFromEndpointRemoval(): void;
}>();

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const assertPublicEndpointInfo = (
  value: unknown,
  argument: string,
): MidiEndpointInfo => {
  if (
    !isRecord(value) ||
    typeof value.name !== 'string' ||
    typeof value.portId !== 'number'
  ) {
    throw new MIDIInvalidArgumentError(
      `${argument} must be a MIDI endpoint object.`,
      {
        argument,
      },
    );
  }

  return {
    name: value.name,
    portId: value.portId,
  };
};

const assertVirtualPortName = (value: unknown, argument: string) => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new MIDIInvalidArgumentError(
      `${argument} must be a non-empty string.`,
      {
        argument,
      },
    );
  }

  return value;
};

const assertMIDIMessage = (value: unknown): number[] => {
  if (!Array.isArray(value)) {
    throw new MIDIInvalidArgumentError(
      'MIDI message must be an array of bytes.',
      {
        argument: 'message',
      },
    );
  }

  if (value.length === 0) {
    throw new MIDIInvalidArgumentError(
      'MIDI message must contain at least one byte.',
      {
        argument: 'message',
      },
    );
  }

  if (value.length > 65535) {
    throw new MIDIInvalidArgumentError(
      'MIDI message cannot exceed 65535 bytes.',
      {
        argument: 'message',
      },
    );
  }

  for (const byte of value) {
    if (!Number.isInteger(byte) || byte < 0 || byte > 255) {
      throw new MIDIInvalidArgumentError(
        'MIDI message bytes must be integers from 0 to 255.',
        {
          argument: 'message',
        },
      );
    }
  }

  return value;
};

function assertFunction(
  value: unknown,
  name: string,
): asserts value is (...args: unknown[]) => unknown {
  if (typeof value !== 'function') {
    throw new MIDINativeError(`MacOS MIDI native module is missing ${name}().`);
  }
}

const assertEndpointInfo = (value: unknown): MidiEndpointInfo => {
  if (
    !isRecord(value) ||
    typeof value.name !== 'string' ||
    typeof value.portId !== 'number'
  ) {
    throw new MIDINativeError(
      'MacOS MIDI native module returned an invalid endpoint.',
    );
  }

  return {
    name: value.name,
    portId: value.portId,
  };
};

const assertEndpointInfoList = (value: unknown): MidiEndpointInfo[] => {
  if (!Array.isArray(value)) {
    throw new MIDINativeError(
      'MacOS MIDI native module returned an invalid endpoint list.',
    );
  }

  return value.map((endpoint) => assertEndpointInfo(endpoint));
};

const assertNativeInput = (value: unknown): NativeMIDIInput => {
  if (!isRecord(value)) {
    throw new MIDINativeError(
      'MacOS MIDI native module returned an invalid input.',
    );
  }

  assertFunction(value.getInfo, 'input.getInfo');
  assertFunction(value.setMessageCallback, 'input.setMessageCallback');
  assertFunction(value.close, 'input.close');

  return value as NativeMIDIInput;
};

const assertNativeOutput = (value: unknown): NativeMIDIOutput => {
  if (!isRecord(value)) {
    throw new MIDINativeError(
      'MacOS MIDI native module returned an invalid output.',
    );
  }

  assertFunction(value.getInfo, 'output.getInfo');
  assertFunction(value.sendMessage, 'output.sendMessage');
  assertFunction(value.close, 'output.close');

  return value as NativeMIDIOutput;
};

const freeze = <Value extends object>(value: Value): Value => {
  return Object.freeze(value) as Value;
};

const freezeEndpointInfo = (endpoint: MidiEndpointInfo): MidiEndpointInfo => {
  return freeze({
    name: endpoint.name,
    portId: endpoint.portId,
  });
};

const freezeEndpointList = (
  endpoints: MidiEndpointInfo[],
): MidiEndpointInfo[] => {
  return freeze(endpoints);
};

const freezeEndpoints = (endpoints: MidiEndpoints): MidiEndpoints => {
  return freeze({
    inputs: endpoints.inputs,
    outputs: endpoints.outputs,
  });
};

const MACOS_SUPPORT_INFO = freeze({
  supported: true,
  notifications: freeze({
    supported: true,
  }),
  virtual: freeze({
    supported: true,
  }),
}) satisfies MIDISupportResponse;

const EMPTY_ENDPOINTS = freezeEndpoints({
  inputs: freezeEndpointList([]),
  outputs: freezeEndpointList([]),
});

const callNative = <Value>(operation: string, callback: () => Value): Value => {
  try {
    return callback();
  } catch (error) {
    throw toMIDINativeError(
      error,
      `MacOS MIDI native operation ${operation} failed.`,
      operation,
    );
  }
};

const createMacOSMIDIInput = (
  nativeInput: NativeMIDIInput,
  closeWhenRemovedFrom: keyof MidiEndpoints,
): MIDIInput => {
  let closed = false;
  const events = new EventEmitter();
  const info = freezeEndpointInfo(
    assertEndpointInfo(
      callNative('input.getInfo', () => nativeInput.getInfo()),
    ),
  );

  callNative('input.setMessageCallback', () => {
    nativeInput.setMessageCallback((message) => {
      events.emit(
        'message',
        createMIDIEvent<MIDIMessageEvent>({
          type: 'message',
          message: [...message],
        }),
      );
    });
  });

  const close = () => {
    if (closed) {
      return;
    }

    closed = true;
    openEndpointHandles.delete(endpointHandle);
    callNative('input.setMessageCallback', () => {
      nativeInput.setMessageCallback(null);
    });
    callNative('input.close', () => {
      nativeInput.close();
    });
    events.emit(
      'closed',
      createMIDIEvent<MIDIEndpointClosedEvent>({
        type: 'closed',
        endpoint: info,
      }),
    );
    events.removeAllListeners();
  };
  const endpointHandle = {
    closeWhenRemovedFrom,
    endpoint: info,
    closeFromEndpointRemoval: close,
  };
  openEndpointHandles.add(endpointHandle);

  return {
    getInfo() {
      return info;
    },
    addEventListener<Type extends keyof MIDIInputEventMap>(
      type: Type,
      listener: (event: MIDIInputEventMap[Type]) => void,
    ) {
      events.on(type, listener);
    },
    removeEventListener<Type extends keyof MIDIInputEventMap>(
      type: Type,
      listener: (event: MIDIInputEventMap[Type]) => void,
    ) {
      events.off(type, listener);
    },
    async close() {
      close();
    },
  };
};

const createMacOSMIDIOutput = (
  nativeOutput: NativeMIDIOutput,
  closeWhenRemovedFrom: keyof MidiEndpoints,
): MIDIOutput => {
  let closed = false;
  const events = new EventEmitter();
  const info = freezeEndpointInfo(
    assertEndpointInfo(
      callNative('output.getInfo', () => nativeOutput.getInfo()),
    ),
  );

  const close = () => {
    if (closed) {
      return;
    }

    closed = true;
    openEndpointHandles.delete(endpointHandle);
    callNative('output.close', () => {
      nativeOutput.close();
    });
    events.emit(
      'closed',
      createMIDIEvent<MIDIEndpointClosedEvent>({
        type: 'closed',
        endpoint: info,
      }),
    );
    events.removeAllListeners();
  };
  const endpointHandle = {
    closeWhenRemovedFrom,
    endpoint: info,
    closeFromEndpointRemoval: close,
  };
  openEndpointHandles.add(endpointHandle);

  return {
    getInfo() {
      return info;
    },
    async sendMessage(message: number[]) {
      if (closed) {
        throw new MIDIEndpointClosedError('MIDI output is closed.', {
          endpoint: info,
        });
      }
      const midiMessage = assertMIDIMessage(message);
      callNative('output.sendMessage', () => {
        nativeOutput.sendMessage(midiMessage);
      });
    },
    addEventListener<Type extends keyof MIDIOutputEventMap>(
      type: Type,
      listener: (event: MIDIOutputEventMap[Type]) => void,
    ) {
      events.on(type, listener);
    },
    removeEventListener<Type extends keyof MIDIOutputEventMap>(
      type: Type,
      listener: (event: MIDIOutputEventMap[Type]) => void,
    ) {
      events.off(type, listener);
    },
    async close() {
      close();
    },
  };
};

const getNativeModule = () => {
  const packageRootCandidates: string[] = [];

  try {
    packageRootCandidates.push(
      dirname(requireNative.resolve('@arcanewizards/midi/package.json')),
    );
  } catch {
    // Fall through to local path candidates.
  }

  if (typeof __dirname === 'string') {
    packageRootCandidates.push(join(__dirname, '..'));
  }

  packageRootCandidates.push(process.cwd());
  packageRootCandidates.push(join(process.cwd(), 'packages', 'midi'));

  const resolvedPaths = new Set(
    packageRootCandidates.map((packageRoot) =>
      join(packageRoot, 'native', 'out', 'midi-macos.node'),
    ),
  );

  for (const nativePath of resolvedPaths) {
    if (existsSync(nativePath)) {
      return callNative('loadNativeModule', () => requireNative(nativePath));
    }
  }

  throw new MIDINativeError(
    `MacOS MIDI native module was not found. Tried: ${[...resolvedPaths].join(
      ', ',
    )}`,
  );
};

const assertNativeModule = (value: unknown): NativeMIDIInterface => {
  if (!isRecord(value)) {
    throw new MIDINativeError(
      'MacOS MIDI native module did not load correctly.',
    );
  }

  assertFunction(value.getSources, 'getSources');
  assertFunction(value.getDestinations, 'getDestinations');
  assertFunction(value.setNotificationCallback, 'setNotificationCallback');
  assertFunction(value.connectSource, 'connectSource');
  assertFunction(value.openDestination, 'openDestination');
  assertFunction(value.createVirtualDestination, 'createVirtualDestination');
  assertFunction(value.createVirtualSource, 'createVirtualSource');

  return value as NativeMIDIInterface;
};

const readRawMidiDeviceState = (
  nativeModule: NativeMIDIInterface,
): MIDIState => {
  return {
    inputs: assertEndpointInfoList(
      callNative('getSources', () => nativeModule.getSources()),
    ),
    outputs: assertEndpointInfoList(
      callNative('getDestinations', () => nativeModule.getDestinations()),
    ),
  };
};

const endpointKey = (endpoint: MidiEndpointInfo) => {
  return `${endpoint.portId}`;
};

const endpointsEqual = (first: MidiEndpointInfo, second: MidiEndpointInfo) => {
  return first.name === second.name && first.portId === second.portId;
};

const reconcileEndpointList = (
  previous: MidiEndpointInfo[],
  next: MidiEndpointInfo[],
) => {
  const previousByKey = new Map(
    previous.map((endpoint) => [endpointKey(endpoint), endpoint]),
  );
  let changed = previous.length !== next.length;

  const reconciled = next.map((endpoint, index) => {
    const previousEndpoint = previousByKey.get(endpointKey(endpoint));
    const nextEndpoint =
      previousEndpoint && endpointsEqual(previousEndpoint, endpoint)
        ? previousEndpoint
        : freezeEndpointInfo(endpoint);

    if (nextEndpoint !== previous[index]) {
      changed = true;
    }

    return nextEndpoint;
  });

  if (!changed) {
    return previous;
  }

  return freezeEndpointList(reconciled);
};

const reconcileMidiDeviceState = (
  previous: MIDIState,
  next: MIDIState,
): MIDIState => {
  const inputs = reconcileEndpointList(previous.inputs, next.inputs);
  const outputs = reconcileEndpointList(previous.outputs, next.outputs);

  if (inputs === previous.inputs && outputs === previous.outputs) {
    return previous;
  }

  return freezeEndpoints({
    inputs,
    outputs,
  });
};

const readMidiDeviceState = (
  nativeModule: NativeMIDIInterface,
  previous: MIDIState,
): MIDIState => {
  return reconcileMidiDeviceState(
    previous,
    readRawMidiDeviceState(nativeModule),
  );
};

const diffEndpoints = (
  previous: MidiEndpointInfo[],
  next: MidiEndpointInfo[],
) => {
  const nextKeys = new Set(next.map((endpoint) => endpointKey(endpoint)));
  const previousKeys = new Set(
    previous.map((endpoint) => endpointKey(endpoint)),
  );

  return {
    added: next.filter((endpoint) => !previousKeys.has(endpointKey(endpoint))),
    removed: previous.filter(
      (endpoint) => !nextKeys.has(endpointKey(endpoint)),
    ),
  };
};

const createEndpointsChangedEvent = (
  previous: MidiEndpoints,
  next: MidiEndpoints,
): MIDIInterfaceEventMap['endpointschanged'] => {
  const inputChanges = diffEndpoints(previous.inputs, next.inputs);
  const outputChanges = diffEndpoints(previous.outputs, next.outputs);

  return createMIDIEvent<MIDIEndpointsChangedEvent>({
    type: 'endpointschanged',
    endpoints: next,
    added: freezeEndpoints({
      inputs: freezeEndpointList(inputChanges.added),
      outputs: freezeEndpointList(outputChanges.added),
    }),
    removed: freezeEndpoints({
      inputs: freezeEndpointList(inputChanges.removed),
      outputs: freezeEndpointList(outputChanges.removed),
    }),
  });
};

const hasEndpointChanges = (
  event: MIDIInterfaceEventMap['endpointschanged'],
) => {
  return (
    event.added.inputs.length > 0 ||
    event.added.outputs.length > 0 ||
    event.removed.inputs.length > 0 ||
    event.removed.outputs.length > 0
  );
};

const closeRemovedEndpointHandles = (
  event: MIDIInterfaceEventMap['endpointschanged'],
) => {
  const removedEndpointKeys = {
    inputs: new Set(
      event.removed.inputs.map((endpoint) => endpointKey(endpoint)),
    ),
    outputs: new Set(
      event.removed.outputs.map((endpoint) => endpointKey(endpoint)),
    ),
  };

  for (const handle of [...openEndpointHandles]) {
    if (
      removedEndpointKeys[handle.closeWhenRemovedFrom].has(
        endpointKey(handle.endpoint),
      )
    ) {
      handle.closeFromEndpointRemoval();
    }
  }
};

const getMidiDeviceState = (nativeModule: NativeMIDIInterface): MIDIState => {
  if (!midiDeviceStateListenerConfigured) {
    callNative('setNotificationCallback', () => {
      nativeModule.setNotificationCallback(() => {
        const previous = midiDeviceState ?? EMPTY_ENDPOINTS;
        const next = readMidiDeviceState(nativeModule, previous);
        midiDeviceState = next;

        if (next === previous) {
          return;
        }

        const event = createEndpointsChangedEvent(previous, next);
        if (!hasEndpointChanges(event)) {
          return;
        }

        closeRemovedEndpointHandles(event);

        for (const listener of [...midiDeviceStateListeners]) {
          listener(event);
        }
      });
    });
    midiDeviceStateListenerConfigured = true;
  }

  if (midiDeviceState === null) {
    midiDeviceState = readMidiDeviceState(nativeModule, EMPTY_ENDPOINTS);
  }

  return midiDeviceState;
};

const createMacOSMIDIInterface = (
  nativeModule: NativeMIDIInterface,
): MIDIInterface => {
  const events = new EventEmitter();
  const deviceStateListener = (
    event: MIDIInterfaceEventMap['endpointschanged'],
  ) => {
    events.emit('endpointschanged', event);
  };

  midiDeviceStateListeners.add(deviceStateListener);

  return {
    async getSupportInfo() {
      return MACOS_SUPPORT_INFO;
    },
    async getEndpoints() {
      return getMidiDeviceState(nativeModule);
    },
    async getInputs() {
      return getMidiDeviceState(nativeModule).inputs;
    },
    async getOutputs() {
      return getMidiDeviceState(nativeModule).outputs;
    },
    async openInput(endpoint: MidiEndpointInfo) {
      const inputEndpoint = assertPublicEndpointInfo(endpoint, 'endpoint');
      return createMacOSMIDIInput(
        assertNativeInput(
          callNative('connectSource', () =>
            nativeModule.connectSource(inputEndpoint),
          ),
        ),
        'inputs',
      );
    },
    async openOutput(endpoint: MidiEndpointInfo) {
      const outputEndpoint = assertPublicEndpointInfo(endpoint, 'endpoint');
      return createMacOSMIDIOutput(
        assertNativeOutput(
          callNative('openDestination', () =>
            nativeModule.openDestination(outputEndpoint),
          ),
        ),
        'outputs',
      );
    },
    async createVirtualInput(name: string, options?: VirtualPortOptions) {
      const portName = assertVirtualPortName(name, 'name');
      return createMacOSMIDIInput(
        assertNativeInput(
          callNative('createVirtualDestination', () =>
            nativeModule.createVirtualDestination(portName, options),
          ),
        ),
        'outputs',
      );
    },
    async createVirtualOutput(name: string, options?: VirtualPortOptions) {
      const portName = assertVirtualPortName(name, 'name');
      return createMacOSMIDIOutput(
        assertNativeOutput(
          callNative('createVirtualSource', () =>
            nativeModule.createVirtualSource(portName, options),
          ),
        ),
        'inputs',
      );
    },
    addEventListener<Type extends keyof MIDIInterfaceEventMap>(
      type: Type,
      listener: (event: MIDIInterfaceEventMap[Type]) => void,
    ) {
      getMidiDeviceState(nativeModule);
      events.on(type, listener);
    },
    removeEventListener<Type extends keyof MIDIInterfaceEventMap>(
      type: Type,
      listener: (event: MIDIInterfaceEventMap[Type]) => void,
    ) {
      events.off(type, listener);
    },
  };
};

export const loadNativeModuleMacOS = (): MIDIInterface => {
  const nativeModule = assertNativeModule(getNativeModule());

  return createMacOSMIDIInterface(nativeModule);
};
