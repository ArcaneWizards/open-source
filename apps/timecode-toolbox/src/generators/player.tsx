import {
  Dispatch,
  FC,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
} from 'react';
import {
  ApplicationState,
  GeneratorInstanceId,
  TimecodeMetadata,
} from '../components/proto';
import { ToolboxConfigData } from '../config';
import { useDataFileData } from '@arcanejs/react-toolkit/data';
import { parseFile } from 'music-metadata';
import { useLogger } from '@arcanewizards/sigil';
import { ConnectionsContext } from '@arcanejs/react-toolkit/connections';
import { TimecodeHandlers } from '../types';
import { updateTreeState } from '../tree';

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
  setPlayerState: Dispatch<SetStateAction<PlayerState>>;
  state: ApplicationState;
  setState: Dispatch<SetStateAction<ApplicationState>>;
  setHandlers: Dispatch<SetStateAction<TimecodeHandlers>>;
};

export const PlayerStateManager: FC<PlayerMetadataFetchersProps> = ({
  setPlayerState,
  state,
  setState,
  setHandlers,
}) => {
  const { generators } = useDataFileData(ToolboxConfigData);

  return (
    <>
      {Object.entries(generators)
        .filter(([_, gen]) => gen.definition.type === 'player')
        .map(([uuid]) => (
          <PlayerCleanup
            key={`${uuid}-cleanup`}
            uuid={uuid}
            state={state}
            setState={setState}
            setHandlers={setHandlers}
          />
        ))}
      {Object.entries(generators)
        .filter(([_, gen]) => gen.definition.type === 'player')
        .map(([uuid]) => (
          <PlayerMetadataFetcher
            key={uuid}
            uuid={uuid}
            setPlayerState={setPlayerState}
          />
        ))}
    </>
  );
};

type PlayerCleanupProps = {
  uuid: string;
  state: ApplicationState;
  setState: Dispatch<SetStateAction<ApplicationState>>;
  setHandlers: Dispatch<SetStateAction<TimecodeHandlers>>;
};

const PlayerCleanup: FC<PlayerCleanupProps> = ({
  uuid,
  state,
  setState,
  setHandlers,
}) => {
  const { connections } = useContext(ConnectionsContext);

  const matchingConnection = !!connections.find(
    (c) => c.uuid === state.generators?.[uuid]?.controlledBy?.uuid,
  );

  useEffect(() => {
    if (!matchingConnection) {
      // Clean up state & handlers for this player
      setState((current) => ({
        ...current,
        generators: Object.fromEntries(
          Object.entries(current.generators ?? {}).filter(([g]) => g !== uuid),
        ),
      }));
      const id: GeneratorInstanceId = ['generator', uuid];
      setHandlers((current) => updateTreeState(current, id, {}));
    }
  }, [uuid, matchingConnection, setState, setHandlers]);

  return null;
};

type PlayerMetadataFetcherProps = {
  uuid: string;
  setPlayerState: Dispatch<SetStateAction<PlayerState>>;
};

const PlayerMetadataFetcher: FC<PlayerMetadataFetcherProps> = ({
  uuid,
  setPlayerState,
}) => {
  const { generators } = useDataFileData(ToolboxConfigData);
  const logger = useLogger();

  const filePath =
    generators[uuid]?.definition.type === 'player'
      ? generators[uuid].definition.filePath
      : null;

  const updateMetadata = useCallback(
    (metadata: LoadedMetadata['state'], force?: boolean) =>
      setPlayerState((current) => {
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
    [uuid, filePath, setPlayerState],
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
            /**
             * Avoid loading time until we have actually loaded it in the player,
             * so we don't have any issues caused by a discrepancy between
             * metadata parsing and AudioContext decoded track data.
             */
            totalTime: null,
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
  }, [filePath, updateMetadata, logger]);

  return null;
};
