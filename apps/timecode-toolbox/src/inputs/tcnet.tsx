import { useDataFileData } from '@arcanejs/react-toolkit/data';
import {
  FC,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { ToolboxConfigData } from '../config';
import {
  ConnectedClient,
  InputConfig,
  InputState,
  InputTcnetDefinition,
  isInputTcnetDefinition,
  TimecodeGroup,
} from '../components/proto';
import { StateSensitiveComponentProps } from '../util';
import {
  AppInformationContext,
  useLogger,
  useShutdownHandler,
} from '@arcanewizards/sigil';

import { createTCNetNode } from '@arcanewizards/tcnet';
import { createTCNetTimecodeMonitor } from '@arcanewizards/tcnet/monitor';
import {
  TCNetConnectedNodes,
  TCNetPortUsage,
} from '@arcanewizards/tcnet/types';
import { NetworkPortStatus } from '@arcanewizards/net-utils';

type TcnetInputConnectionProps = StateSensitiveComponentProps & {
  uuid: string;
  config: InputConfig;
  connection: InputTcnetDefinition;
};

const TcnetInputConnection: FC<TcnetInputConnectionProps> = ({
  uuid,
  config: { name, delayMs },
  connection: { iface, nodeName },
  setState,
}) => {
  const logger = useLogger();

  const appInformation = useContext(AppInformationContext);

  const nodeRef = useRef<ReturnType<typeof createTCNetNode> | null>(null);

  /**
   * Variable that can be set to prevent further updates,
   * in particular when unmounting to prevent updates from this function
   * once it is unmounted,
   * since further updates may come from the TCNet node after it's been destroyed.
   */
  const isMountedRef = useRef(true);

  // Use ref here to allow for updates without requiring re-init of node
  const delayRef = useRef(delayMs ?? 0);

  useEffect(() => {
    delayRef.current = delayMs ?? 0;
  }, [delayMs]);

  const setConnection = useCallback(
    (state: InputState) =>
      setState((current) => ({
        ...current,
        inputs: {
          ...current.inputs,
          [uuid]: state,
        },
      })),
    [setState, uuid],
  );

  /**
   * TCNet has multiple connections / ports,
   * this convenience function ensures that all the required ports are kept up-to-date,
   * and have unique IDs
   */
  const updateState = useMemo(() => {
    return (
      connections: Record<TCNetPortUsage, NetworkPortStatus | null>,
      nodes: TCNetConnectedNodes,
      timecodeGroup: TimecodeGroup,
    ) => {
      if (!isMountedRef.current) {
        return;
      }
      const warnings =
        Object.values(nodes).length === 0
          ? ['No other TCNet nodes detected on the network']
          : [];
      const clients: ConnectedClient[] = Object.entries(nodes)
        .sort(([nodeIdA], [nodeIdB]) => nodeIdA.localeCompare(nodeIdB))
        .map(([_, nodeInfo]) => ({
          name: nodeInfo.nodeName,
          host: nodeInfo.host,
          port: nodeInfo.nodeListenerPort,
          protocolVersion: nodeInfo.protocolVersion,
          details: [`Type: ${nodeInfo.nodeType}`],
        }));
      const hasError = Object.values(connections).some(
        (port) => port?.status === 'error',
      );
      const isConnecting = Object.values(connections).some(
        (port) => port?.status === 'connecting',
      );
      setConnection({
        status: hasError ? 'error' : isConnecting ? 'connecting' : 'active',
        clients,
        warnings,
        timecode: timecodeGroup,
      });
    };
  }, [setConnection]);

  useEffect(() => {
    const node = createTCNetNode({
      logger,
      networkInterface: iface,
      nodeName: nodeName?.substring(0, 8) ?? 'TC-TLBOX',
      vendorName: 'Arcane Wizards',
      appName: appInformation.title.substring(0, 16),
      appVersion: appInformation.version.substring(0, 16),
    });
    nodeRef.current = node;

    let lastPortInformation = node.getPortInformation();
    let lastNodes: TCNetConnectedNodes = {};
    let timecodeGroup: TimecodeGroup = {
      name: null,
      color: null,
      timecodes: {},
    };

    const updateConnectionsState = () => {
      updateState(lastPortInformation, lastNodes, timecodeGroup);
    };

    updateConnectionsState();

    node.on('port-state-changed', (info) => {
      lastPortInformation = info;
      updateConnectionsState();
    });

    node.on('nodes-changed', (nodes) => {
      lastNodes = nodes;
      updateConnectionsState();
    });

    node.on('ready', () => {
      logger.info(`TCNet node ${uuid} is ready`);
    });

    const monitor = createTCNetTimecodeMonitor(node, logger);

    monitor.addListener(
      'timecode-changed',
      ({ layerId, playState, ...timecodeState }) => {
        timecodeGroup = {
          ...timecodeGroup,
          timecodes: {
            ...timecodeGroup.timecodes,
            [layerId]: {
              name: timecodeState.layerName,
              metadata: {
                totalTime: timecodeState.totalTime,
                title: timecodeState?.info?.title ?? null,
                artist: timecodeState?.info?.artist ?? null,
              },
              state:
                playState.state === 'playing'
                  ? {
                      state: 'playing',
                      effectiveStartTimeMillis:
                        playState.effectiveStartTime + delayRef.current,
                      speed: playState.speed,
                      onAir: playState.onAir,
                      accuracyMillis: null,
                      smpteMode: null,
                    }
                  : {
                      state: 'stopped',
                      positionMillis:
                        playState.currentTimeMillis - delayRef.current,
                      onAir: playState.onAir,
                      accuracyMillis: null,
                      smpteMode: null,
                    },
            },
          },
        };
        updateConnectionsState();
      },
    );

    monitor.addListener('layer-removed', ({ layerId }) => {
      logger.info(`Layer removed from node ${uuid} layer ${layerId}`);
      timecodeGroup = {
        ...timecodeGroup,
        timecodes: Object.fromEntries(
          Object.entries(timecodeGroup.timecodes).filter(
            ([layerIdKey]) => layerIdKey !== layerId,
          ),
        ),
      };
      updateConnectionsState();
    });

    node.connect();

    return () => {
      logger.info(`Destroying TCNet connection ${uuid}...`);
      node.destroy();
      if (nodeRef.current === node) {
        nodeRef.current = null;
      }
    };
  }, [uuid, iface, nodeName, logger, appInformation, updateState]);

  useShutdownHandler(async () => {
    if (nodeRef.current) {
      logger.info(`Shutting down TCNet node ${name ?? uuid}...`);
      await nodeRef.current.destroy();
    }
  });

  useEffect(() => {
    return () => {
      // Prevent the connection state being re-added with delayed updates from node
      isMountedRef.current = false;
      // Remove the connection when it's no longer mounted / configured
      setState((current) => {
        const { [uuid]: _, ...rest } = current.inputs;
        return {
          ...current,
          inputs: rest,
        };
      });
    };
  }, [setState, uuid]);
  return null;
};

export const TcNetInputConnections: FC<StateSensitiveComponentProps> = (
  props,
) => {
  const { inputs } = useDataFileData(ToolboxConfigData);
  return Object.entries(inputs)
    .filter(([_, { enabled }]) => enabled)
    .map<ReactNode>(([uuid, input]) => {
      const connection = input.definition;
      if (!isInputTcnetDefinition(connection)) {
        return null;
      }
      return (
        <TcnetInputConnection
          key={uuid}
          uuid={uuid}
          config={input}
          connection={connection}
          {...props}
        />
      );
    });
};
