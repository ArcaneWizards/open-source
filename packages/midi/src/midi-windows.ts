import type { MIDIInterface } from './types.js';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const requireNative = createRequire(join(process.cwd(), 'package.json'));

const getNativeModule = (): MIDIInterface => {
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

  const resolvedPaths = new Set(
    packageRootCandidates.map((packageRoot) =>
      join(packageRoot, 'native', 'out', 'midi-windows.node'),
    ),
  );

  for (const nativePath of resolvedPaths) {
    if (existsSync(nativePath)) {
      return requireNative(nativePath);
    }
  }

  throw new Error(
    `Windows MIDI native module was not found. Tried: ${[...resolvedPaths].join(
      ', ',
    )}`,
  );
};

export const loadNativeModuleWindows = (): MIDIInterface => {
  return getNativeModule();
};
