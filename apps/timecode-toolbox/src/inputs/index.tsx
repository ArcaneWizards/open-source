import { FC } from 'react';
import { ArtnetInputConnections } from './artnet';
import { StateSensitiveComponentProps } from '../util';
import { TcNetInputConnections } from './tcnet';

export const InputConnections: FC<StateSensitiveComponentProps> = (props) => {
  return (
    <>
      <ArtnetInputConnections {...props} />
      <TcNetInputConnections {...props} />
    </>
  );
};
