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
  GeneratorInstanceId,
  NAMESPACE,
  TimecodeHandlerMethods,
  TimecodeMetadata,
  TimecodeState,
  TimecodeToolboxControlPlaybackRequest,
  ToolboxConfig,
  ToolboxRootCallHandler,
  ToolboxRootUpdatePlayerState,
  UpdateCheckResult,
} from './components/proto';
import { patchJson, Diff } from '@arcanejs/diff';
import { InputConnections } from './inputs';
import { OutputConnections } from './outputs';
import { Generators } from './generators';
import { TimecodeHandlers } from './types';
import { getTreeValue, mapTree, Tree, updateTreeState } from './tree';
import { useLicense } from './license';
import { UpdateChecker } from './updates';
import { getEnv } from './env';
import { ListenerConfig } from '@arcanewizards/sigil/shared/config';
import {
  INITIAL_PLAYER_STATE,
  PlayerStateManager,
  PlayerState,
} from './generators/player';
import { AppRootProps } from './components/backend/toolbox-root';
import { CallDownloadResponse } from '@arcanejs/toolkit/components/base';
import {
  ConnectionsContextProvider,
  useNotificationSender,
} from '@arcanejs/react-toolkit/connections';
import { ToolkitConnection } from '@arcanejs/toolkit';

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
    // and no client is controlling the connection

    const playerStates: ApplicationState['generators'] = {};

    for (const [uuid, config] of Object.entries(data.generators ?? {})) {
      if (
        config.definition.type !== 'player' ||
        state.generators?.[uuid]?.controlledBy
      ) {
        // Only modify players without a controller
        continue;
      }

      let metadata: TimecodeMetadata | null = null;
      let tcState: TimecodeState = {
        state: 'none',
        accuracyMillis: null,
        smpteMode: null,
        onAir: null,
        appliedDelayMillis: 0,
      };
      const errors: string[] = [];

      const ps = playerState.metadata[uuid];
      if (ps?.path === config.definition.filePath) {
        tcState = {
          ...tcState,
          state: 'unloaded',
        };
        if (ps?.state.state === 'loaded') {
          metadata = ps.state.metadata;
        } else if (ps?.state.state === 'error') {
          errors.push(ps.state.error);
        }
      }

      playerStates[uuid] = {
        controlledBy: null,
        timecode: {
          metadata,
          name: null,
          state: tcState,
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
    ({ generatorUuid }: { generatorUuid: string }) => {
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

  const sendNotification =
    useNotificationSender<TimecodeToolboxControlPlaybackRequest>(
      NAMESPACE,
      'control-playback',
    );

  const releasePlayerControl: AppRootProps['onReleasePlayerControl'] =
    useCallback((generatorUuid: string, connection: ToolkitConnection) => {
      setState((current) => {
        const existing = current.generators?.[generatorUuid];
        if (existing?.controlledBy?.uuid !== connection.uuid) {
          // Connection does not have control, ignore release
          return current;
        }

        const { [generatorUuid]: _, ...remainingGenerators } =
          current.generators ?? {};

        return {
          ...current,
          generators: remainingGenerators,
        };
      });
    }, []);

  const updatePlayerState: AppRootProps['onUpdatePlayerState'] = useCallback(
    (
      { generatorUuid, claim, state }: ToolboxRootUpdatePlayerState,
      connection: ToolkitConnection,
    ) => {
      setState((current) => {
        const existing = current.generators?.[generatorUuid];
        if (!claim && existing?.controlledBy?.uuid !== connection.uuid) {
          // Connection does not have control, ignore update
          return current;
        }

        if (claim) {
          // Set up handlers to point to this connection
          const id: GeneratorInstanceId = ['generator', generatorUuid];

          const sendControlNotification = (
            action: TimecodeToolboxControlPlaybackRequest['action'],
          ) => {
            sendNotification(
              { action, generatorUuid },
              ({ uuid }) => uuid === connection.uuid,
            );
          };

          setHandlers((current) =>
            updateTreeState(current, id, {
              play: () =>
                sendControlNotification({
                  type: 'play',
                }),
              pause: () =>
                sendControlNotification({
                  type: 'pause',
                }),
              beginning: () =>
                sendControlNotification({
                  type: 'beginning',
                }),
              seekRelative: (deltaMillis) =>
                sendControlNotification({
                  type: 'seekRelative',
                  deltaMillis,
                }),
              seekAbsolute: (positionMillis) =>
                sendControlNotification({
                  type: 'seekAbsolute',
                  positionMillis,
                }),
              clear: () => {
                sendControlNotification({
                  type: 'pause',
                });
                // And release control immediately
                releasePlayerControl(generatorUuid, connection);
              },
            }),
          );
        }

        return {
          ...current,
          generators: {
            ...current.generators,
            [generatorUuid]: {
              ...state,
              controlledBy: { uuid: connection.uuid },
            },
          },
        };
      });
    },
    [sendNotification, releasePlayerControl],
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
          onUpdatePlayerState={updatePlayerState}
          onReleasePlayerControl={releasePlayerControl}
          license={license.text}
          network={{
            envPort: env.PORT,
            defaultPort: DEFAULT_PORT,
          }}
        />
        <InputConnections state={state} setState={setState} />
        <PlayerStateManager
          state={state}
          setState={setState}
          setPlayerState={setPlayerState}
          setHandlers={setHandlers}
        />
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
    <ConnectionsContextProvider toolkit={props.toolkit}>
      <ToolboxConfigData.Provider
        path={path.join(props.dataDirectory, 'config.json')}
      >
        <App {...props} />
      </ToolboxConfigData.Provider>
    </ConnectionsContextProvider>
  );
};
