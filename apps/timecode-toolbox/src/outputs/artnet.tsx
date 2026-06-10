import { useDataFileData } from '@arcanejs/react-toolkit/data';
import { FC, ReactNode, useEffect, useMemo, useState } from 'react';
import { ToolboxConfigData } from '../config';
import {
  ApplicationState,
  OutputArtnetDefinition,
  OutputConfig,
  OutputState,
  isOutputArtnetDefinition,
} from '../components/proto';
import { adjustTimecodeForDelay, getTimecodeInstance } from '../util';
import { useLogger } from '@arcanewizards/sigil';
import { ArtNet, createArtnet } from '@arcanewizards/artnet';
import { StateSensitiveComponentProps } from '../types';
import { getNetworkInterfaces } from '@arcanewizards/net-utils';

type ArtnetOutputConnectionProps = StateSensitiveComponentProps & {
  uuid: string;
  config: OutputConfig;
  connection: OutputArtnetDefinition;
  state: ApplicationState;
};

const ArtnetOutputConnection: FC<ArtnetOutputConnectionProps> = ({
  uuid,
  config,
  connection: { target, mode },
  setState,
  state,
}) => {
  const log = useLogger();

  const [artnetInstance, setArtnetInstance] = useState<ArtNet | null>(null);
  const [outputState, setOutputState] = useState<OutputState | null>(null);

  useEffect(() => {
    let artnet: ArtNet | null = null;
    if (target.type === 'interface' && target.interface.trim() === '') {
      setOutputState({
        status: 'disabled',
        controlledBy: null,
        warnings: ['No network interface selected'],
      });
      return;
    }
    if (target.type === 'host' && target.host.trim() === '') {
      setOutputState({
        status: 'disabled',
        controlledBy: null,
        warnings: ['No hostname / IP address specified'],
      });
      return;
    }
    setOutputState({ status: 'connecting', controlledBy: null });
    const created = createArtnet({
      mode: 'send',
      ...target,
    });
    created.on('error', (err) => {
      const error = new Error('ArtNet output connection error');
      error.cause = err instanceof Error ? err : new Error(String(err));
      log.error(error);
      setOutputState({
        status: 'error',
        controlledBy: null,
        errors: [`${err}`],
      });
    });
    created
      .connect()
      .then(() => {
        artnet = created;
        setArtnetInstance(created);
        log.info(`ArtNet Timecode output initialized`);
        setOutputState({ status: 'active', controlledBy: null });
      })
      .catch((err) => {
        const error = new Error('Failed to start ArtNet Timecode output');
        error.cause = err instanceof Error ? err : new Error(String(err));
        log.error(error);
        setOutputState({
          status: 'error',
          controlledBy: null,
          errors: [`${err}`],
        });
      });

    return () => {
      try {
        artnet?.destroy();
      } catch (cause) {
        const error = new Error('Failed to destroy ArtNet instance', { cause });
        log.error(error);
      }
      setArtnetInstance((current) => (artnet === current ? null : current));
    };
  }, [setOutputState, uuid, target, log]);

  useEffect(() => {
    if (outputState === null) {
      return;
    }
    // Check configuration for potential issues, and augment state with warnings
    if (target.type === 'interface') {
      getNetworkInterfaces()
        .then((interfaces) => {
          const warnings: string[] = [];
          const matchingInterface = Object.values(interfaces).find(
            (intf) => intf.name === target.interface,
          );
          if (matchingInterface && matchingInterface.internal) {
            warnings.push(
              'Broadcast usually does not work on internal (loopback) interfaces, use IP address / localhost instead',
            );
          }
          setState((current) => ({
            ...current,
            outputs: {
              ...current.outputs,
              [uuid]: {
                ...outputState,
                warnings: [...(outputState.warnings || []), ...warnings],
              },
            },
          }));
        })
        .catch((cause) => {
          const error = new Error(
            'Failed to get network interfaces for ArtNet output configuration validation',
            { cause },
          );
          log.error(error);
          setState((current) => ({
            ...current,
            outputs: {
              ...current.outputs,
              [uuid]: { ...outputState, errors: [error.message] },
            },
          }));
        });
    }
    setState((current) => ({
      ...current,
      outputs: {
        ...current.outputs,
        [uuid]: outputState,
      },
    }));
  }, [log, target, outputState, setState, uuid]);

  useEffect(() => {
    return () => {
      // Remove the connection when it's no longer mounted / configured
      setState((current) => {
        const { [uuid]: _, ...rest } = current.outputs;
        return {
          ...current,
          outputs: rest,
        };
      });
    };
  }, [setState, uuid]);

  const tcInstance = useMemo(
    () => config.link && getTimecodeInstance(state, config.link),
    [state, config.link],
  );

  const timecodeState = useMemo(
    () =>
      tcInstance?.state
        ? adjustTimecodeForDelay(tcInstance.state, config.delayMs ?? 0)
        : null,
    [tcInstance?.state, config.delayMs],
  );

  useEffect(() => {
    if (!artnetInstance) {
      return;
    }

    if (
      timecodeState?.state === 'playing' ||
      timecodeState?.state === 'lagging'
    ) {
      const tcState = timecodeState;
      let transmit = true;
      let timeoutId: NodeJS.Timeout | null = null;
      const sendNextFrame = () => {
        if (!transmit) {
          /*
           * A timeout may still be requested in the then/catch of the
           * sendTimecode promise after the component has been unmounted.
           * so we need to check if we should still transmit before sending the next frame.
           */
          return;
        }
        const time =
          (Date.now() - tcState.effectiveStartTimeMillis) * tcState.speed;
        artnetInstance
          .sendTimecode(mode, time)
          .then(({ nextFrameTimeMillis }) => {
            const delay = nextFrameTimeMillis - time + 1;
            timeoutId = setTimeout(sendNextFrame, delay);
          })
          .catch(() => {
            scheduleNextFrame();
          });
      };
      const scheduleNextFrame = () => {
        const time =
          (Date.now() - tcState.effectiveStartTimeMillis) * tcState.speed;
        const { nextFrameTimeMillis } = artnetInstance.getNextFrameTiming(
          mode,
          time,
        );
        const delay = nextFrameTimeMillis - time + 1;
        timeoutId = setTimeout(sendNextFrame, delay);
      };
      scheduleNextFrame();
      return () => {
        transmit = false;
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      };
    } else if (timecodeState?.state === 'stopped') {
      artnetInstance.sendTimecode(mode, timecodeState?.positionMillis ?? 0);
    }
  }, [artnetInstance, mode, timecodeState]);

  return null;
};

export const ArtnetOutputConnections: FC<StateSensitiveComponentProps> = (
  props,
) => {
  const { outputs } = useDataFileData(ToolboxConfigData);

  return Object.entries(outputs)
    .filter(([_, { enabled }]) => enabled)
    .map<ReactNode>(([uuid, output]) => {
      const definition = output.definition;
      if (!isOutputArtnetDefinition(definition)) {
        return null;
      }
      return (
        <ArtnetOutputConnection
          key={uuid}
          uuid={uuid}
          config={output}
          connection={definition}
          {...props}
        />
      );
    });
};
