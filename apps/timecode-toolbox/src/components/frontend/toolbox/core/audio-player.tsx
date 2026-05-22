import {
  createContext,
  FC,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  GeneratorConfig,
  GeneratorState,
  isPlaying,
  isTimecodeToolboxControlPlaybackRequest,
  TimecodeMetadata,
  TimecodePlayStatePlayingOrLagging,
  TimecodePlayStateStopped,
} from '../../../proto';
import { useFileResolver } from '../hooks';
import { ConfigContext } from '../context';
import { SettingsProps } from '../types';
import { parseBuffer } from 'music-metadata';
import {
  StageContext,
  useNotificationHandler,
} from '@arcanejs/toolkit-frontend';

export type LoadFileCallback = (file: File | null) => void;

export type RootAudioContextData = {
  downloadAudioFile: (
    generatorUuid: string,
  ) => Promise<ReadableStream<Uint8Array<ArrayBuffer>>>;
  updatePlayerState: (
    generatorUuid: string,
    claim: boolean,
    state: Omit<GeneratorState, 'controlledBy'>,
  ) => void;
};

export const RootAudioContext = createContext<RootAudioContextData>({
  downloadAudioFile: async () => {
    throw new Error('RootAudioContext not initialized');
  },
  updatePlayerState: () => {
    throw new Error('RootAudioContext not initialized');
  },
});

type WithAudioPlayerProps = {
  uuid: string;
  timecodeDisplay: (props: {
    loadFile: LoadFileCallback;
    /**
     * Called when the browser should download the audio file from the server,
     * load it into the audio context, and start the playback.
     */
    startPlayer: () => void;
    errors: string[];
  }) => React.ReactNode;
};

type LoadedAudio = {
  metadata: TimecodeMetadata;
  buffer: AudioBuffer;
  autoplay: boolean;
};

type PlayingAudio = {
  loadedAudio: LoadedAudio;
  source?: AudioBufferSourceNode;
  state: TimecodePlayStatePlayingOrLagging | TimecodePlayStateStopped;
};

const readFile = (file: File) =>
  new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      resolve(ev.target?.result as ArrayBuffer);
    };
    reader.onerror = () => {
      reader.abort();
      reject(reader.error);
    };
    reader.readAsArrayBuffer(file);
  });

