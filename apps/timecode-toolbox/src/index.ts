import { CoreComponents } from '@arcanejs/react-toolkit';
import {
  runSigilApp,
  SigilAppInstance,
  SIGIL_COMPONENTS,
} from '@arcanewizards/sigil';
import { ToolkitOptions } from '@arcanejs/toolkit';
import pino from 'pino';
import { AppApi, createApp, TimecodeToolboxAppProps } from './app';
import { C } from './components/backend';
import { version } from '../package.json';

export type { AppApi };

export type TimecodeToolboxOptions = {
  logger: pino.Logger;
  appProps: TimecodeToolboxAppProps;
  toolkitOptions?: Omit<Partial<ToolkitOptions>, 'logger'>;
  title: string;
};

export const runTimecodeToolboxServer = ({
  logger,
  appProps,
  toolkitOptions,
  title,
}: TimecodeToolboxOptions): SigilAppInstance<AppApi> =>
  runSigilApp<AppApi, TimecodeToolboxAppProps>({
    logger,
    title,
    version,
    appProps,
    toolkitOptions,
    createApp,
    componentNamespaces: [CoreComponents, SIGIL_COMPONENTS, C],
  });
