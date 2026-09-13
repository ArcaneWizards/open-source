import { useDataFileData } from '@arcanejs/react-toolkit/data';
import { FC, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { ToolboxConfigData } from '../config';
import {
  InputClxDefinition,
  InputConfig,
  InputState,
  isInputClxDefinition,
  TimecodeGroup,
} from '../components/proto';
import { useLogger } from '@arcanewizards/sigil';
import { ClxClient, createClxClient } from '@arcanewizards/clx';
import {
  ClxTimecodeStateChangedEvent,
  createClxTimecodeMonitor,
} from '@arcanewizards/clx/monitor';
import { StateSensitiveComponentProps } from '../types';

type ClxInputConnectionProps = StateSensitiveComponentProps & {
  uuid: string;
  config: InputConfig;
  connection: InputClxDefinition;
};

const eventToInputState = (
  {
    deck,
    playState,
    ...timecodeState
  }: Omit<ClxTimecodeStateChangedEvent, 'host' | 'port'>,
  delayRef: React.RefObject<number>,
): InputState['timecode'] => ({
  name: `Deck ${deck}`,
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
          appliedDelayMillis: delayRef.current,
        }
      : {
          state: 'stopped',
          positionMillis: playState.currentTimeMillis - delayRef.current,
          onAir: playState.onAir,
          accuracyMillis: null,
          smpteMode: null,
          appliedDelayMillis: delayRef.current,
        },
});

const ClxInputConnection: FC<ClxInputConnectionProps> = ({
  uuid,
  config: { delayMs },
  connection: { iface, port, multiSender },
  setState,
}) => {
  const log = useLogger();

  const [_clxInstance, setClxInstance] = useState<ClxClient | null>(null);

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

  useEffect(() => {
    const connectionConfig: Omit<InputState, 'status'> = {
      controlledBy: null,
      timecode: {
        name: null,
        state: {
          state: 'none',
          accuracyMillis: null,
          smpteMode: null,
          onAir: null,
          appliedDelayMillis: delayRef.current,
        },
        metadata: null,
      },
    };
    let clx: ClxClient | null = null;
    if (iface.trim() === '') {
      setConnection({
        ...connectionConfig,
        status: 'disabled',
        warnings: ['No network interface selected'],
      });
      return;
    }
    setConnection({ ...connectionConfig, status: 'connecting' });
    const created = createClxClient({
      type: 'interface',
      interface: iface,
      port,
    });
    created.on('error', (err) => {
      const error = new Error('Clx input connection error');
      error.cause = err instanceof Error ? err : new Error(String(err));
      log.error(error);
      setConnection({
        ...connectionConfig,
        status: 'error',
        errors: [`${err}`],
      });
    });

    const monitor = createClxTimecodeMonitor(created);

    let timecodeGroup: TimecodeGroup = {
      name: null,
      color: null,
      timecodes: {},
    };

    const updateTimecodeGroup = (
      host: string,
      port: number,
      update: (current: TimecodeGroup) => TimecodeGroup,
    ) => {
      if (multiSender == 'off') {
        timecodeGroup = update(timecodeGroup);
      } else {
        const hostId = multiSender === 'by-ip' ? host : `${host}:${port}`;
        const existingHost = timecodeGroup.timecodes[hostId];
        const newHost: TimecodeGroup =
          existingHost && 'timecodes' in existingHost
            ? existingHost
            : {
                name: hostId,
                color: null,
                timecodes: {},
              };
        timecodeGroup = {
          ...timecodeGroup,
          timecodes: {
            ...timecodeGroup.timecodes,
            [hostId]: update(newHost),
          },
        };
      }
      setConnection({
        ...connectionConfig,
        status: 'active',
        timecode: timecodeGroup,
      });
    };

    monitor.on('timecode-changed', ({ host, port, ...eventData }) => {
      updateTimecodeGroup(host, port, (current) => ({
        ...current,
        timecodes: {
          ...current.timecodes,
          [eventData.deck]: eventToInputState(eventData, delayRef),
        },
      }));
    });

    monitor.on('server-disconnected', ({ host }) => {
      if (multiSender === 'off') {
        timecodeGroup = {
          ...timecodeGroup,
          timecodes: {},
        };
      } else {
        const hostId = multiSender === 'by-ip' ? host : `${host}:${port}`;
        const existingHost = timecodeGroup.timecodes[hostId];
        if (!existingHost) {
          return;
        }
        const { [hostId]: _, ...rest } = timecodeGroup.timecodes;
        timecodeGroup = {
          ...timecodeGroup,
          timecodes: rest,
        };
      }
      log.info(
        `Host ${host}:${port} has timed-out, removing from timecode group`,
      );
      setConnection({
        ...connectionConfig,
        status: 'active',
        timecode: timecodeGroup,
      });
    });

    monitor.on('deck-disconnected', ({ host, port, deck }) => {
      log.info(
        `Deck ${deck} on host ${host}:${port} has timed-out, removing from timecode group`,
      );
      updateTimecodeGroup(host, port, (current) => {
        const { [deck]: _, ...rest } = current.timecodes;
        return {
          ...current,
          timecodes: rest,
        };
      });
    });

    created
      .connect()
      .then(() => {
        clx = created;
        setClxInstance(created);
        log.info('Clx Timecode input initialized');
        setConnection({
          ...connectionConfig,
          status: 'active',
          timecode: timecodeGroup,
        });
      })
      .catch((err) => {
        const error = new Error('Failed to start Clx Timecode input');
        error.cause = err instanceof Error ? err : new Error(String(err));
        log.error(error);
        setConnection({
          ...connectionConfig,
          status: 'error',
          errors: [`${err}`],
          timecode: timecodeGroup,
        });
      });

    return () => {
      if (clx) {
        clx.destroy();
        setClxInstance((current) => (clx === current ? null : current));
      }
    };
  }, [setConnection, uuid, iface, port, multiSender, log]);

  useEffect(() => {
    return () => {
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

export const ClxInputConnections: FC<StateSensitiveComponentProps> = (
  props,
) => {
  const { inputs } = useDataFileData(ToolboxConfigData);
  return Object.entries(inputs)
    .filter(([_, { enabled }]) => enabled)
    .map<ReactNode>(([uuid, input]) => {
      const connection = input.definition;
      if (!isInputClxDefinition(connection)) {
        return null;
      }
      return (
        <ClxInputConnection
          key={uuid}
          uuid={uuid}
          config={input}
          connection={connection}
          {...props}
        />
      );
    });
};
