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
import fs from 'node:fs/promises';
import { useDataFileContext } from '@arcanejs/react-toolkit/data';
import {
  ApplicationState,
  AvailableHandlers,
  DEFAULT_CONFIG,
  TimecodeHandlerMethods,
  TimecodeMetadata,
  TimecodeState,
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
import { ListenerConfig } from '@arcanewizards/sigil/shared/config';
import {
  INITIAL_PLAYER_STATE,
  PlayerMetadataFetchers,
  PlayerState,
} from './generators/player';
import { AppRootProps } from './components/backend/toolbox-root';
import { CallDownloadResponse } from '@arcanejs/toolkit/components/base';

const DEFAULT_PORT: ListenerConfig['port'] = { from: 4100, to: 4200 };

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

  const callHandler: AppRootProps['onCallHandler'] = useCallback(
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

  const appListenerConfig = useMemo(() => {
    const baseConfig: ListenerConfig = {
      port: data.appListener?.port ?? DEFAULT_PORT,
      interface: data.appListener?.interface ?? undefined,
    };
    if (env.PORT) {
      // Just override the port, keeping the interface config as-is
      baseConfig.port = env.PORT;
    }
    return baseConfig;
  }, [env.PORT, data.appListener]);

  const [playerState, setPlayerState] =
    useState<PlayerState>(INITIAL_PLAYER_STATE);

  const augmentedState = useMemo(() => {
    // Augment generator timecode with player metadata if available

    const playerStates: ApplicationState['generators'] = {};

    for (const [uuid, config] of Object.entries(data.generators ?? {})) {
      if (config.definition.type !== 'player') {
        continue;
      }

      let metadata: TimecodeMetadata | null = null;
      let state: TimecodeState = {
        state: 'none',
        accuracyMillis: null,
        smpteMode: null,
        onAir: null,
      };
      const errors: string[] = [];

      const ps = playerState.metadata[uuid];
      if (ps?.path === config.definition.filePath) {
        state = {
          ...state,
          state: 'unloaded',
        };
        if (ps?.state.state === 'loaded') {
          metadata = ps.state.metadata;
        } else if (ps?.state.state === 'error') {
          errors.push(ps.state.error);
        }
      }

      playerStates[uuid] = {
        timecode: {
          metadata,
          name: null,
          state,
        },
        errors,
      };
    }

    return {
      ...state,
      generators: {
        ...state.generators,
        ...playerStates,
      },
    };
  }, [data.generators, state, playerState]);

  const downloadAudioFile: AppRootProps['onDownloadAudioFile'] = useCallback(
    ({ generatorUuid }) => {
      const config = data.generators?.[generatorUuid]?.definition;
      if (!config) {
        throw new Error(`Invalid generator id ${generatorUuid}`);
      }
      if (config?.type !== 'player' || !config.filePath) {
        throw new Error(
          `Generator ${generatorUuid} is not a player with a file configured`,
        );
      }
      return fs
        .open(config.filePath, 'r')
        .then<ReturnType<CallDownloadResponse>>(async (fileHandle) => {
          const stream = fileHandle.createReadStream();
          return {
            stream,
            headers: {
              'Content-Type': 'application/octet-stream',
            },
          };
        })
        .catch((error) => {
          throw new Error(
            `Failed to create file stream for generator ${generatorUuid}: ${error}`,
          );
        });
    },
    [data.generators],
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
          state={augmentedState}
          handlers={availableHandlers}
          onUpdateConfig={onUpdateConfig}
          onCallHandler={callHandler}
          onDownloadAudioFile={downloadAudioFile}
          license={license.text}
          network={{
            envPort: env.PORT,
            defaultPort: DEFAULT_PORT,
          }}
        />
        <InputConnections state={state} setState={setState} />
        <PlayerMetadataFetchers updateState={setPlayerState} />
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
        listenerConfig={{ appListenerConfig }}
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
