import { FC, useCallback, useContext } from 'react';
import { GeneratorConfig } from '../../../proto';
import { useFileResolver } from '../hooks';
import { ConfigContext } from '../context';
import { SettingsProps } from '../types';

export type LoadFileCallback = (file: File | null) => void;

type WithAudioPlayerProps = {
  uuid: string;
  timecodeDisplay: (props: { loadFile: LoadFileCallback }) => React.ReactNode;
};

export const WithAudioPlayer: FC<WithAudioPlayerProps> = ({
  uuid,
  timecodeDisplay,
}) => {
  const { updateConfig } = useContext(ConfigContext);
  const resolveFile = useFileResolver();

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

  return timecodeDisplay({ loadFile });
};
