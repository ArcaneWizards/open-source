import { FC } from 'react';
import { ArtnetOutputConnections } from './artnet';
import { StateSensitiveComponentPropsWithMidi } from '../types';
import { MIDIOutputConnections } from './midi';
import { LtcOutputsStateManager } from './ltc';

export const OutputConnections: FC<StateSensitiveComponentPropsWithMidi> = ({
  midi,
  ...props
}) => {
  return (
    <>
      <ArtnetOutputConnections {...props} />
      <MIDIOutputConnections midi={midi} {...props} />
      <LtcOutputsStateManager {...props} />
    </>
  );
};
