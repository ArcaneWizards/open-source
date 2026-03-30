import { FC } from 'react';
import { ArtnetInputConnections } from './artnet';
import { TcNetInputConnections } from './tcnet';
import { StateSensitiveComponentProps } from '../types';

export const InputConnections: FC<StateSensitiveComponentProps> = (props) => {
  return (
    <>
      <ArtnetInputConnections {...props} />
      <TcNetInputConnections {...props} />
    </>
  );
};
