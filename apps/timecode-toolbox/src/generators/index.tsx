import { FC } from 'react';
import { ClockGenerators } from './clock';
import { HandlersUpdater, StateSensitiveComponentProps } from '../types';

type GeneratorsProps = StateSensitiveComponentProps & {
  setHandlers: HandlersUpdater;
};

export const Generators: FC<GeneratorsProps> = (props) => {
  return (
    <>
      <ClockGenerators {...props} />
    </>
  );
};
