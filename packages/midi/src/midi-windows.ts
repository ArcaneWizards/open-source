import type {
  MIDIEndpointInfo,
  MIDIEndpoints,
  MIDIEndpointClosedEvent,
  MIDIEndpointsChangedEvent,
  MIDIInput,
  MIDIInputEventMap,
  MIDIInterface,
  MIDIInterfaceEventMap,
  MIDIMessageEvent,
  MIDIOutput,
  MIDIOutputEventMap,
  MIDISupportResponse,
} from './types.js';
import { createMIDIEvent } from './types.js';
import {
  MIDIEndpointClosedError,
  MIDIInvalidArgumentError,
  MIDINativeError,
  MIDINotImplementedError,
  toMIDINativeError,
} from './errors.js';
import { EventEmitter } from 'node:events';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const requireNative = createRequire(join(process.cwd(), 'package.json'));

type NativeMIDIInput = {
  getInfo(): MIDIEndpointInfo;
  addMessageListener(listener: (message: number[]) => void): void;
  removeMessageListener(listener: (message: number[]) => void): void;
  close(): void;
};

type NativeMIDIOutput = {
  getInfo(): MIDIEndpointInfo;
  sendMessage(message: number[]): void;
  close(): void;
};

type NativeMIDIInterface = {
  getInputs(): MIDIEndpointInfo[];
  getOutputs(): MIDIEndpointInfo[];
  setNotificationCallback(listener: ((messageId: number) => void) | null): void;
  openInput(endpoint: MIDIEndpointInfo): NativeMIDIInput;
  openOutput(endpoint: MIDIEndpointInfo): NativeMIDIOutput;
};

type MIDIState = MIDIEndpoints;

let midiDeviceState: MIDIState | null = null;
let midiDeviceStateListenerConfigured = false;
const midiDeviceStateListeners = new Set<
  (event: MIDIInterfaceEventMap['endpointschanged']) => void
>();
const openEndpointHandles = new Set<{
  closeWhenRemovedFrom: keyof MIDIEndpoints;
  endpoint: MIDIEndpointInfo;
  closeFromEndpointRemoval(): void;
}>();

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

function assertFunction(
  value: unknown,
  name: string,
): asserts value is (...args: unknown[]) => unknown {
  if (typeof value !== 'function') {
    throw new MIDINativeError(
      `Windows MIDI native module is missing ${name}().`,
    );
  }
}

const assertEndpointInfo = (value: unknown): MIDIEndpointInfo => {
  if (
    !isRecord(value) ||
    typeof value.name !== 'string' ||
    typeof value.portId !== 'number'
  ) {
    throw new MIDINativeError(
      'Windows MIDI native module returned an invalid endpoint.',
    );
  }

  return freezeEndpointInfo({
    name: value.name,
    portId: value.portId,
  });
};

const assertPublicEndpointInfo = (
  value: unknown,
  argument: string,
): MIDIEndpointInfo => {
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

  return freezeEndpointInfo({
    name: value.name,
    portId: value.portId,
  });
};

const assertEndpointInfoList = (value: unknown): MIDIEndpointInfo[] => {
  if (!Array.isArray(value)) {
    throw new MIDINativeError(
      'Windows MIDI native module returned an invalid endpoint list.',
    );
  }

  return freezeEndpointList(
    value.map((endpoint) => assertEndpointInfo(endpoint)),
  );
};

const assertNativeInput = (value: unknown): NativeMIDIInput => {
  if (!isRecord(value)) {
    throw new MIDINativeError(
      'Windows MIDI native module returned an invalid input.',
    );
  }

  assertFunction(value.getInfo, 'input.getInfo');
  assertFunction(value.addMessageListener, 'input.addMessageListener');
  assertFunction(value.removeMessageListener, 'input.removeMessageListener');
  assertFunction(value.close, 'input.close');

  return value as NativeMIDIInput;
};

const assertNativeOutput = (value: unknown): NativeMIDIOutput => {
  if (!isRecord(value)) {
    throw new MIDINativeError(
      'Windows MIDI native module returned an invalid output.',
    );
  }

  assertFunction(value.getInfo, 'output.getInfo');
  assertFunction(value.sendMessage, 'output.sendMessage');
  assertFunction(value.close, 'output.close');

  return value as NativeMIDIOutput;
};

