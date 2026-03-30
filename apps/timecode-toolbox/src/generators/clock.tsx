import { FC, ReactNode, useEffect, useState } from 'react';
import {
  GeneratorClockDefinition,
  GeneratorConfig,
  TimecodeState,
} from '../components/proto';
import { StateSensitiveComponentProps } from '../util';
import { useDataFileData } from '@arcanejs/react-toolkit/data';
import { ToolboxConfigData } from '../config';

type ClockGeneratorProps = StateSensitiveComponentProps & {
  uuid: string;
  config: GeneratorConfig;
  generator: GeneratorClockDefinition;
};

export const ClockGenerator: FC<ClockGeneratorProps> = ({
  uuid,
  config,
  generator,
  setState,
}) => {
  const [state] = useState<TimecodeState>({
    accuracyMillis: null,
    smpteMode: null,
    onAir: null,
    state: 'playing',
    effectiveStartTimeMillis: Date.now(),
    speed: generator.speed,
  });

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
              state,
            },
          },
        },
      })),
    [setState, uuid, state, config.name],
  );

  useEffect(
    () => () =>
      setState((current) => {
        const { [uuid]: _, ...rest } = current.generators;
        return {
          ...current,
          generators: rest,
        };
      }),
    [setState, uuid],
  );

  return null;
};

export const ClockGenerators: FC<StateSensitiveComponentProps> = (props) => {
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
