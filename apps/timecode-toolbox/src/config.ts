import { createDataFileDefinition } from '@arcanejs/react-toolkit/data';
import { DEFAULT_CONFIG, TOOLBOX_CONFIG } from './components/proto';

export const ToolboxConfigData = createDataFileDefinition({
  schema: TOOLBOX_CONFIG,
  defaultValue: DEFAULT_CONFIG,
});
