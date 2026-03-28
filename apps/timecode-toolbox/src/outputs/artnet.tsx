import { useDataFileData } from '@arcanejs/react-toolkit/data';
import {
  FC,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { ToolboxConfigData } from '../config';
import {
  ApplicationState,
  OutputArtnetDefinition,
  OutputConfig,
  OutputState,
  isOutputArtnetDefinition,
} from '../components/proto';
import {
  adjustTimecodeForDelay,
  getTimecodeInstance,
  StateSensitiveComponentProps,
} from '../util';
import { useLogger } from '@arcanewizards/sigil';
import { ArtNet, createArtnet } from '@arcanewizards/artnet';
import { TIMECODE_FPS } from '@arcanewizards/artnet/constants';

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

  const setConnection = useCallback(
    (state: OutputState) =>
      setState((current) => ({
        ...current,
        outputs: {
          ...current.outputs,
          [uuid]: state,
        },
      })),
    [setState, uuid],
  );

  useEffect(() => {
    let artnet: ArtNet | null = null;
    setConnection({ status: 'connecting' });
    const created = createArtnet({
      mode: 'send',
      ...target,
    });
    created.on('error', (err) => {
      const error = new Error('ArtNet output connection error');
      error.cause = err instanceof Error ? err : new Error(String(err));
      log.error(error);
      setConnection({
        status: 'error',
        errors: [`${err}`],
      });
    });
    created
      .connect()
      .then(() => {
        artnet = created;
        setArtnetInstance(created);
        log.info(`ArtNet Timecode output initialized`);
        setConnection({ status: 'active' });
      })
      .catch((err) => {
        const error = new Error('Failed to start ArtNet Timecode output');
        error.cause = err instanceof Error ? err : new Error(String(err));
        log.error(error);
        setConnection({
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
  }, [setConnection, uuid, target, log]);

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
      const interval = setInterval(() => {
        const time =
          (Date.now() - tcState.effectiveStartTimeMillis) * tcState.speed;
        artnetInstance.sendTimecode(mode, time);
      }, 1000 / TIMECODE_FPS[mode]);
      return () => {
        clearInterval(interval);
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
