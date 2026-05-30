/* eslint-disable no-console */
import midi, { MidiEndpointInfo, MIDIOutput } from '@arcanewizards/midi';

import { createMIDITimecodeSender } from '../src/index.js';

const run = async () => {
  const m = midi();

  const portIdString = process.argv[2];

  let selectedPort: MidiEndpointInfo | null = null;

  if (portIdString?.trim()) {
    const portId = parseInt(portIdString, 10);
    for (const port of await m.getOutputs()) {
      if (port.portId === portId || port.name === portIdString) {
        selectedPort = port;
        break;
      }
    }
  }

  let output: MIDIOutput;
  if (selectedPort) {
    console.log('Selected MIDI output port:', selectedPort.name);
    output = await m.openOutput(selectedPort);
  } else {
    const name = `MIDI Timecode Virtual Output${portIdString ? ` (${portIdString})` : ''}`;
    console.log(`Creating virtual output with name "${name}"`);
    output = await m.createVirtualOutput(name);
  }

  console.log('Sending MIDI Timecode messages to output...');

  const sender = createMIDITimecodeSender({
    sendMessage: output.sendMessage,
    mode: 'SMPTE',
  });

  const sendPlayState = () => {
    sender.setPlayState({
      state: 'playing',
      effectiveStartTime: Date.now() - Math.random() * 1000,
      speed: 1,
    });
  };

  setInterval(sendPlayState, 10_000);

  sendPlayState();
};

run().catch((err) => {
  console.error('Error running MIDI send:', err);
  process.exit(1);
});
