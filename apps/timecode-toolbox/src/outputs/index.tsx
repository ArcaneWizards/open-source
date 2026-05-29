import { FC } from 'react';
import { ArtnetOutputConnections } from './artnet';
import { StateSensitiveComponentProps } from '../types';
import { MIDIOutputConnections } from './midi';

export const OutputConnections: FC<StateSensitiveComponentProps> = (props) => {
  return (
    <>
      <ArtnetOutputConnections {...props} />
      <MIDIOutputConnections {...props} />
    </>
  );
};
