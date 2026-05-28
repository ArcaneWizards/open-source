import { MIDIInterface } from './types.js';
import { dirname, join } from 'node:path';

const getNativeModule = () => {
  const packageRoot = dirname(
    require.resolve('@arcanewizards/midi/package.json'),
  );
  const nativePath = join(packageRoot, 'native', 'dist', 'midi-macos.node');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require(nativePath);
};

export const loadNativeModuleMacOS = (): MIDIInterface => {
  const _m = getNativeModule();
  throw new Error('Not Implemented');
};
