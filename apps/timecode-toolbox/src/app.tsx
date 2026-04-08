import {
  AppShell,
  AppListenerManager,
  SigilRuntimeAppProps,
} from '@arcanewizards/sigil';
import {
  JSX,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { C } from './components/backend';
import { ToolboxConfigData } from './config';
import path from 'node:path';
import { useDataFileContext } from '@arcanejs/react-toolkit/data';
import {
  ApplicationState,
  AvailableHandlers,
  DEFAULT_CONFIG,
  TimecodeHandlerMethods,
  ToolboxConfig,
  ToolboxRootCallHandler,
  UpdateCheckResult,
} from './components/proto';
import { patchJson, Diff } from '@arcanejs/diff';
import { InputConnections } from './inputs';
import { OutputConnections } from './outputs';
import { Generators } from './generators';
import { TimecodeHandlers } from './types';
import { getTreeValue, mapTree, Tree } from './tree';
import { useLicense } from './license';
import { UpdateChecker } from './updates';
import { getEnv } from './env';

export type AppApi = Record<never, never>;

export type TimecodeToolboxAppProps = {
  dataDirectory: string;
};

export type AppProps = SigilRuntimeAppProps<AppApi, TimecodeToolboxAppProps>;

export const App = ({
  title,
  version,
  edition,
  toolkit,
  dataDirectory,
  logger,
  logEventEmitter,
  setWindowUrl,
  shutdownContext,
}: AppProps): ReactNode => {
  const env = useMemo(() => getEnv(logger), [logger]);

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

  const [state, setState] = useState<Omit<ApplicationState, 'handlers'>>({
    inputs: {},
    outputs: {},
    generators: {},
    updates: null,
  });

  const setUpdateState = useCallback((updates: UpdateCheckResult | null) => {
    setState((prev) => ({
      ...prev,
      updates,
    }));
  }, []);

  const [handlers, setHandlers] = useState<TimecodeHandlers>({ children: {} });

  const availableHandlers: Tree<AvailableHandlers> = useMemo(
    () =>
      mapTree(handlers, (node) =>
        Object.fromEntries(
          Object.entries(node)
            .filter(([_, handler]) => handler)
            .map(([key]) => [key, true]),
        ),
      ),
    [handlers],
  );

  const callHandler = useCallback(
    async <H extends keyof AvailableHandlers>(
      call: ToolboxRootCallHandler<H>,
    ) => {
      const handlerFunc = getTreeValue(handlers, call.path)?.[call.handler];
      if (handlerFunc) {
        return await (
          handlerFunc as (
            ...args: Parameters<NonNullable<TimecodeHandlerMethods[H]>>
          ) => void
        )(...call.args);
      }
      throw new Error(
        `No handler found for path: ${call.path.join(' -> ')} and handler: ${call.handler}`,
      );
    },
    [handlers],
  );

  const license = useLicense();

  const appListenerConfig = useMemo(
    () => ({
      default: {
        port: env.PORT,
      },
    }),
    [env.PORT],
  );

  if (!license) {
    // Wait for license to load before starting the app.
    return;
  }

  const children: ReactNode =
    data.agreedToLicense === license.hash ? (
      <>
        <C.ToolboxRoot
          config={data}
          state={state}
          handlers={availableHandlers}
          onUpdateConfig={onUpdateConfig}
          onCallHandler={callHandler}
          license={license.text}
        />
        <InputConnections state={state} setState={setState} />
        <Generators
          state={state}
          setState={setState}
          setHandlers={setHandlers}
        />
        <OutputConnections state={state} setState={setState} />
      </>
    ) : (
      <C.LicenseGate
        license={license.text}
        hash={license.hash}
        onAcceptLicense={(agreedToLicense) => {
          logger.info(`License accepted: ${agreedToLicense}`);
          updateData((current) => ({
            ...current,
            agreedToLicense,
          }));
        }}
      />
    );

  return (
    <AppShell
      title={title}
      version={version}
      dataDirectory={dataDirectory}
      logger={logger}
      logEventEmitter={logEventEmitter}
      shutdownContext={shutdownContext}
    >
      {children}
      {data.checkForUpdates && (
        <UpdateChecker
          version={version}
          edition={edition}
          apiBaseUrl={env.API_BASE_URL}
          setUpdateState={setUpdateState}
        />
      )}
      <AppListenerManager
        toolkit={toolkit}
        setWindowUrl={setWindowUrl}
        listenerConfig={appListenerConfig}
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
