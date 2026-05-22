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
  TimecodeMetadata,
  TimecodePlayStatePlayingOrLagging,
} from '../../../proto';
import { useFileResolver } from '../hooks';
import { ConfigContext } from '../context';
import { SettingsProps } from '../types';
import { parseBuffer } from 'music-metadata';

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
  metadata: TimecodeMetadata;
  source: AudioBufferSourceNode;
  state: TimecodePlayStatePlayingOrLagging;
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
      source.start();
      setPlayingAudio({
        metadata: loadedAudio.metadata,
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
        playingAudio.source.stop();
      };
    }
  }, [playingAudio]);

  useEffect(() => {
    if (!playingAudio) {
      return;
    }

    // Update the server with the current player state whenever it changes
    updatePlayerState(uuid, false, {
      timecode: {
        name: null,
        metadata: playingAudio.metadata,
        state: {
          accuracyMillis: 0,
          onAir: null,
          smpteMode: null,
          ...playingAudio.state,
        },
      },
    });
  }, [uuid, updatePlayerState, playingAudio]);

  return timecodeDisplay({ loadFile, startPlayer, errors });
};
