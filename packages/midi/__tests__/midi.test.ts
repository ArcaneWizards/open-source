import type {
  MidiEndpointInfo,
  MIDIEndpointClosedEvent,
  MIDIEndpointsChangedEvent,
  MIDIInput,
  MIDIInterface,
  MIDIMessageEvent,
  MIDIOutput,
} from '../dist/index.cjs';
import {
  MIDIEndpointClosedError,
  midi as midiInit,
} from '@arcanewizards/midi';

const virtualMode = process.env.MIDI_TEST_MODE === 'virtual';
const integrationMode = process.env.MIDI_TEST_MODE === 'integration';
const suite =
  process.platform === 'darwin' ||
  (integrationMode && process.platform === 'win32')
    ? describe
    : xdescribe;

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

const hasEndpoint = (endpoints: MidiEndpointInfo[], name: string) =>
  endpoints.some((endpoint) => endpoint.name === name);

const endpointMatches = (
  endpoint: MidiEndpointInfo,
  expected: MidiEndpointInfo,
) => endpoint.portId === expected.portId && endpoint.name === expected.name;

const waitForEndpointState = async (
  readEndpoints: () => Promise<MidiEndpointInfo[]>,
  name: string,
  expectedPresent: boolean,
) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 2_000) {
    const endpoints = await readEndpoints();
    if (hasEndpoint(endpoints, name) === expectedPresent) {
      return endpoints;
    }
    await wait(25);
  }

  const endpoints = await readEndpoints();
  throw new Error(
    `Expected endpoint "${name}" present=${expectedPresent} but received ${JSON.stringify(endpoints)}.`,
  );
};

const recordEvents = <Event>() => {
  const events: Event[] = [];
  return {
    events,
    listener(event: Event) {
      events.push(event);
    },
  };
};

const waitForRecordedEvent = async <Event>(
  events: Event[],
  predicate: (event: Event) => boolean = () => true,
) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 2_000) {
    const event = events.find(predicate);
    if (event) {
      return event;
    }
    await wait(25);
  }

  throw new Error(`Expected recorded event but received ${events.length}.`);
};

const waitForClosedEvent = (
  events: MIDIEndpointClosedEvent[],
  endpoint: MidiEndpointInfo,
) => {
  return waitForRecordedEvent(events, (event) =>
    endpointMatches(event.endpoint, endpoint),
  );
};

const waitForEndpointRemovedEvent = (
  events: MIDIEndpointsChangedEvent[],
  direction: keyof Pick<MIDIEndpointsChangedEvent['removed'], 'inputs' | 'outputs'>,
  name: string,
) => {
  return waitForRecordedEvent(events, (event) =>
    hasEndpoint(event.removed[direction], name),
  );
};

