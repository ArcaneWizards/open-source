import { useDataFileData } from '@arcanejs/react-toolkit/data';
import { FC, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { ToolboxConfigData } from '../config';
import {
  InputArtnetDefinition,
  InputConfig,
  InputState,
  isInputArtnetDefinition,
  TimecodeState,
} from '../components/proto';
import { StateSensitiveComponentProps } from '../util';
import { useLogger } from '@arcanewizards/sigil';
import {
  ArtNet,
  ArtNetTimecodeEvent,
  createArtnet,
} from '@arcanewizards/artnet';
import { TIMECODE_FPS, TimecodeMode } from '@arcanewizards/artnet/constants';

/**
 * How much of a difference between the calculated timecode state,
 * and previous timecode state is required to trigger an update.
 */
const MINIMUM_DRIFT_FOR_UPDATE_MS: Record<TimecodeMode, number> = {
  SMPTE: 1000 / TIMECODE_FPS.SMPTE / 2,
  FILM: 1000 / TIMECODE_FPS.FILM / 2,
  EBU: 1000 / TIMECODE_FPS.EBU / 2,
  DF: 1000 / TIMECODE_FPS.DF / 2,
};

/**
 * How many frames need to be missed before we consider a timecode to be lagging.
 */
const LAGGING_FRAME_COUNT = 2;

/**
 * If we haven't received a timecode update for this amount of time,
 * consider the timecode to be lagging
 */
const LAGGING_TIMEOUT_MS: Record<TimecodeMode, number> = {
  SMPTE: (1000 / TIMECODE_FPS.SMPTE) * LAGGING_FRAME_COUNT,
  FILM: (1000 / TIMECODE_FPS.FILM) * LAGGING_FRAME_COUNT,
  EBU: (1000 / TIMECODE_FPS.EBU) * LAGGING_FRAME_COUNT,
  DF: (1000 / TIMECODE_FPS.DF) * LAGGING_FRAME_COUNT,
};

/**
 * How long should we wait not receiving any packets
 * before considering a timecode to be stopped.
 */
const TIMEOUT_MS = 500;

type ArtnetInputConnectionProps = StateSensitiveComponentProps & {
  uuid: string;
  config: InputConfig;
  connection: InputArtnetDefinition;
};

const ArtnetInputConnection: FC<ArtnetInputConnectionProps> = ({
  uuid,
  config: { name, delayMs },
  connection: { iface, port },
  setState,
}) => {
  const log = useLogger();

  const [artnetInstance, setArtnetInstance] = useState<ArtNet | null>(null);

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
      timecode: {
        name: null,
        state: {
          state: 'none',
          accuracyMillis: null,
          smpteMode: null,
          onAir: null,
        },
        metadata: null,
      },
    };
    let artnet: ArtNet | null = null;
    setConnection({ ...connectionConfig, status: 'connecting' });
    const created = createArtnet({
      type: 'interface',
      interface: iface,
      mode: 'receive',
      port,
    });
    created.on('error', (err) => {
      const error = new Error('ArtNet input connection error');
      error.cause = err instanceof Error ? err : new Error(String(err));
      log.error(error);
      setConnection({
        ...connectionConfig,
        status: 'error',
        errors: [`${err}`],
      });
    });
    created
      .connect()
      .then(() => {
        artnet = created;
        setArtnetInstance(created);
        log.info('ArtNet Timecode output initialized');
        setConnection({ ...connectionConfig, status: 'active' });
      })
      .catch((err) => {
        const error = new Error('Failed to start ArtNet Timecode output');
        error.cause = err instanceof Error ? err : new Error(String(err));
        log.error(error);
        setConnection({
          ...connectionConfig,
          status: 'error',
          errors: [`${err}`],
        });
      });

    return () => {
      if (artnet) {
        artnet.destroy();
        setArtnetInstance((current) => (artnet === current ? null : current));
      }
    };
  }, [setConnection, uuid, iface, port, log]);

  useEffect(() => {
    type ReceivedTimecode = {
      clockMillis: number;
      effectiveStartTimeMillis: number;
      mode: TimecodeMode;
    };

    let lastTimecode: ReceivedTimecode | null = null;
    let lastUsedTimecode: ReceivedTimecode | null = lastTimecode;
    let timecode: TimecodeState | null = null;
    let driftApproximation = 0;
    let laggingTimeout: NodeJS.Timeout | null = null;

    let isMounted = true;

    const updateTimecodeState = () => {
      if (!lastTimecode) {
        // No change
        return;
      }
      if (!isMounted) {
        // Update received after being unmounted, ignore
        return;
      }
      const now = Date.now();
      if (
        lastUsedTimecode === lastTimecode &&
        lastTimecode.clockMillis + TIMEOUT_MS < now
      ) {
        // Timecode has become stale
        timecode = {
          state: 'stopped',
          positionMillis:
            lastUsedTimecode.clockMillis -
            lastUsedTimecode.effectiveStartTimeMillis,
          accuracyMillis: driftApproximation,
          smpteMode: lastTimecode.mode,
          onAir: null,
        };
        setConnection({
          status: 'active',
          timecode: {
            name: null,
            state: timecode,
            metadata: null,
          },
        });
        lastTimecode = null;
        return;
      }
      const isLagging =
        lastTimecode.clockMillis + LAGGING_TIMEOUT_MS[lastTimecode.mode] < now;
      timecode = {
        state: isLagging ? 'lagging' : 'playing',
        effectiveStartTimeMillis: lastTimecode.effectiveStartTimeMillis,
        accuracyMillis: driftApproximation,
        smpteMode: lastTimecode.mode,
        speed: 1,
        onAir: null,
      };
      setConnection({
        status: 'active',
        timecode: {
          name: null,
          state: timecode,
          metadata: null,
        },
      });
      lastUsedTimecode = lastTimecode;

      if (!isLagging) {
        // Set up a timeout to mark the timecode as lagging,
        // if we don't receive an update quickly enough
        if (laggingTimeout) {
          clearTimeout(laggingTimeout);
        }
        // Set a bit later than lagging timeout to ensure that the
        // condition is met when the timeout triggers,
        laggingTimeout = setTimeout(
          updateTimecodeState,
          LAGGING_TIMEOUT_MS[lastTimecode.mode] * 1.1,
        );
      }
    };

    const interval = setInterval(updateTimecodeState, TIMEOUT_MS / 2);

    const onTimecode = (tc: ArtNetTimecodeEvent) => {
      const clockMillis = Date.now();
      const effectiveStartTimeMillis =
        clockMillis - tc.timeMillis + delayRef.current;
      lastTimecode = {
        clockMillis,
        effectiveStartTimeMillis,
        mode: tc.mode,
      };
      if (timecode?.state === 'playing') {
        const drift = Math.abs(
          effectiveStartTimeMillis - timecode.effectiveStartTimeMillis,
        );
        // Decay the drift approximation over time
        // so that temporary spikes don't last
        driftApproximation = Math.max(driftApproximation * 0.9, drift);
        if (drift < MINIMUM_DRIFT_FOR_UPDATE_MS[tc.mode]) {
          // Skip update, difference not significant enough
          // just rely on the interal to update the driftApproximation
          return;
        }
      }

      updateTimecodeState();
    };

    artnetInstance?.addListener('timecode', onTimecode);

    return () => {
      isMounted = false;
      clearInterval(interval);
      artnetInstance?.removeListener('timecode', onTimecode);
    };
  }, [artnetInstance, log, iface, name, setConnection]);

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

export const ArtnetInputConnections: FC<StateSensitiveComponentProps> = (
  props,
) => {
  const { inputs } = useDataFileData(ToolboxConfigData);
  return Object.entries(inputs)
    .filter(([_, { enabled }]) => enabled)
    .map<ReactNode>(([uuid, input]) => {
      const connection = input.definition;
      if (!isInputArtnetDefinition(connection)) {
        return null;
      }
      return (
        <ArtnetInputConnection
          key={uuid}
          uuid={uuid}
          config={input}
          connection={connection}
          {...props}
        />
      );
    });
};
