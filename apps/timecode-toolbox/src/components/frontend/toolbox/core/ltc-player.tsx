import { FC, useCallback, useContext, useEffect, useMemo } from 'react';
import { UniversalConfig } from '../../../proto';
import { LtcState, TimecodeDisplayProps } from './timecode-display';
import { AudioPlaybackContext, RootAudioContext } from './audio-context';
import { StageContext } from '@arcanejs/toolkit-frontend';
import { useApplicationState } from '../context';

type WithLtcPlayerProps = {
  uuid: string;
  config: UniversalConfig;
  timecodeDisplay: (props: {
    ltc: TimecodeDisplayProps['ltc'];
    errors: string[];
  }) => React.ReactNode;
};

export const WithLtcPlayer: FC<WithLtcPlayerProps> = ({
  uuid,
  config,
  timecodeDisplay,
}) => {
  const { ctx, errors: audioContextErrors } = useContext(AudioPlaybackContext);
  const { updateOutputState, releaseControl } = useContext(RootAudioContext);

  const { outputs } = useApplicationState();

  const { timeDifferenceMs, connectionUuid } = useContext(StageContext);

  const startLtcPlayback = useCallback(() => {
    // Claim control of the output to trigger playback
    updateOutputState(uuid, true, { status: 'connecting', errors: [] });
  }, [updateOutputState, uuid]);

  const state: LtcState = useMemo(() => {
    const controlledBy = outputs?.[uuid]?.controlledBy;
    if (!controlledBy) {
      return null;
    }
    if (controlledBy.uuid === connectionUuid) {
      return 'here';
    }
    return 'elsewhere';
  }, [outputs, uuid, connectionUuid]);

  const haveControl = state === 'here';

  useEffect(() => {
    if (!haveControl) {
      // Do nothing
      return;
    }

    alert('Starting LTC playback');
  }, [haveControl]);

  useEffect(() => {
    // Release control when the component is unmounted
    // (e.g. switched to different screen)
    return () => {
      releaseControl(['output', uuid]);
    };
  }, [releaseControl, uuid]);

  const ltc: TimecodeDisplayProps['ltc'] = useMemo(
    () => ({
      state,
      startLtcPlayback,
    }),
    [state, startLtcPlayback],
  );

  /**
   * Pass along audio context errors directly,
   * as we report errors here using updateOutputState so it appears on all
   * connected clients.
   */
  return timecodeDisplay({ ltc, errors: audioContextErrors });
};
