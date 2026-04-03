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

  const [state, setLocalState] = useState<TimecodePlayState>({
    state: 'stopped',
    positionMillis: 0,
  });

  const { speed } = generator;

  const play = useCallback(() => {
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

  useEffect(() => {
    setHandlers((current) => updateTreeState(current, id, { play, pause }));
  }, [setHandlers, id, play, pause]);

  useEffect(
    () =>
      setState((current) => ({
        ...current,
        generators: {
          ...current.generators,
          [uuid]: {
            timecode: {
              metadata: null,
              name: null,
              state: {
                accuracyMillis: null,
                smpteMode: null,
                onAir: null,
                ...state,
              },
            },
          },
        },
      })),
    [setState, uuid, state, config.name],
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
