import { prepareComponents } from '@arcanejs/react-toolkit';
import { ToolboxRoot } from './toolbox-root';
import { LicenseGate } from './license-gate';

export const C = prepareComponents('timecode-toolbox', {
  ToolboxRoot,
  LicenseGate,
});
