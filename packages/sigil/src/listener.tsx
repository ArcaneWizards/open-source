import { Toolkit, ToolkitServerListener } from '@arcanejs/toolkit';
import {
  getNetworkInterfaces,
  NetworkPortStatus,
} from '@arcanewizards/net-utils';
import isEqual from 'lodash/isEqual';
import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { useLogger } from './context';
import { AllListenerConfig, ListenerConfig } from './shared/config';

export type { AllListenerConfig, ListenerConfig };

export type AppListenerManagerAppRegistration = {
  removeConnection: (uuid: string) => void;
  setConnection: (uuid: string, details: NetworkPortStatus) => void;
};

type ConnectedListener = {
  state: 'connected';
  listener: ToolkitServerListener;
  config: ListenerConfig;
  host?: string;
  port: number;
  internal: boolean;
};

type ListenerState = Record<
  string,
  | {
      state: 'connecting';
      config: ListenerConfig;
    }
  | {
      state: 'error';
      error: string;
      config: ListenerConfig;
    }
  | ConnectedListener
>;

const connectionDescription = (
  listener: Pick<ConnectedListener, 'config' | 'host' | 'port'>,
) => {
  return `${listener.host ?? '0.0.0.0'}:${listener.port}`;
};

export type AppListenerManagerProps = {
  appRegistration?: AppListenerManagerAppRegistration;
  listenerConfig: AllListenerConfig;
  toolkit: Toolkit;
  setWindowUrl: (windowUrl: URL) => void;
};

export const AppListenerManager: FC<AppListenerManagerProps> = ({
  appRegistration,
  listenerConfig,
  toolkit,
  setWindowUrl,
}) => {
  const logger = useLogger();
  const listenerStateRef = useRef<ListenerState>({});
  const [listenerState, setListenerState] = useState(listenerStateRef.current);

  const updateReactState = useCallback(() => {
    setListenerState({ ...listenerStateRef.current });
  }, []);

  useEffect(() => {
    Object.entries(listenerStateRef.current).forEach(([key, state]) => {
      if (!listenerConfig[key] || !isEqual(listenerConfig[key], state.config)) {
        if (state.state === 'connected') {
          const delay = 500;
          setTimeout(() => {
            state.listener.close();
            logger.info(`Closing listener: ${key}`);
          }, delay);
          logger.info(
            `Will close listener ${key} on ${connectionDescription(state)} in ${delay}ms`,
          );
          appRegistration?.removeConnection(key);
        }

        delete listenerStateRef.current[key];
      }
    });

    getNetworkInterfaces()
      .then(async (interfaces) => {
        listenerLoop: for (const [key, config] of Object.entries(
          listenerConfig,
        )) {
          const basePortInformation: Pick<
            NetworkPortStatus,
            'direction' | 'port' | 'target'
          > = {
            direction: 'input',
            target: config.interface
              ? {
                  type: 'interface',
                  interface: config.interface,
                }
              : {
                  type: 'host',
                  host: '0.0.0.0',
                },
            port: config.port,
          };

          if (!listenerStateRef.current[key]) {
            let host: string | undefined = undefined;

            if (config.interface) {
              const iface = interfaces[config.interface];
              if (!iface) {
                const error = new Error(
                  `Network interface ${config.interface} not found`,
                );
                appRegistration?.setConnection(key, {
                  ...basePortInformation,
                  status: 'error',
                  errors: [error.message],
                });
                logger.error(error);
                listenerStateRef.current[key] = {
                  state: 'error',
                  config,
                  error: error.message,
                };
                continue listenerLoop;
              }
              host = iface.address;
            }

            listenerStateRef.current[key] = { state: 'connecting', config };

            const from =
              typeof config.port === 'number' ? config.port : config.port.from;
            const to =
              typeof config.port === 'number' ? config.port : config.port.to;

            portRange: for (let port = from; port <= to; port++) {
              const resolvedConnectionDetails: Pick<
                ConnectedListener,
                'config' | 'host' | 'port' | 'internal'
              > = {
                config,
                host,
                port,
                internal:
                  !!config.interface &&
                  !!interfaces[config.interface]?.internal,
              };

              try {
                const listener = await toolkit.listen({
                  port,
                  host,
                });

                if (!listenerStateRef.current[key]) {
                  listener.close();
                } else {
                  listenerStateRef.current[key] = {
                    state: 'connected',
                    listener,
                    ...resolvedConnectionDetails,
                  };
                  appRegistration?.setConnection(key, {
                    ...basePortInformation,
                    port,
                    status: 'active',
                  });
                  logger.info(
                    `App listener ${key} started on ${connectionDescription(resolvedConnectionDetails)}`,
                  );
                  break portRange;
                }
              } catch (err) {
                if (port === to) {
                  const error = new Error(
                    `Failed to start listener on ${connectionDescription(
                      resolvedConnectionDetails,
                    )}${from !== to ? ` (for port range ${from}-${to}) latest error` : ''}`,
                    { cause: err },
                  );
                  listenerStateRef.current[key] = {
                    state: 'error',
                    config,
                    error: `${error}`,
                  };
                  appRegistration?.setConnection(key, {
                    ...basePortInformation,
                    status: 'error',
                    errors: [error.message],
                  });
                  logger.error(error);
                }
              } finally {
                updateReactState();
              }
            }
          }
        }
      })
      .catch((err) => {
        const error = new Error('Failed to get network interfaces:', {
          cause: err,
        });
        logger.error(error);
        Object.entries(listenerConfig).forEach(([key, config]) => {
          if (!listenerStateRef.current[key]) {
            listenerStateRef.current[key] = {
              state: 'error',
              config,
              error: `Failed to get network interfaces: ${error}`,
            };
          }
        });
        updateReactState();
      });

    updateReactState();
  }, [appRegistration, listenerConfig, logger, toolkit, updateReactState]);

  useEffect(() => {
    for (const state of Object.values(listenerState)) {
      let preferredConnection: ConnectedListener | null = null;
      if (state.state === 'connected') {
        if (!preferredConnection) {
          preferredConnection = state;
        }
        if (!preferredConnection.internal && state.internal) {
          preferredConnection = state;
        }
      }
      if (preferredConnection) {
        setWindowUrl(
          new URL(
            `http://${preferredConnection.host ?? 'localhost'}:${preferredConnection.port}/`,
          ),
        );
      }
    }
  });

  return null;
};
