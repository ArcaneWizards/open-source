import {
  FC,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  GeneratorClockDefinition,
  GeneratorConfig,
  InputOrGenInstance,
  isPlaying,
  isStopped,
  TimecodePlayState,
} from '../components/proto';
import { useDataFileData } from '@arcanejs/react-toolkit/data';
import { ToolboxConfigData } from '../config';
import { HandlersUpdater, StateSensitiveComponentProps } from '../types';
import { deleteTreePath, updateTreeState } from '../tree';
import { useLogger } from '@arcanewizards/sigil';
import { DateTime } from 'luxon';

type ClockGeneratorProps = StateSensitiveComponentProps & {
  uuid: string;
  config: GeneratorConfig;
  generator: GeneratorClockDefinition;
  setHandlers: HandlersUpdater;
};

export const ClockGenerator: FC<ClockGeneratorProps> = ({
  uuid,
  config,
  generator,
  setState,
  setHandlers,
}) => {
  const id: InputOrGenInstance = useMemo(() => ['generator', uuid], [uuid]);

  const logger = useLogger();

  const [state, setLocalState] = useState<TimecodePlayState>({
    state: 'stopped',
    positionMillis: 0,
  });
  const [errors, setErrors] = useState<string[]>([]);

  const speed = generator.mode === 'manual' ? generator.speed : null;

  const play = useCallback(() => {
    if (!speed) {
      return;
    }
    setLocalState((current) => {
      if (isPlaying(current)) {
        return current;
      }
      const positionMillis = isStopped(current) ? current.positionMillis : 0;
      const effectiveStartTimeMillis = Date.now() - positionMillis / speed;
      return {
        state: 'playing',
        effectiveStartTimeMillis,
        speed,
      };
    });
  }, [speed]);

  const pause = useCallback(() => {
    if (!speed) {
      return;
    }
    setLocalState((current) => {
      if (!isPlaying(current)) {
        return current;
      }
      const positionMillis =
        (Date.now() - current.effectiveStartTimeMillis) * speed;
      return {
        state: 'stopped',
        positionMillis,
      };
    });
  }, [speed]);

  const seekRelative = useCallback(
    (deltaMillis: number) => {
      if (!speed) {
        return;
      }
      setLocalState((current) => {
        if (!isPlaying(current) && !isStopped(current)) {
          return current;
        }
        const now = Date.now();
        const positionMillis = isPlaying(current)
          ? (now - current.effectiveStartTimeMillis) * speed
          : current.positionMillis;
        const newPositionMillis = Math.max(positionMillis + deltaMillis, 0);
        if (isPlaying(current)) {
          const effectiveStartTimeMillis = now - newPositionMillis / speed;
          return {
            ...current,
            effectiveStartTimeMillis,
          };
        } else {
          return {
            ...current,
            positionMillis: newPositionMillis,
          };
        }
      });
    },
    [speed],
  );

  const beginning = useCallback(() => {
    if (!speed) {
      return;
    }
    setLocalState((current) => {
      if (current.state === 'none') {
        return current;
      }
      if (isPlaying(current)) {
        const effectiveStartTimeMillis = Date.now();
        return {
          ...current,
          effectiveStartTimeMillis,
        };
      } else {
        return {
          ...current,
          positionMillis: 0,
        };
      }
    });
  }, [speed]);

  useEffect(() => {
    if (generator.mode === 'system') {
      const timezone =
        generator.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
      const now = new Date().toISOString();
      const initTime = `${now.split('T')[0]}T00:00:00`;
      let effectiveStart = DateTime.fromISO(initTime, {
        zone: timezone,
      });
      effectiveStart.toMillis();

      if (effectiveStart.invalidReason) {
        setErrors([`Unable to start clock: ${effectiveStart.invalidReason}`]);
        return;
      }

      // Ensure that we keep the effective start time within
      // 24hours of now, and in the past
      const dateTimeNow = DateTime.now();
      while (effectiveStart.diff(dateTimeNow).as('days') < -1) {
        effectiveStart = effectiveStart.plus({ days: 1 });
      }
      while (effectiveStart.diff(dateTimeNow).as('days') > 0) {
        effectiveStart = effectiveStart.minus({ days: 1 });
      }

      const effectiveStartTimeMillis = effectiveStart.toMillis();

      setLocalState({
        state: 'playing',
        effectiveStartTimeMillis,
        speed: 1,
      });

      return () => {
        // Reset to 0 when unmounted to avoid continuous playback
        // when switching back to manual
        setLocalState({
          state: 'stopped',
          positionMillis: 0,
        });
        setErrors([]);
      };
    } else {
      const { speed } = generator;
      setLocalState((current) => {
        if (!isPlaying(current)) {
          return current;
        }
        const now = Date.now();
        const positionMillis =
          (now - current.effectiveStartTimeMillis) * current.speed;
        const effectiveStartTimeMillis = now - positionMillis / speed;
        return {
          ...current,
          effectiveStartTimeMillis,
          speed,
        };
      });
    }
  }, [logger, generator]);

  useEffect(() => {
    setHandlers((current) =>
      updateTreeState(
        current,
        id,
        generator.mode === 'manual'
          ? { play, pause, seekRelative, beginning }
          : {},
      ),
    );
  }, [setHandlers, generator.mode, id, play, pause, seekRelative, beginning]);

  useEffect(
    () =>
      setState((current) => ({
        ...current,
        generators: {
          ...current.generators,
          [uuid]: {
            controlledBy: null,
            errors,
            timecode: {
              metadata: null,
              name: null,
              state: {
                accuracyMillis: null,
                smpteMode: null,
                onAir: null,
                appliedDelayMillis: config.delayMs ?? 0,
                ...(isPlaying(state)
                  ? {
                      ...state,
                      effectiveStartTimeMillis:
                        state.effectiveStartTimeMillis + (config.delayMs ?? 0),
                    }
                  : isStopped(state)
                    ? {
                        ...state,
                        positionMillis:
                          state.positionMillis - (config.delayMs ?? 0),
                      }
                    : state),
              },
            },
          },
        },
      })),
    [setState, uuid, state, config.name, config.delayMs, errors],
  );

  useEffect(
    () => () => {
      setState((current) => {
        const { [uuid]: _, ...rest } = current.generators;
        return {
          ...current,
          generators: rest,
        };
      });
      setHandlers((current) => deleteTreePath(current, id));
    },
    [setState, setHandlers, id, uuid],
  );

  return null;
};

type ClockGeneratorsProps = StateSensitiveComponentProps & {
  setHandlers: HandlersUpdater;
};

export const ClockGenerators: FC<ClockGeneratorsProps> = (props) => {
  const { generators } = useDataFileData(ToolboxConfigData);
  return Object.entries(generators).map<ReactNode>(([uuid, input]) => {
    const generator = input.definition;
    if (generator.type !== 'clock') {
      return null;
    }
    return (
      <ClockGenerator
        key={uuid}
        uuid={uuid}
        config={input}
        generator={generator}
        {...props}
      />
    );
  });
};
