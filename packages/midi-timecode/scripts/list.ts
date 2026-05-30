/* eslint-disable no-console */
import { midi } from '@arcanewizards/midi';

const run = async () => {
  const m = midi();

  const [outputs, inputs] = await Promise.all([m.getOutputs(), m.getInputs()]);

  console.log('MIDI Outputs:', outputs);
  console.log('MIDI Inputs:', inputs);
};

run().catch((err) => {
  console.error('Error running MIDI list:', err);
  process.exit(1);
});
