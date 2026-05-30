import { loadNativeModuleMacOS } from './midi-macos.js';
import { loadNativeModuleWindows } from './midi-windows.js';
import { MIDINotSupportedError } from './errors.js';
import type { MIDIInterface } from './types.js';

export {
  MIDIEndpointClosedError,
  MIDIEndpointNotFoundError,
  MIDIError,
  MIDIInvalidArgumentError,
  MIDINativeError,
  MIDINotImplementedError,
  MIDINotSupportedError,
} from './errors.js';

export type { MIDIErrorCode, MIDIErrorOptions } from './errors.js';

export type {
  MIDIEndpointClosedEvent,
  MIDIEndpointsChangedEvent,
  MIDIErrorEvent,
  MIDIEvent,
  MIDIEventListener,
  MIDIInputEventMap,
  MIDIInterface,
  MIDIInterfaceEventMap,
  MIDIInput,
  MIDIMessageEvent,
  MIDIOutput,
  MIDIOutputEventMap,
  MIDISupportResponse,
  MIDIEndpointInfo as MidiEndpointInfo,
  MIDIEndpoints as MidiEndpoints,
  VirtualPortOptions,
} from './types.js';

const DEFAULT_MIDI_INTERFACE: MIDIInterface = {
  async getSupportInfo() {
    return {
      supported: false,
      reason: 'MIDI support is not implemented in this environment.',
    };
  },
  async getEndpoints() {
    return {
      inputs: [],
      outputs: [],
    };
  },
  async getInputs() {
    return [];
  },
  async getOutputs() {
    return [];
  },
  async openInput() {
    throw new MIDINotSupportedError(
      'MIDI support is not implemented in this environment.',
    );
  },
  async openOutput() {
    throw new MIDINotSupportedError(
      'MIDI support is not implemented in this environment.',
    );
  },
  async createVirtualInput() {
    throw new MIDINotSupportedError(
      'MIDI support is not implemented in this environment.',
    );
  },
  async createVirtualOutput() {
    throw new MIDINotSupportedError(
      'MIDI support is not implemented in this environment.',
    );
  },
  addEventListener() {},
  removeEventListener() {},
};

export const midi = () => {
  if (process.platform === 'darwin') {
    return loadNativeModuleMacOS();
  }
  if (process.platform === 'win32') {
    return loadNativeModuleWindows();
  }
  return DEFAULT_MIDI_INTERFACE;
};
