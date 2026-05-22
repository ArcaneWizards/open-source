import { createContext, FC, useCallback, useContext, useState } from 'react';
import { GeneratorConfig } from '../../../proto';
import { useFileResolver } from '../hooks';
import { ConfigContext } from '../context';
import { SettingsProps } from '../types';

export type LoadFileCallback = (file: File | null) => void;

export type RootAudioContextData = {
  downloadAudioFile: (
    generatorUuid: string,
  ) => Promise<ReadableStream<Uint8Array<ArrayBuffer>>>;
};

export const RootAudioContext = createContext<RootAudioContextData>({
  downloadAudioFile: async () => {
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

export const WithAudioPlayer: FC<WithAudioPlayerProps> = ({
  uuid,
  timecodeDisplay,
}) => {
  const { updateConfig } = useContext(ConfigContext);
  const { downloadAudioFile } = useContext(RootAudioContext);
  const resolveFile = useFileResolver();

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

  const loadFile = useCallback(
    (file: File | null) => {
      updateSettings((current) => {
        if (current.definition.type !== 'player') {
          return current;
        }
        const resolvedFile = file ? resolveFile(file) : null;
        return {
          ...current,
          definition: {
            ...current.definition,
            filePath:
              resolvedFile && resolvedFile.type === 'local'
                ? resolvedFile.filePath
                : null,
          },
        };
      });
    },
    [resolveFile, updateSettings],
  );

  const startPlayer = useCallback(
    () =>
      downloadAudioFile(uuid)
        .then((file) => {
          // eslint-disable-next-line no-console
          console.log('Received audio file stream', file);
        })
        .catch((error) => {
          // eslint-disable-next-line no-console
          console.error('Error loading audio file', error);
          setErrors([`Error loading audio file: ${error.message}`]);
        }),
    [downloadAudioFile, uuid],
  );

  return timecodeDisplay({ loadFile, startPlayer, errors });
};
