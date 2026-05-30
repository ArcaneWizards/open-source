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
  OutputConfig,
  OutputMidiDefinition,
  OutputState,
  isOutputMidiDefinition,
  isPlaying,
  isStopped,
} from '../components/proto';
import { adjustTimecodeForDelay, getTimecodeInstance } from '../util';
import { useLogger } from '@arcanewizards/sigil';
import { StateSensitiveComponentProps } from '../types';
import midi, { MIDIOutput } from '@arcanewizards/midi';
import { createMIDITimecodeSender } from '@arcanewizards/midi-timecode';
import { useMidiDeviceWatcher } from '../lib/midi';

type MIDIOutputConnectionProps = StateSensitiveComponentProps & {
  uuid: string;
  config: OutputConfig;
  connection: OutputMidiDefinition;
  state: ApplicationState;
};

const MIDIOutputConnection: FC<MIDIOutputConnectionProps> = ({
  uuid,
  config,
  connection: { target },
  setState,
  state,
}) => {
  const log = useLogger();

  const [midiInstance, setMidiInstance] = useState<MIDIOutput | null>(null);

  const m = useMemo(() => midi(), []);

  const name = target.type === 'virtual' ? config.name : target.deviceName;

  const outputInfo = useMidiDeviceWatcher(log, m, 'outputs', target);

  const setOutputState = useCallback(
    (outputState: OutputState) =>
      setState((current) => ({
        ...current,
        outputs: {
          ...current.outputs,
          [uuid]: outputState,
        },
      })),
    [setState, uuid],
  );

  useEffect(() => {
    let output: MIDIOutput | null = null;
    if (!name?.trim()) {
      setOutputState({
        status: 'disabled',
        warnings: [
          target.type === 'virtual'
            ? 'Please specify a name for your virtual MIDI device'
            : 'No MIDI output device selected',
        ],
      });
      return;
    }
    setOutputState({ status: 'connecting' });

    if (outputInfo === 'loading') {
      return;
    }

    const outputPromise =
      target.type === 'virtual'
        ? m.createVirtualOutput(name)
        : Promise.resolve(outputInfo).then((found) => {
            if (!found) {
              throw new Error(
                `MIDI output device "${target.deviceName}" not found`,
              );
            }
            return midi().openOutput(found);
          });

    outputPromise
      .then((created) => {
        log.info(`MIDI Timecode output ${name} initialized`);
        output = created;
        setMidiInstance(created);
      })
      .catch((cause) => {
        const error = new Error('Failed to initialize MIDI output', { cause });
        log.error(error);
        setOutputState({
          status: 'error',
          errors: [`${cause}`],
        });
      });

    return () => {
      try {
        output?.close();
      } catch (cause) {
        const error = new Error('Failed to close MIDI output', { cause });
        log.error(error);
      }
      setMidiInstance((current) => (output === current ? null : current));
    };
  }, [setOutputState, name, uuid, target, log, m, outputInfo]);

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

  const sender = useMemo(() => {
    if (!midiInstance) {
      return null;
    }
    let closed = false;
    midiInstance.addEventListener('closed', () => {
      closed = true;
    });
    return createMIDITimecodeSender({
      sendMessage: (message) => {
        if (closed) {
          return;
        }
        midiInstance.sendMessage(message);
      },
      mode: 'SMPTE',
    });
  }, [midiInstance]);

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
    if (!sender || !timecodeState) {
      return;
    }
    sender.setPlayState(
      isPlaying(timecodeState)
        ? {
            state: 'playing',
            effectiveStartTime: timecodeState.effectiveStartTimeMillis,
            speed: timecodeState.speed,
          }
        : {
            state: 'stopped',
            currentTimeMillis: isStopped(timecodeState)
              ? timecodeState.positionMillis
              : 0,
          },
    );
  }, [sender, timecodeState]);

  return null;
};

export const MIDIOutputConnections: FC<StateSensitiveComponentProps> = (
  props,
) => {
  const { outputs } = useDataFileData(ToolboxConfigData);

  return Object.entries(outputs)
    .filter(([_, { enabled }]) => enabled)
    .map<ReactNode>(([uuid, output]) => {
      const definition = output.definition;
      if (!isOutputMidiDefinition(definition)) {
        return null;
      }
      return (
        <MIDIOutputConnection
          key={uuid}
          uuid={uuid}
          config={output}
          connection={definition}
          {...props}
        />
      );
    });
};