export const WithAudioPlayer: FC<WithAudioPlayerProps> = ({
  uuid,
  timecodeDisplay,
}) => {
  const { updateConfig } = useContext(ConfigContext);
  const { downloadAudioFile, updatePlayerState } = useContext(RootAudioContext);
  const resolveFile = useFileResolver();

  const context = useMemo(() => {
    const ctx = new AudioContext();
    const masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);
    return { ctx, masterGain };
  }, []);

  const [loadedAudio, setLoadedAudio] = useState<LoadedAudio | null>(null);

  const [playingAudio, setPlayingAudio] = useState<PlayingAudio | null>(null);

  const [errors, setErrors] = useState<string[]>([]);

  const updateSettings: SettingsProps<GeneratorConfig>['updateSettings'] =
    useCallback(
      (change) => {
        updateConfig((current) => {
          const existing = current.generators?.[uuid];
          if (!existing) {
            return current;
          }
          return {
            ...current,
            generators: {
              ...current.generators,
              [uuid]: change(existing),
            },
          };
        });
      },
      [uuid, updateConfig],
    );

  const loadAudioFile = useCallback(
    async (buffer: ArrayBuffer, autoplay: boolean) => {
      try {
        const rawMetadata = await parseBuffer(new Uint8Array(buffer));
        const audioBuffer = await context.ctx.decodeAudioData(buffer);
        const metadata: TimecodeMetadata = {
          totalTime: {
            precisionMillis: 0,
            timeMillis: audioBuffer.duration * 1000,
          },
          artist: rawMetadata.common.artist ?? null,
          title: rawMetadata.common.title ?? null,
        };
        setLoadedAudio({ metadata, buffer: audioBuffer, autoplay });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error decoding audio data', error);
        setErrors([
          `Error decoding audio data: ${error instanceof Error ? error.message : String(error)}`,
        ]);
      }
    },
    [context],
  );

  const loadFile = useCallback(
    (file: File | null) => {
      updateSettings((current) => {
        if (current.definition.type !== 'player') {
          return current;
        }
        if (!file) {
          return {
            ...current,
            definition: {
              ...current.definition,
              filePath: null,
            },
          };
        }
        const resolvedFile = resolveFile(file);
        if (resolvedFile.type === 'local') {
          return {
            ...current,
            definition: {
              ...current.definition,
              filePath: resolvedFile.filePath,
            },
          };
        } else {
          // For non-local files, we need to read the file and load it into the player directly without relying on the file path in the config
          readFile(file).then((buffer) => loadAudioFile(buffer, false));
          // Leave the file path unchanged, as users may want to load it again later
          return current;
        }
      });
    },
    [resolveFile, updateSettings, loadAudioFile],
  );

  const startPlayer = useCallback(
    () =>
      downloadAudioFile(uuid)
        .then((stream) => new Response(stream).arrayBuffer())
        .then((buffer) => loadAudioFile(buffer, true))
        .catch((error) => {
          // eslint-disable-next-line no-console
          console.error('Error loading audio file', error);
          setErrors([`Error loading audio file: ${error.message}`]);
        }),
    [downloadAudioFile, loadAudioFile, uuid],
  );

  useEffect(() => {
    if (!loadedAudio) {
      return;
    }
    updatePlayerState(uuid, true, {
      timecode: {
        name: null,
        metadata: loadedAudio.metadata,
        state: {
          state: 'stopped',
          positionMillis: 0,
          accuracyMillis: 0,
          onAir: null,
          smpteMode: null,
        },
      },
    });

    if (loadedAudio.autoplay) {
      const source = context.ctx.createBufferSource();
      source.buffer = loadedAudio.buffer;
      source.connect(context.masterGain);
      source.start(context.ctx.currentTime);
      setPlayingAudio({
        loadedAudio,
        source,
        state: {
          effectiveStartTimeMillis: Date.now(),
          speed: 1,
          state: 'playing',
        },
      });
    }
  }, [context, updatePlayerState, uuid, loadedAudio]);

  useEffect(() => {
    // Ensure playback is stopped whenever the playing audio is replaced
    if (playingAudio) {
      return () => {
        playingAudio.source?.stop();
      };
    }
  }, [playingAudio]);

  const { timeDifferenceMs } = useContext(StageContext);

  const play = useCallback(
    () =>
      setPlayingAudio((current) => {
        if (!current) {
          return current;
        }
        if (isPlaying(current.state)) {
          return current;
        }
        const source = context.ctx.createBufferSource();
        source.buffer = current.loadedAudio.buffer;
        source.connect(context.masterGain);
        source.start(
          context.ctx.currentTime,
          current.state.positionMillis / 1000,
        );
        return {
          ...current,
          source,
          state: {
            state: 'playing',
            effectiveStartTimeMillis: Date.now() - current.state.positionMillis,
            speed: 1,
          },
        } satisfies PlayingAudio;
      }),
    [context],
  );

  const pause = useCallback(
    () =>
      setPlayingAudio((current) => {
        if (!current || !isPlaying(current.state)) {
          return current;
        }
        const positionMillis =
          (Date.now() - current.state.effectiveStartTimeMillis) *
          current.state.speed;
        return {
          ...current,
          state: {
            state: 'stopped',
            positionMillis,
          },
        } satisfies PlayingAudio;
      }),
    [],
  );

  const seekRelative = useCallback(
    (deltaMillis: number) =>
      setPlayingAudio((current) => {
        if (!current) {
          return current;
        }
        if (isPlaying(current.state)) {
          const positionMillis = Math.max(
            0,
            (Date.now() - current.state.effectiveStartTimeMillis) *
              current.state.speed +
              deltaMillis,
          );
          const source = context.ctx.createBufferSource();
          source.buffer = current.loadedAudio.buffer;
          source.connect(context.masterGain);
          source.start(context.ctx.currentTime, positionMillis / 1000);
          return {
            ...current,
            source,
            state: {
              state: 'playing',
              effectiveStartTimeMillis: Date.now() - positionMillis,
              speed: current.state.speed,
            },
          } satisfies PlayingAudio;
        } else {
          const positionMillis = current.state.positionMillis + deltaMillis;
          return {
            ...current,
            state: {
              ...current.state,
              positionMillis,
            },
          } satisfies PlayingAudio;
        }
      }),
    [context],
  );

  const seekAbsolute = useCallback(
    (positionMillis: number) =>
      setPlayingAudio((current) => {
        if (!current) {
          return current;
        }
        if (isPlaying(current.state)) {
          const source = context.ctx.createBufferSource();
          source.buffer = current.loadedAudio.buffer;
          source.connect(context.masterGain);
          positionMillis = Math.max(positionMillis, 0);
          source.start(context.ctx.currentTime, positionMillis / 1000);
          return {
            ...current,
            source,
            state: {
              state: 'playing',
              effectiveStartTimeMillis: Date.now() - positionMillis,
              speed: current.state.speed,
            },
          } satisfies PlayingAudio;
        } else {
          return {
            ...current,
            state: {
              ...current.state,
              positionMillis,
            },
          } satisfies PlayingAudio;
        }
      }),
    [context],
  );

  useNotificationHandler(
    isTimecodeToolboxControlPlaybackRequest,
    ({ action, generatorUuid }) => {
      if (generatorUuid !== uuid) {
        // For a different player
        return;
      }

      if (action.type === 'play') {
        play();
      }
      if (action.type === 'pause') {
        pause();
      }
      if (action.type === 'seekRelative') {
        seekRelative(action.deltaMillis);
      }
      if (action.type === 'seekAbsolute') {
        seekAbsolute(action.positionMillis);
      }
      if (action.type === 'beginning') {
        seekAbsolute(0);
      }
    },
    [play, pause, seekRelative, seekAbsolute, uuid],
  );

  useEffect(() => {
    if (!playingAudio || !timeDifferenceMs) {
      return;
    }

    const adjustedState:
      | TimecodePlayStatePlayingOrLagging
      | TimecodePlayStateStopped =
      playingAudio.state.state === 'stopped'
        ? playingAudio.state
        : {
            ...playingAudio.state,
            effectiveStartTimeMillis:
              playingAudio.state.effectiveStartTimeMillis - timeDifferenceMs,
          };

    // Update the server with the current player state whenever it changes
    updatePlayerState(uuid, false, {
      timecode: {
        name: null,
        metadata: playingAudio.loadedAudio.metadata,
        state: {
          accuracyMillis: 0,
          onAir: null,
          smpteMode: null,
          ...adjustedState,
        },
      },
    });
  }, [uuid, updatePlayerState, playingAudio, timeDifferenceMs]);

  return timecodeDisplay({ loadFile, startPlayer, errors });
};
