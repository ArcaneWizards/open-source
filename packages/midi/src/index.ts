import { MIDIInterface } from './types.js';

export type {
  MIDIInterface,
  MIDIInput,
  MIDIOutput,
  MidiEndpointInfo,
  SupportResponse,
} from './types.js';

const DEFAULT_MIDI_INTERFACE: MIDIInterface = {
  getSupportInfo() {
    return {
      supported: false,
      reason: 'MIDI support is not implemented in this environment.',
    };
  },
  getInputs() {
    return [];
  },
  getOutputs() {
    return [];
  },
  openInput() {
    throw new Error('MIDI support is not implemented in this environment.');
  },
  openOutput() {
    throw new Error('MIDI support is not implemented in this environment.');
  },
  createVirtualInput() {
    throw new Error('MIDI support is not implemented in this environment.');
  },
  createVirtualOutput() {
    throw new Error('MIDI support is not implemented in this environment.');
  },
};

export const midi = () => {
  return DEFAULT_MIDI_INTERFACE;
};

export default midi;
