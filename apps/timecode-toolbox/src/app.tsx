import {
  AppShell,
  AppListenerManager,
  SigilRuntimeAppProps,
} from '@arcanewizards/sigil';
import { JSX, ReactNode, useEffect, useState } from 'react';
import { C } from './components/backend';
import { ToolboxConfigData } from './config';
import path from 'node:path';
import { useDataFileContext } from '@arcanejs/react-toolkit/data';
import {
  ApplicationState,
  DEFAULT_CONFIG,
  ToolboxConfig,
} from './components/proto';
import { patchJson, Diff } from '@arcanejs/diff';
import { InputConnections } from './inputs';
import { OutputConnections } from './outputs';

export type AppApi = Record<never, never>;

export type TimecodeToolboxAppProps = {
  dataDirectory: string;
};

export type AppProps = SigilRuntimeAppProps<AppApi, TimecodeToolboxAppProps>;

export const App = ({
  title,
  version,
  toolkit,
  dataDirectory,
  logger,
  logEventEmitter,
  setWindowUrl,
  shutdownContext,
}: AppProps): ReactNode => {
  const { data, error, updateData, resetData } =
    useDataFileContext(ToolboxConfigData);

  useEffect(() => {
    if (error) {
      logger.warn('Resetting config to application default');
      resetData();
    }
  }, [logger, error, resetData]);

  const onUpdateConfig = (diff: Diff<ToolboxConfig>) => {
    updateData((prev) => patchJson(prev, diff) ?? DEFAULT_CONFIG);
  };

  const [state, setState] = useState<ApplicationState>({
    inputs: {},
    outputs: {},
  });

  return (
    <AppShell
      title={title}
      version={version}
      dataDirectory={dataDirectory}
      logger={logger}
      logEventEmitter={logEventEmitter}
      shutdownContext={shutdownContext}
    >
      <C.ToolboxRoot
        config={data}
        state={state}
        onUpdateConfig={onUpdateConfig}
      />
      <InputConnections state={state} setState={setState} />
      <OutputConnections state={state} setState={setState} />
      <AppListenerManager
        toolkit={toolkit}
        setWindowUrl={setWindowUrl}
        listenerConfig={{
          default: {
            port: {
              from: 4100,
              to: 4200,
            },
          },
        }}
      />
    </AppShell>
  );
};

export const createApp = (props: AppProps): JSX.Element => {
  return (
    <ToolboxConfigData.Provider
      path={path.join(props.dataDirectory, 'config.json')}
    >
      <App {...props} />
    </ToolboxConfigData.Provider>
  );
};
