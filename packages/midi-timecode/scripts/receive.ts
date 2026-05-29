/* eslint-disable no-console */
import midi, { MidiEndpointInfo, MIDIInput } from '@arcanewizards/midi';

import { createMIDITimecodeReceiver } from '../src/index.js';

const run = async () => {
  const m = midi();

  const portIdString = process.argv[2];

  let selectedPort: MidiEndpointInfo | null = null;

  if (portIdString?.trim()) {
    const portId = parseInt(portIdString, 10);
    for (const port of await m.getInputs()) {
      if (port.portId === portId || port.name === portIdString) {
        selectedPort = port;
        break;
      }
    }
  }

  let input: MIDIInput;
  if (selectedPort) {
    console.log('Selected MIDI input port:', selectedPort.name);
    input = await m.openInput(selectedPort);
  } else {
    const name = `MIDI Timecode Virtual Input${portIdString ? ` (${portIdString})` : ''}`;
    console.log(`Creating virtual output with name "${name}"`);
    input = await m.createVirtualInput(name);
  }

  console.log('Receiving MIDI Timecode messages from input...');

  const receiver = createMIDITimecodeReceiver({
    handlePlayStateChange: (state) => {
      console.log('Play state changed:', state);
    },
  });

  input.addEventListener('message', (event) => {
    receiver.receiveMessage(event.message);
  });
};

run().catch((err) => {
  console.error('Error running MIDI receive:', err);
  process.exit(1);
});
