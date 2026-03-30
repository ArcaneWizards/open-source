import { FC } from 'react';
import { StateSensitiveComponentProps } from '../util';
import { ClockGenerators } from './clock';

export const Generators: FC<StateSensitiveComponentProps> = (props) => {
  return (
    <>
      <ClockGenerators {...props} />
    </>
  );
};
