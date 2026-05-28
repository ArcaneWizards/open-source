import type {
  MidiEndpointInfo,
  MIDIInput,
  MIDIInterface,
  MIDIOutput,
  SupportResponse,
  VirtualPortOptions,
} from './types.js';
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
  getSupportInfo(): SupportResponse;
  getInputs(): MidiEndpointInfo[];
  getOutputs(): MidiEndpointInfo[];
  openInput(endpoint: MidiEndpointInfo): NativeMIDIInput;
  openOutput(endpoint: MidiEndpointInfo): NativeMIDIOutput;
  createVirtualInput(
    name: string,
    options?: VirtualPortOptions,
  ): NativeMIDIInput;
  createVirtualOutput(
    name: string,
    options?: VirtualPortOptions,
  ): NativeMIDIOutput;
};

const requireNative = createRequire(join(process.cwd(), 'package.json'));

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

function assertFunction(
  value: unknown,
  name: string,
): asserts value is (...args: unknown[]) => unknown {
  if (typeof value !== 'function') {
    throw new Error(`MacOS MIDI native module is missing ${name}().`);
  }
}

const assertEndpointInfo = (value: unknown): MidiEndpointInfo => {
  if (
    !isRecord(value) ||
    typeof value.name !== 'string' ||
    typeof value.portId !== 'number'
  ) {
    throw new Error('MacOS MIDI native module returned an invalid endpoint.');
  }

  return {
    name: value.name,
    portId: value.portId,
  };
};

const assertEndpointInfoList = (value: unknown): MidiEndpointInfo[] => {
  if (!Array.isArray(value)) {
    throw new Error(
      'MacOS MIDI native module returned an invalid endpoint list.',
    );
  }

  return value.map((endpoint) => assertEndpointInfo(endpoint));
};

const assertNativeInput = (value: unknown): NativeMIDIInput => {
  if (!isRecord(value)) {
    throw new Error('MacOS MIDI native module returned an invalid input.');
  }

  assertFunction(value.getInfo, 'input.getInfo');
  assertFunction(value.setMessageCallback, 'input.setMessageCallback');
  assertFunction(value.close, 'input.close');

  return value as NativeMIDIInput;
};

const assertNativeOutput = (value: unknown): NativeMIDIOutput => {
  if (!isRecord(value)) {
    throw new Error('MacOS MIDI native module returned an invalid output.');
  }

  assertFunction(value.getInfo, 'output.getInfo');
  assertFunction(value.sendMessage, 'output.sendMessage');
  assertFunction(value.close, 'output.close');

  return value as NativeMIDIOutput;
};

const assertSupportResponse = (value: unknown): SupportResponse => {
  if (!isRecord(value) || typeof value.supported !== 'boolean') {
    throw new Error('MacOS MIDI native module returned invalid support info.');
  }

  if (!value.supported) {
    if (typeof value.reason !== 'string') {
      throw new Error(
        'MacOS MIDI native module returned invalid support info.',
      );
    }
    return {
      supported: false,
      reason: value.reason,
    };
  }

  if (
    !isRecord(value.virtual) ||
    typeof value.virtual.supported !== 'boolean'
  ) {
    throw new Error('MacOS MIDI native module returned invalid support info.');
  }

  if (value.virtual.supported) {
    return {
      supported: true,
      virtual: {
        supported: true,
      },
    };
  }

  if (typeof value.virtual.reason !== 'string') {
    throw new Error('MacOS MIDI native module returned invalid support info.');
  }

  return {
    supported: true,
    virtual: {
      supported: false,
      reason: value.virtual.reason,
    },
  };
};

class MacOSMIDIInput implements MIDIInput {
  #closed = false;
  #listeners = new Set<(message: number[]) => void>();

  constructor(private readonly nativeInput: NativeMIDIInput) {
    this.nativeInput.setMessageCallback((message) => {
      for (const listener of this.#listeners) {
        listener(message);
      }
    });
  }

  getInfo() {
    return assertEndpointInfo(this.nativeInput.getInfo());
  }

  addMessageListener(listener: (message: number[]) => void) {
    if (this.#closed) {
      throw new Error('MIDI input is closed.');
    }
    this.#listeners.add(listener);
  }

  removeMessageListener(listener: (message: number[]) => void) {
    this.#listeners.delete(listener);
  }

  close() {
    if (this.#closed) {
      return;
    }

    this.#closed = true;
    this.#listeners.clear();
    this.nativeInput.setMessageCallback(null);
    this.nativeInput.close();
  }
}

class MacOSMIDIOutput implements MIDIOutput {
  #closed = false;

  constructor(private readonly nativeOutput: NativeMIDIOutput) {}

  getInfo() {
    return assertEndpointInfo(this.nativeOutput.getInfo());
  }

  sendMessage(message: number[]) {
    if (this.#closed) {
      throw new Error('MIDI output is closed.');
    }
    this.nativeOutput.sendMessage(message);
  }

  close() {
    if (this.#closed) {
      return;
    }

    this.#closed = true;
    this.nativeOutput.close();
  }
}

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

  for (const packageRoot of packageRootCandidates) {
    const nativePath = join(packageRoot, 'native', 'dist', 'midi-macos.node');
    if (existsSync(nativePath)) {
      return requireNative(nativePath) as unknown;
    }
  }

  throw new Error(
    `MacOS MIDI native module was not found. Tried: ${packageRootCandidates
      .map((packageRoot) =>
        join(packageRoot, 'native', 'dist', 'midi-macos.node'),
      )
      .join(', ')}`,
  );
};

const assertNativeModule = (value: unknown): NativeMIDIInterface => {
  if (!isRecord(value)) {
    throw new Error('MacOS MIDI native module did not load correctly.');
  }

  assertFunction(value.getSupportInfo, 'getSupportInfo');
  assertFunction(value.getInputs, 'getInputs');
  assertFunction(value.getOutputs, 'getOutputs');
  assertFunction(value.openInput, 'openInput');
  assertFunction(value.openOutput, 'openOutput');
  assertFunction(value.createVirtualInput, 'createVirtualInput');
  assertFunction(value.createVirtualOutput, 'createVirtualOutput');

  return value as NativeMIDIInterface;
};

export const loadNativeModuleMacOS = (): MIDIInterface => {
  const nativeModule = assertNativeModule(getNativeModule());

  return {
    getSupportInfo() {
      return assertSupportResponse(nativeModule.getSupportInfo());
    },
    getInputs() {
      return assertEndpointInfoList(nativeModule.getInputs());
    },
    getOutputs() {
      return assertEndpointInfoList(nativeModule.getOutputs());
    },
    openInput(endpoint) {
      return new MacOSMIDIInput(
        assertNativeInput(nativeModule.openInput(endpoint)),
      );
    },
    openOutput(endpoint) {
      return new MacOSMIDIOutput(
        assertNativeOutput(nativeModule.openOutput(endpoint)),
      );
    },
    createVirtualInput(name, options) {
      return new MacOSMIDIInput(
        assertNativeInput(nativeModule.createVirtualInput(name, options)),
      );
    },
    createVirtualOutput(name, options) {
      return new MacOSMIDIOutput(
        assertNativeOutput(nativeModule.createVirtualOutput(name, options)),
      );
    },
  };
};