const readIntegrationEndpoint = (
  environmentVariable: string,
): MidiEndpointInfo => {
  const value = process.env[environmentVariable];
  if (!value) {
    throw new Error(`${environmentVariable} is required for integration tests.`);
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

suite('MIDI integration', () => {
  jest.setTimeout(10_000);

  let midi: MIDIInterface;
  let virtualSupported = false;

  beforeAll(async () => {
    midi = midiInit();

    const support = await midi.getSupportInfo();
    expect(support.supported).toBe(true);
    if (!support.supported) {
      return;
    }
    virtualSupported = support.virtual.supported;
    expect(support.virtual.supported).toBe(process.platform === 'darwin');
  });

  const virtualTest =
    virtualMode && process.platform === 'darwin' ? test : test.skip;
  const integrationTest = integrationMode ? test : test.skip;

  virtualTest('receives messages sent to a virtual input', async () => {
    const expected = [144, 60, 1];
    const received: number[][] = [];
    const input = await midi.createVirtualInput(
      `Arcane Wizards Jest Virtual Input ${Date.now()}`,
    );
    let output: MIDIOutput | undefined;

    try {
      input.addEventListener('message', (event: MIDIMessageEvent) => {
        received.push([...event.message]);
      });

      output = await midi.openOutput(input.getInfo());
      await wait(100);
      await output.sendMessage(expected);

      await waitForMessage(received, expected);
      expect(hasMessage(received, expected)).toBe(true);
    } finally {
      await output?.close();
      await input.close();
    }
  });

  virtualTest('receives messages emitted by a virtual output', async () => {
    const expected = [144, 62, 3];
    const received: number[][] = [];
    const output = await midi.createVirtualOutput(
      `Arcane Wizards Jest Virtual Output ${Date.now()}`,
    );
    let input: MIDIInput | undefined;

    try {
      input = await midi.openInput(output.getInfo());
      input.addEventListener('message', (event: MIDIMessageEvent) => {
        received.push([...event.message]);
      });

      await wait(100);
      await output.sendMessage(expected);

      await waitForMessage(received, expected);
      expect(hasMessage(received, expected)).toBe(true);
    } finally {
      await input?.close();
      await output.close();
    }
  });

  virtualTest(
    'keeps output list up-to-date when a virtual input is created and closed',
    async () => {
      if (!virtualSupported) {
        return;
      }

      const name = `Arcane Wizards Jest Virtual Input Cache ${Date.now()}`;
      let input: MIDIInput | undefined;

      expect(hasEndpoint(await midi.getOutputs(), name)).toBe(false);

      try {
        input = await midi.createVirtualInput(name);
        expect(
          hasEndpoint(
            await waitForEndpointState(() => midi.getOutputs(), name, true),
            name,
          ),
        ).toBe(true);
      } finally {
        await input?.close();
      }

      expect(
        hasEndpoint(
          await waitForEndpointState(() => midi.getOutputs(), name, false),
          name,
        ),
      ).toBe(false);
    },
  );

  virtualTest(
    'keeps input list up-to-date when a virtual output is created and closed',
    async () => {
      if (!virtualSupported) {
        return;
      }

      const name = `Arcane Wizards Jest Virtual Output Cache ${Date.now()}`;
      let output: MIDIOutput | undefined;

      expect(hasEndpoint(await midi.getInputs(), name)).toBe(false);

      try {
        output = await midi.createVirtualOutput(name);
        expect(
          hasEndpoint(
            await waitForEndpointState(() => midi.getInputs(), name, true),
            name,
          ),
        ).toBe(true);
      } finally {
        await output?.close();
      }

      expect(
        hasEndpoint(
          await waitForEndpointState(() => midi.getInputs(), name, false),
          name,
        ),
      ).toBe(false);
    },
  );

  virtualTest(
    'virtual input close emits closed on local input and opened output',
    async () => {
      const name = `Arcane Wizards Jest Virtual Input Closed ${Date.now()}`;
      const endpointChanges = recordEvents<MIDIEndpointsChangedEvent>();
      const inputClosed = recordEvents<MIDIEndpointClosedEvent>();
      const outputClosed = recordEvents<MIDIEndpointClosedEvent>();
      let input: MIDIInput | undefined;
      let output: MIDIOutput | undefined;

      midi.addEventListener('endpointschanged', endpointChanges.listener);

      try {
        await midi.getOutputs();
        input = await midi.createVirtualInput(name);
        input.addEventListener('closed', inputClosed.listener);
        await waitForEndpointState(() => midi.getOutputs(), name, true);

        output = await midi.openOutput(input.getInfo());
        output.addEventListener('closed', outputClosed.listener);

        await input.close();

        await waitForClosedEvent(inputClosed.events, input.getInfo());
        await waitForClosedEvent(outputClosed.events, output.getInfo());
        await waitForEndpointRemovedEvent(
          endpointChanges.events,
          'outputs',
          name,
        );
        await expect(output.sendMessage([144, 64, 1])).rejects.toBeInstanceOf(
          MIDIEndpointClosedError,
        );
      } finally {
        midi.removeEventListener('endpointschanged', endpointChanges.listener);
        await output?.close();
        await input?.close();
      }
    },
  );

  virtualTest(
    'virtual output close emits closed on local output and opened input',
    async () => {
      const name = `Arcane Wizards Jest Virtual Output Closed ${Date.now()}`;
      const endpointChanges = recordEvents<MIDIEndpointsChangedEvent>();
      const outputClosed = recordEvents<MIDIEndpointClosedEvent>();
      const inputClosed = recordEvents<MIDIEndpointClosedEvent>();
      let output: MIDIOutput | undefined;
      let input: MIDIInput | undefined;

      midi.addEventListener('endpointschanged', endpointChanges.listener);

      try {
        await midi.getInputs();
        output = await midi.createVirtualOutput(name);
        output.addEventListener('closed', outputClosed.listener);
        await waitForEndpointState(() => midi.getInputs(), name, true);

        input = await midi.openInput(output.getInfo());
        input.addEventListener('closed', inputClosed.listener);

        await output.close();

        await waitForClosedEvent(outputClosed.events, output.getInfo());
        await waitForClosedEvent(inputClosed.events, input.getInfo());
        await waitForEndpointRemovedEvent(
          endpointChanges.events,
          'inputs',
          name,
        );
      } finally {
        midi.removeEventListener('endpointschanged', endpointChanges.listener);
        await input?.close();
        await output?.close();
      }
    },
  );

  virtualTest(
    'closing an opened output emits closed without removing the endpoint',
    async () => {
      const name = `Arcane Wizards Jest Opened Output Closed ${Date.now()}`;
      const closed = recordEvents<MIDIEndpointClosedEvent>();
      const virtualInput = await midi.createVirtualInput(name);
      let output: MIDIOutput | undefined;

      try {
        await waitForEndpointState(() => midi.getOutputs(), name, true);
        output = await midi.openOutput(virtualInput.getInfo());
        output.addEventListener('closed', closed.listener);

        await output.close();

        await waitForClosedEvent(closed.events, output.getInfo());
        expect(hasEndpoint(await midi.getOutputs(), name)).toBe(true);
        await expect(output.sendMessage([144, 65, 1])).rejects.toBeInstanceOf(
          MIDIEndpointClosedError,
        );
      } finally {
        await output?.close();
        await virtualInput.close();
      }
    },
  );

  virtualTest(
    'closing an opened input emits closed without removing the endpoint',
    async () => {
      const name = `Arcane Wizards Jest Opened Input Closed ${Date.now()}`;
      const closed = recordEvents<MIDIEndpointClosedEvent>();
      const virtualOutput = await midi.createVirtualOutput(name);
      let input: MIDIInput | undefined;

      try {
        await waitForEndpointState(() => midi.getInputs(), name, true);
        input = await midi.openInput(virtualOutput.getInfo());
        input.addEventListener('closed', closed.listener);

        await input.close();

        await waitForClosedEvent(closed.events, input.getInfo());
        expect(hasEndpoint(await midi.getInputs(), name)).toBe(true);
      } finally {
        await input?.close();
        await virtualOutput.close();
      }
    },
  );

  integrationTest(
    'real device loopback receives output messages on input',
    async () => {
      const inputInfo = readIntegrationEndpoint('MIDI_INTEGRATION_INPUT');
      const outputInfo = readIntegrationEndpoint('MIDI_INTEGRATION_OUTPUT');
      const expected = [144, 60, 1];
      const received: number[][] = [];
      const input = await midi.openInput(inputInfo);
      const output = await midi.openOutput(outputInfo);

      try {
        input.addEventListener('message', (event: MIDIMessageEvent) => {
          received.push([...event.message]);
        });

        await wait(100);
        await output.sendMessage(expected);

        await waitForMessage(received, expected);
        expect(hasMessage(received, expected)).toBe(true);
      } finally {
        await output.close();
        await input.close();
      }
    },
  );
});