const assertNativeModule = (value: unknown): NativeMIDIInterface => {
  if (!isRecord(value)) {
    throw new MIDINativeError(
      'Windows MIDI native module did not load correctly.',
    );
  }

  assertFunction(value.getInputs, 'getInputs');
  assertFunction(value.getOutputs, 'getOutputs');
  assertFunction(value.setNotificationCallback, 'setNotificationCallback');
  assertFunction(value.openInput, 'openInput');
  assertFunction(value.openOutput, 'openOutput');

  return value as NativeMIDIInterface;
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

const freeze = <Value extends object>(value: Value): Value => {
  return Object.freeze(value) as Value;
};

const freezeEndpointInfo = (endpoint: MIDIEndpointInfo): MIDIEndpointInfo => {
  return freeze({
    name: endpoint.name,
    portId: endpoint.portId,
  });
};

const freezeEndpointList = (
  endpoints: MIDIEndpointInfo[],
): MIDIEndpointInfo[] => {
  return freeze(endpoints);
};

const freezeEndpoints = (endpoints: MIDIEndpoints): MIDIEndpoints => {
  return freeze({
    inputs: endpoints.inputs,
    outputs: endpoints.outputs,
  });
};

const WINDOWS_SUPPORT_INFO = freeze({
  supported: true,
  notifications: freeze({
    supported: true,
  }),
  virtual: freeze({
    supported: false,
    reason: 'Windows virtual MIDI ports require a native module update.',
  }),
}) satisfies MIDISupportResponse;

const EMPTY_ENDPOINTS = freezeEndpoints({
  inputs: freezeEndpointList([]),
  outputs: freezeEndpointList([]),
});

const endpointKey = (endpoint: MIDIEndpointInfo) => {
  return `${endpoint.portId}:${endpoint.name}`;
};

const endpointsEqual = (first: MIDIEndpointInfo, second: MIDIEndpointInfo) => {
  return first.name === second.name && first.portId === second.portId;
};

const reconcileEndpointList = (
  previous: MIDIEndpointInfo[],
  next: MIDIEndpointInfo[],
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
        : endpoint;

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

const reconcileMidiDeviceState = (previous: MIDIState, next: MIDIState) => {
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
  previous: MIDIEndpointInfo[],
  next: MIDIEndpointInfo[],
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
  previous: MIDIEndpoints,
  next: MIDIEndpoints,
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

const callNative = <Value>(operation: string, callback: () => Value): Value => {
  try {
    return callback();
  } catch (error) {
    throw toMIDINativeError(
      error,
      `Windows MIDI native operation ${operation} failed.`,
      operation,
    );
  }
};

const readRawMidiDeviceState = (
  nativeModule: NativeMIDIInterface,
): MIDIEndpoints => {
  return {
    inputs: assertEndpointInfoList(
      callNative('getInputs', () => nativeModule.getInputs()),
    ),
    outputs: assertEndpointInfoList(
      callNative('getOutputs', () => nativeModule.getOutputs()),
    ),
  };
};

const getNativeModule = (): NativeMIDIInterface => {
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
      join(packageRoot, 'native', 'out', 'midi-windows.node'),
    ),
  );

  for (const nativePath of resolvedPaths) {
    if (existsSync(nativePath)) {
      try {
        return assertNativeModule(requireNative(nativePath));
      } catch (error) {
        throw new MIDINativeError(
          'Windows MIDI native module failed to load.',
          {
            cause: error,
            operation: 'loadNativeModule',
          },
        );
      }
    }
  }

  throw new MIDINativeError(
    `Windows MIDI native module was not found. Tried: ${[...resolvedPaths].join(
      ', ',
    )}`,
  );
};

const createWindowsMIDIInput = (
  nativeInput: NativeMIDIInput,
  closeWhenRemovedFrom: keyof MIDIEndpoints,
): MIDIInput => {
  let closed = false;
  const events = new EventEmitter();
  const info = assertEndpointInfo(
    callNative('input.getInfo', () => nativeInput.getInfo()),
  );
  const messageListener = (message: number[]) => {
    events.emit(
      'message',
      createMIDIEvent<MIDIMessageEvent>({
        type: 'message',
        message: freeze([...message]),
      }),
    );
  };

  callNative('input.addMessageListener', () => {
    nativeInput.addMessageListener(messageListener);
  });

  const close = () => {
    if (closed) {
      return;
    }

    closed = true;
    openEndpointHandles.delete(endpointHandle);
    callNative('input.removeMessageListener', () => {
      nativeInput.removeMessageListener(messageListener);
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

const createWindowsMIDIOutput = (
  nativeOutput: NativeMIDIOutput,
  closeWhenRemovedFrom: keyof MIDIEndpoints,
): MIDIOutput => {
  let closed = false;
  const events = new EventEmitter();
  const info = assertEndpointInfo(
    callNative('output.getInfo', () => nativeOutput.getInfo()),
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

const createWindowsMIDIInterface = (
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
      return WINDOWS_SUPPORT_INFO;
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
    async openInput(endpoint: MIDIEndpointInfo) {
      const inputEndpoint = assertPublicEndpointInfo(endpoint, 'endpoint');
      return createWindowsMIDIInput(
        assertNativeInput(
          callNative('openInput', () => nativeModule.openInput(inputEndpoint)),
        ),
        'inputs',
      );
    },
    async openOutput(endpoint: MIDIEndpointInfo) {
      const outputEndpoint = assertPublicEndpointInfo(endpoint, 'endpoint');
      return createWindowsMIDIOutput(
        assertNativeOutput(
          callNative('openOutput', () =>
            nativeModule.openOutput(outputEndpoint),
          ),
        ),
        'outputs',
      );
    },
    async createVirtualInput() {
      throw new MIDINotImplementedError(
        'Windows virtual MIDI input support requires a native module update.',
      );
    },
    async createVirtualOutput() {
      throw new MIDINotImplementedError(
        'Windows virtual MIDI output support requires a native module update.',
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

export const loadNativeModuleWindows = (): MIDIInterface => {
  return createWindowsMIDIInterface(getNativeModule());
};
