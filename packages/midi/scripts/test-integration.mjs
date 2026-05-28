/* eslint-disable no-console */

import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const loadMidi = async () => {
  const { midi } = await import('../dist/index.js');
  return midi();
};

const listEndpoints = (label, endpoints) => {
  console.log(`${label}:`);
  if (endpoints.length === 0) {
    console.log('  (none)');
    return;
  }

  endpoints.forEach((endpoint, index) => {
    console.log(`  [${index}] ${endpoint.name} (portId: ${endpoint.portId})`);
  });
};

const findEndpoint = (selector, endpoints, label) => {
  if (!selector) {
    throw new Error(`Missing ${label} selector.`);
  }

  const byIndex = Number.parseInt(selector, 10);
  if (
    Number.isInteger(byIndex) &&
    String(byIndex) === selector &&
    endpoints[byIndex]
  ) {
    return endpoints[byIndex];
  }

  const byPortId = endpoints.find((endpoint) => {
    return String(endpoint.portId) === selector;
  });
  if (byPortId) {
    return byPortId;
  }

  const byName = endpoints.find((endpoint) => endpoint.name === selector);
  if (byName) {
    return byName;
  }

  const byNameFragment = endpoints.filter((endpoint) => {
    return endpoint.name.toLowerCase().includes(selector.toLowerCase());
  });
  if (byNameFragment.length === 1) {
    return byNameFragment[0];
  }

  if (byNameFragment.length > 1) {
    throw new Error(
      `${label} selector "${selector}" matched multiple endpoints: ${byNameFragment
        .map((endpoint) => endpoint.name)
        .join(', ')}`,
    );
  }

  throw new Error(`Could not find ${label} endpoint matching "${selector}".`);
};

const assertSupported = (midi) => {
  const support = midi.getSupportInfo();
  if (!support.supported) {
    throw new Error(`MIDI is not supported: ${support.reason}`);
  }
};

const list = async () => {
  const midi = await loadMidi();
  assertSupported(midi);
  listEndpoints('Inputs', midi.getInputs());
  listEndpoints('Outputs', midi.getOutputs());
};

const runJest = (input, output) => {
  const child = spawn(
    'jest',
    ['--runInBand', '--testNamePattern', 'real device loopback'],
    {
      cwd: packageRoot,
      env: {
        ...process.env,
        MIDI_TEST_MODE: 'integration',
        MIDI_INTEGRATION_INPUT: JSON.stringify(input),
        MIDI_INTEGRATION_OUTPUT: JSON.stringify(output),
      },
      shell: process.platform === 'win32',
      stdio: 'inherit',
    },
  );

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 1);
  });
};

const run = async ([inputSelector, outputSelector]) => {
  const midi = await loadMidi();
  assertSupported(midi);

  const input = findEndpoint(inputSelector, midi.getInputs(), 'input');
  const output = findEndpoint(outputSelector, midi.getOutputs(), 'output');

  console.log(`Input: ${input.name} (portId: ${input.portId})`);
  console.log(`Output: ${output.name} (portId: ${output.portId})`);

  runJest(input, output);
};

const [command, ...rawArgs] = process.argv.slice(2);
const args = rawArgs[0] === '--' ? rawArgs.slice(1) : rawArgs;

try {
  if (command === 'list') {
    await list();
  } else if (command === 'run') {
    await run(args);
  } else {
    throw new Error(
      'Usage: test-integration.mjs list | test-integration.mjs run <input> <output>',
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
