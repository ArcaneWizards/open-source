import type { MidiEndpointInfo, MIDIInterface } from '../dist/index.cjs';
import { midi as midiInit } from '@arcanewizards/midi';

const suite = process.platform === 'darwin' ? describe : xdescribe;
const integrationMode = process.env.MIDI_TEST_MODE === 'integration';

const wait = (durationMs: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, durationMs);
  });

const hasMessage = (received: number[][], expected: number[]) =>
  received.some((message) => {
    return JSON.stringify(message) === JSON.stringify(expected);
  });

const waitForMessage = async (received: number[][], expected: number[]) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 2_000) {
    if (hasMessage(received, expected)) {
      return;
    }
    await wait(25);
  }

  throw new Error(
    `Expected MIDI message ${JSON.stringify(expected)} but received ${JSON.stringify(received)}.`,
  );
};

const readIntegrationEndpoint = (
  environmentVariable: string,
): MidiEndpointInfo => {
  const value = process.env[environmentVariable];
  if (!value) {
    throw new Error(
      `${environmentVariable} is required for integration tests.`,
    );
  }

  const endpoint = JSON.parse(value) as MidiEndpointInfo;
  if (
    typeof endpoint.name !== 'string' ||
    typeof endpoint.portId !== 'number'
  ) {
    throw new Error(`${environmentVariable} is not a valid MIDI endpoint.`);
  }

  return endpoint;
};

suite('macOS MIDI communication', () => {
  jest.setTimeout(10_000);

  let midi: MIDIInterface;

  beforeAll(async () => {
    midi = midiInit();

    const support = midi.getSupportInfo();
    expect(support.supported).toBe(true);
    if (!support.supported) {
      return;
    }
    expect(support.virtual.supported).toBe(true);
  });

  const virtualTest = integrationMode ? test.skip : test;
  const integrationTest = integrationMode ? test : test.skip;

  virtualTest('receives messages sent to a virtual input', async () => {
    const expected = [144, 60, 1];
    const received: number[][] = [];
    const input = midi.createVirtualInput(
      `Arcane Wizards Jest Virtual Input ${Date.now()}`,
    );
    let output: ReturnType<MIDIInterface['openOutput']> | undefined;

    try {
      input.addMessageListener((message) => {
        received.push(message);
      });

      output = midi.openOutput(input.getInfo());
      await wait(100);
      output.sendMessage(expected);

      await waitForMessage(received, expected);
      expect(hasMessage(received, expected)).toBe(true);
    } finally {
      output?.close();
      input.close();
    }
  });

  virtualTest('receives messages emitted by a virtual output', async () => {
    const expected = [144, 62, 3];
    const received: number[][] = [];
    const output = midi.createVirtualOutput(
      `Arcane Wizards Jest Virtual Output ${Date.now()}`,
    );
    let input: ReturnType<MIDIInterface['openInput']> | undefined;

    try {
      input = midi.openInput(output.getInfo());
      input.addMessageListener((message) => {
        received.push(message);
      });

      await wait(100);
      output.sendMessage(expected);

      await waitForMessage(received, expected);
      expect(hasMessage(received, expected)).toBe(true);
    } finally {
      input?.close();
      output.close();
    }
  });

  integrationTest(
    'real device loopback receives output messages on input',
    async () => {
      const inputInfo = readIntegrationEndpoint('MIDI_INTEGRATION_INPUT');
      const outputInfo = readIntegrationEndpoint('MIDI_INTEGRATION_OUTPUT');
      const expected = [144, 60, 1];
      const received: number[][] = [];
      const input = midi.openInput(inputInfo);
      const output = midi.openOutput(outputInfo);

      try {
        input.addMessageListener((message) => {
          received.push(message);
        });

        await wait(100);
        output.sendMessage(expected);

        await waitForMessage(received, expected);
        expect(hasMessage(received, expected)).toBe(true);
      } finally {
        output.close();
        input.close();
      }
    },
  );
});
