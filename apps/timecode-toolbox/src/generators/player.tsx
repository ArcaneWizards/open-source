import { FC, useCallback, useEffect } from 'react';
import { TimecodeMetadata } from '../components/proto';
import { ToolboxConfigData } from '../config';
import { useDataFileData } from '@arcanejs/react-toolkit/data';
import { parseFile } from 'music-metadata';
import { useLogger } from '@arcanewizards/sigil';

type LoadedMetadata = {
  path: string;
  state:
    | {
        state: 'loading';
      }
    | {
        state: 'loaded';
        metadata: TimecodeMetadata;
      }
    | {
        state: 'error';
        error: string;
      };
};

export type PlayerState = {
  metadata: Record<string, LoadedMetadata | undefined>;
};

export const INITIAL_PLAYER_STATE: PlayerState = {
  metadata: {},
};

type PlayerMetadataFetchersProps = {
  updateState: (update: (current: PlayerState) => PlayerState) => void;
};

export const PlayerMetadataFetchers: FC<PlayerMetadataFetchersProps> = ({
  updateState,
}) => {
  const { generators } = useDataFileData(ToolboxConfigData);

  return (
    <>
      {Object.entries(generators)
        .filter(([_, gen]) => gen.definition.type === 'player')
        .map(([uuid]) => (
          <PlayerMetadataFetcher
            key={uuid}
            uuid={uuid}
            updateState={updateState}
          />
        ))}
    </>
  );
};

type PlayerMetadataFetcherProps = PlayerMetadataFetchersProps & {
  uuid: string;
};

const PlayerMetadataFetcher: FC<PlayerMetadataFetcherProps> = ({
  uuid,
  updateState,
}) => {
  const { generators } = useDataFileData(ToolboxConfigData);
  const logger = useLogger();

  const filePath =
    generators[uuid]?.definition.type === 'player'
      ? generators[uuid].definition.filePath
      : null;

  const updateMetadata = useCallback(
    (metadata: LoadedMetadata['state'], force?: boolean) =>
      updateState((current) => {
        const existing = current.metadata[uuid];
        if (!force && existing?.path !== filePath) {
          // File path has changed, don't update metadata for old file
          return current;
        }
        return {
          ...current,
          metadata: {
            ...current.metadata,
            [uuid]: {
              path: filePath ?? '',
              state: metadata,
            },
          },
        };
      }),
    [uuid, filePath, updateState],
  );

  useEffect(() => {
    if (!filePath) {
      return;
    }

    updateMetadata({ state: 'loading' }, true);

    parseFile(filePath)
      .then((metadata) => {
        const common = metadata.common;
        updateMetadata({
          state: 'loaded',
          metadata: {
            title: common.title ?? null,
            artist: common.artist ?? null,
            totalTime: metadata.format.duration
              ? {
                  precisionMillis: 0,
                  timeMillis: Math.round(metadata.format.duration * 1000),
                }
              : null,
          },
        });
      })
      .catch((cause) => {
        const error = new Error(
          `Failed to load metadata for file: ${filePath}`,
          { cause },
        );
        logger.error(error);
        updateMetadata({
          state: 'error',
          error: error.message,
        });
      });
  }, [filePath, updateState, updateMetadata, logger]);

  return null;
};
