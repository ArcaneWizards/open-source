import { MIDIInterface } from '../dist/index.cjs';

const suite = process.platform === 'darwin' ? describe : xdescribe;

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

suite('macOS MIDI virtual communication', () => {
  jest.setTimeout(10_000);

  let midi: MIDIInterface;

  beforeAll(async () => {
    const module = (await import('../dist/index.cjs')) as {
      midi(): MIDIInterface;
    };
    midi = module.midi();

    const support = midi.getSupportInfo();
    expect(support.supported).toBe(true);
    if (!support.supported) {
      return;
    }
    expect(support.virtual.supported).toBe(true);
  });

  test('receives messages sent to a virtual input', async () => {
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

  test('receives messages emitted by a virtual output', async () => {
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
});
