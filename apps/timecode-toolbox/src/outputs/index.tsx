import { FC } from 'react';
import { ArtnetOutputConnections } from './artnet';
import { StateSensitiveComponentProps } from '../util';

export const OutputConnections: FC<StateSensitiveComponentProps> = (props) => {
  return (
    <>
      <ArtnetOutputConnections {...props} />
    </>
  );
};
