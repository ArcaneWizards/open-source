import { MIDIInterface } from './types.js';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);

const getNativeModule = (): MIDIInterface => {
  const packageRoot = dirname(
    require.resolve('@arcanewizards/midi/package.json'),
  );
  const nativePath = join(packageRoot, 'native', 'dist', 'midi-windows.node');
  return require(nativePath);
};

export const loadNativeModuleWindows = (): MIDIInterface => {
  return getNativeModule();
};
