import { FC } from 'react';
import { ArtnetOutputConnections } from './artnet';
import { StateSensitiveComponentProps } from '../types';

export const OutputConnections: FC<StateSensitiveComponentProps> = (props) => {
  return (
    <>
      <ArtnetOutputConnections {...props} />
    </>
  );
};
