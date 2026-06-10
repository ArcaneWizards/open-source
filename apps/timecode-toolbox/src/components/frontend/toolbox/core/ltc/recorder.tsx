import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  InputConfig,
  InputLtcDefinition,
  TimecodePlayStateAnalysing,
  TimecodePlayStatePlayingOrLagging,
  TimecodePlayStateStopped,
  UniversalConfigWithDefinition,
} from '../../../../proto';
import { AudioRecordingContext, RootAudioContext } from '../audio-context';
import { useApplicationState } from '../../context';
import { StageContext } from '@arcanejs/toolkit-frontend';
import {
  BrowserCloseListener,
  useBrowserContext,
} from '@arcanewizards/sigil/frontend';
import { LtcContext, LtcContextData, LtcState } from './shared';
import { createLTCReader, LTCTimecodePlayState } from '@arcanewizards/ltc';

type WithLtcRecorderProps = {
  uuid: string;
  config: UniversalConfigWithDefinition<InputLtcDefinition> & InputConfig;
  children: React.ReactNode;
};

export const WithLtcRecorder: React.FC<WithLtcRecorderProps> = ({
  uuid,
  config,
  children,
}) => {
  const {
    setRecordInput,
    ctx,
    errors: audioContextErrors,
  } = useContext(AudioRecordingContext);
  const { updateInputState, releaseControl } = useContext(RootAudioContext);

  const { inputs } = useApplicationState();

  const { timeDifferenceMs, connectionUuid } = useContext(StageContext);

  const { addCloseListener, removeCloseListener } = useBrowserContext();

  const startLtcConnection = useCallback(() => {
    // Claim control of the output to trigger playback
    updateInputState(uuid, true, {
      status: 'connecting',
      timecode: null,
      errors: [],
    });
  }, [updateInputState, uuid]);

  const state: LtcState = useMemo(() => {
    const controlledBy = inputs?.[uuid]?.controlledBy;
    if (!controlledBy) {
      return null;
    }
    if (controlledBy.uuid === connectionUuid) {
      return 'here';
    }
    return 'elsewhere';
  }, [inputs, uuid, connectionUuid]);

  const haveControl = state === 'here';

  const { ctx: context, masterGain } = ctx();

  const [ltcPlayState, setLtcPlayState] = useState<LTCTimecodePlayState | null>(
    null,
  );

  useEffect(() => {
    const enabled = haveControl && config.enabled;
    // Only require that the audio context is recording input
    // while we have control of the LTC input & it's enabled
    setRecordInput(enabled);

    if (!enabled) {
      return;
    }

    const reader = createLTCReader({
      ctx: context,
      channels: masterGain.channelCount,
      handlePlayStateChange: (_channel, state) => {
        // We only include a single channel in masterGain,
        // so we can ignore the channel argument here
        setLtcPlayState(state);
      },
      frameMode:
        config.definition.mode === 'AUTO' ? undefined : config.definition.mode,
    });
    masterGain.connect(reader.getInput());

    const handleClose: BrowserCloseListener = () => ({
      action: 'confirm',
      confirmation:
        'LTC input is being recorded in this window, closing it will stop it. Are you sure you want to close?',
    });
    addCloseListener(handleClose);

    return () => {
      setRecordInput(false);
      reader.close();
      removeCloseListener(handleClose);
    };
  }, [
    haveControl,
    config.enabled,
    config.definition.mode,
    context,
    masterGain,
    addCloseListener,
    removeCloseListener,
    setRecordInput,
  ]);

  const release = useCallback(() => {
    // We use force here as it's called by both this provider,
    // and when the user presses the disconnect button
    releaseControl(['input', uuid], true);
  }, [releaseControl, uuid]);

  useEffect(() => {
    // Analyse and print out the volume periodically
    let lastValue = 0;
    const analyser = context.createAnalyser();
    masterGain.connect(analyser);
    const interval = setInterval(() => {
      const data = new Uint8Array(analyser.fftSize);
      analyser.getByteTimeDomainData(data);
      const value = data.reduce((sum, v) => sum + Math.abs(v - 128), 0);
      if (Math.abs(value - lastValue) > 10) {
        lastValue = value;
        // eslint-disable-next-line no-console
        console.log('Input volume:', value);
      }
    }, 100);

    return () => {
      clearInterval(interval);
    };
  }, [context, masterGain]);

  const { delayMs } = config;

  useEffect(() => {
    if (!haveControl || !ltcPlayState || !timeDifferenceMs) {
      return;
    }

    updateInputState(uuid, true, {
      status: 'active',
      timecode: {
        name: null,
        metadata: null,
        state: {
          ...(ltcPlayState.state === 'detecting-mode'
            ? ({
                state: 'analysing',
                message: 'Analyzing LTC signal to detect framerate...',
              } satisfies TimecodePlayStateAnalysing)
            : ltcPlayState.state === 'playing'
              ? ({
                  state: 'playing',
                  effectiveStartTimeMillis:
                    ltcPlayState.effectiveStartTime -
                    timeDifferenceMs +
                    (delayMs ?? 0),
                  speed: ltcPlayState.speed,
                } satisfies TimecodePlayStatePlayingOrLagging)
              : ({
                  state: 'stopped',
                  positionMillis:
                    ltcPlayState.currentTimeMillis - (delayMs ?? 0),
                } satisfies TimecodePlayStateStopped)),
          accuracyMillis: null,
          smpteMode:
            ltcPlayState.state === 'playing' ? ltcPlayState.smpteMode : null,
          onAir: null,
          appliedDelayMillis: delayMs ?? 0,
        },
      },
      errors: audioContextErrors,
    });
  }, [
    haveControl,
    ltcPlayState,
    updateInputState,
    uuid,
    audioContextErrors,
    delayMs,
    timeDifferenceMs,
  ]);

  const ltcData: LtcContextData = useMemo(
    () => ({
      state,
      startLtcConnection,
      release,
      errors: [],
    }),
    [state, startLtcConnection, release],
  );

  return <LtcContext.Provider value={ltcData}>{children}</LtcContext.Provider>;
};
