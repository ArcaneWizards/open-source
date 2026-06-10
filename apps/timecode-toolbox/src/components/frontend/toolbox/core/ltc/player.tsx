import { FC, useCallback, useContext, useEffect, useMemo } from 'react';
import {
  isPlaying,
  isStopped,
  OutputConfig,
  TimecodeInstance,
} from '../../../../proto';
import { AudioPlaybackContext, RootAudioContext } from '../audio-context';
import { StageContext } from '@arcanejs/toolkit-frontend';
import { useApplicationState } from '../../context';
import { createLTCWriter } from '@arcanewizards/ltc';
import {
  BrowserCloseListener,
  useBrowserContext,
} from '@arcanewizards/sigil/frontend';
import { LtcContext, LtcContextData, LtcState } from './shared';

type WithLtcPlayerProps = {
  uuid: string;
  config: OutputConfig;
  timecode: TimecodeInstance | null;
  children: React.ReactNode;
};

export const WithLtcPlayer: FC<WithLtcPlayerProps> = ({
  uuid,
  config,
  timecode,
  children,
}) => {
  const { ctx, errors: audioContextErrors } = useContext(AudioPlaybackContext);
  const { updateOutputState, releaseControl } = useContext(RootAudioContext);

  const { outputs } = useApplicationState();

  const { timeDifferenceMs, connectionUuid } = useContext(StageContext);

  const { addCloseListener, removeCloseListener } = useBrowserContext();

  const startLtcConnection = useCallback(() => {
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

  const { ctx: context, masterGain } = ctx();

  const ltcWriter = useMemo(() => {
    if (!haveControl || !config.enabled) {
      // Do nothing
      return null;
    }

    const writer = createLTCWriter({
      ctx: context,
      channels: masterGain.channelCount,
    });
    writer.getOutput().connect(masterGain);
    return writer;
  }, [context, masterGain, haveControl, config.enabled]);

  useEffect(() => {
    if (ltcWriter) {
      // Prevent window from being closed without confirmation
      const handleClose: BrowserCloseListener = () => ({
        action: 'confirm',
        confirmation:
          'LTC output playing from this window, closing it will stop it. Are you sure you want to close?',
      });
      addCloseListener(handleClose);
      return () => {
        removeCloseListener(handleClose);
      };
    }
  }, [ltcWriter, addCloseListener, removeCloseListener]);

  useEffect(() => {
    if (!ltcWriter) {
      return;
    }

    return () => {
      // Stop LTC playback whenever the writer is replaced / removed
      ltcWriter.close();
    };
  }, [ltcWriter]);

  useEffect(() => {
    if (!ltcWriter || !timecode) {
      return;
    }

    if (isPlaying(timecode.state) && timecode.state.smpteMode) {
      ltcWriter.setPlayState(0, {
        state: 'playing',
        effectiveStartTime:
          timecode.state.effectiveStartTimeMillis - (timeDifferenceMs ?? 0),
        smpteMode: timecode.state.smpteMode,
        speed: timecode.state.speed,
      });
    } else {
      ltcWriter.setPlayState(0, {
        state: 'stopped',
        currentTimeMillis: isStopped(timecode.state)
          ? timecode.state.positionMillis
          : 0,
      });
    }
  }, [ltcWriter, timecode, timeDifferenceMs]);

  const release = useCallback(() => {
    // We use force here as it's called by both this provider,
    // and when the user presses the disconnect button
    releaseControl(['output', uuid], true);
  }, [releaseControl, uuid]);

  useEffect(() => {
    // Release control when the component is unmounted
    // (e.g. switched to different screen)
    if (haveControl) {
      return () => {
        release();
      };
    }
  }, [release, haveControl, uuid]);

  const ltcData: LtcContextData = useMemo(
    () => ({
      state,
      startLtcConnection,
      release,
      /**
       * Pass along audio context errors directly,
       * as we report errors here using updateOutputState so it appears on all
       * connected clients.
       *
       * TODO: pass all errors into server state and remove this arg.
       */
      errors: audioContextErrors,
    }),
    [state, startLtcConnection, release, audioContextErrors],
  );

  return <LtcContext.Provider value={ltcData}>{children}</LtcContext.Provider>;
};
