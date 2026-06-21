import { useDataFileData } from '@arcanejs/react-toolkit/data';
import { FC, ReactNode, useEffect, useMemo, useState } from 'react';
import { ToolboxConfigData } from '../config';
import {
  InputConfig,
  InputMidiDefinition,
  InputState,
  isInputMidiDefinition,
  TimecodeInstance,
} from '../components/proto';
import { useLogger } from '@arcanewizards/sigil';
import { StateSensitiveComponentProps } from '../types';
import {
  midi,
  MIDIEventListener,
  MIDIInput,
  MIDIMessageEvent,
} from '@arcanewizards/midi';
import { useMidiDeviceWatcher } from '../lib/midi';
import {
  createMIDITimecodeReceiver,
  MIDITimecodePlayState,
} from '@arcanewizards/midi-timecode';

type MidiInputConnectionProps = StateSensitiveComponentProps & {
  uuid: string;
  config: InputConfig;
  connection: InputMidiDefinition;
};

const MidiInputConnection: FC<MidiInputConnectionProps> = ({
  uuid,
  config,
  connection: { target },
  setState,
}) => {
  const log = useLogger();

  const [midiInstance, setMidiInstance] = useState<MIDIInput | null>(null);

  const [midiPlayState, setMidiPlayState] =
    useState<MIDITimecodePlayState | null>(null);

  const [inputState, setInputState] = useState<Omit<InputState, 'timecode'>>({
    status: 'disabled',
    controlledBy: null,
    warnings: [],
    errors: [],
  });

  const { delayMs } = config;

  const m = useMemo(() => {
    try {
      return midi();
    } catch (cause) {
      const error = new Error('Failed to initialize MIDI', { cause });
      log.error(error);
      setInputState({
        status: 'error',
        controlledBy: null,
        errors: [`${error}`],
      });
      return null;
    }
  }, [log]);

  const name = target.type === 'virtual' ? config.name : target.deviceName;

  const inputInfo = useMidiDeviceWatcher(log, m, 'inputs', target);

  useEffect(
    () =>
      setState((current) => ({
        ...current,
        inputs: {
          ...current.inputs,
          [uuid]: {
            ...inputState,
            timecode: midiPlayState
              ? ({
                  metadata: null,
                  name: null,
                  state:
                    midiPlayState.state === 'playing'
                      ? {
                          state: 'playing',
                          // TODO
                          accuracyMillis: null,
                          appliedDelayMillis: delayMs ?? 0,
                          smpteMode: midiPlayState.smpteMode,
                          onAir: null,
                          speed: midiPlayState.speed,
                          effectiveStartTimeMillis:
                            midiPlayState.effectiveStartTime + (delayMs ?? 0),
                        }
                      : {
                          state: 'stopped',
                          accuracyMillis: null,
                          appliedDelayMillis: delayMs ?? 0,
                          smpteMode: null,
                          onAir: null,
                          positionMillis:
                            midiPlayState.currentTimeMillis - (delayMs ?? 0),
                        },
                } satisfies TimecodeInstance)
              : null,
          },
        },
      })),
    [setState, uuid, midiPlayState, inputState, delayMs, name],
  );

  useEffect(() => {
    if (!m) {
      return;
    }

    // Reset timecode state when config changes
    setMidiPlayState(null);

    let input: MIDIInput | null = null;
    if (!name?.trim()) {
      setInputState({
        status: 'disabled',
        controlledBy: null,
        warnings: [
          target.type === 'virtual'
            ? 'Please specify a name for your virtual MIDI device'
            : 'No MIDI input device selected',
        ],
      });
      return;
    }
    setInputState({ status: 'connecting', controlledBy: null });

    if (inputInfo === 'loading') {
      return;
    }

    const inputPromise =
      target.type === 'virtual'
        ? m.createVirtualInput(name)
        : Promise.resolve(inputInfo).then((found) => {
            if (!found) {
              throw new Error(
                `MIDI input device "${target.deviceName}" not found`,
              );
            }
            return midi().openInput(found);
          });

    inputPromise
      .then((created) => {
        log.info(`MIDI Timecode input ${name} initialized`);
        input = created;
        setMidiInstance(created);
      })
      .catch((cause) => {
        const error = new Error('Failed to initialize MIDI input', { cause });
        log.error(error);
        setInputState({
          status: 'error',
          controlledBy: null,
          errors: [`${cause}`],
        });
      });

    return () => {
      try {
        input?.close();
      } catch (cause) {
        const error = new Error('Failed to close MIDI input', { cause });
        log.error(error);
      }
      setMidiInstance((current) => (input === current ? null : current));
    };
  }, [setInputState, name, uuid, target, log, m, inputInfo]);

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

  useEffect(() => {
    if (!midiInstance) {
      return;
    }

    const receiver = createMIDITimecodeReceiver({
      handlePlayStateChange: setMidiPlayState,
    });

    const listener: MIDIEventListener<MIDIMessageEvent> = (e) => {
      receiver.receiveMessage(e.message);
    };

    midiInstance.addEventListener('message', listener);

    return () => {
      midiInstance.removeEventListener('message', listener);
    };
  }, [midiInstance]);

  return null;
};

export const MidiInputConnections: FC<StateSensitiveComponentProps> = (
  props,
) => {
  const { inputs } = useDataFileData(ToolboxConfigData);
  return Object.entries(inputs)
    .filter(([_, { enabled }]) => enabled)
    .map<ReactNode>(([uuid, input]) => {
      const connection = input.definition;
      if (!isInputMidiDefinition(connection)) {
        return null;
      }
      return (
        <MidiInputConnection
          key={uuid}
          uuid={uuid}
          config={input}
          connection={connection}
          {...props}
        />
      );
    });
};
