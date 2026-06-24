import { FC } from 'react';
import { ArtnetInputConnections } from './artnet';
import { TcNetInputConnections } from './tcnet';
import { StateSensitiveComponentPropsWithMidi } from '../types';
import { MidiInputConnections } from './midi';
import { LtcInputsStateManager } from './ltc';

export const InputConnections: FC<StateSensitiveComponentPropsWithMidi> = ({
  midi,
  ...props
}) => {
  return (
    <>
      <ArtnetInputConnections {...props} />
      <TcNetInputConnections {...props} />
      <MidiInputConnections midi={midi} {...props} />
      <LtcInputsStateManager {...props} />
    </>
  );
};
