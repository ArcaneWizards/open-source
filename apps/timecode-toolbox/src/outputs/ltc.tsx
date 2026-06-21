import { Dispatch, FC, SetStateAction, useContext, useEffect } from 'react';
import { ApplicationState } from '../components/proto';
import { ConnectionsContext } from '@arcanejs/react-toolkit/connections';
import { ToolboxConfigData } from '../config';
import { useDataFileData } from '@arcanejs/react-toolkit/data';
import { StateSensitiveComponentProps } from '../types';

export const LtcOutputsStateManager: FC<StateSensitiveComponentProps> = ({
  state,
  setState,
}) => {
  const { outputs } = useDataFileData(ToolboxConfigData);

  return (
    <>
      {Object.entries(outputs)
        .filter(([_, output]) => output.definition.type === 'ltc')
        .map(([uuid]) => (
          <LtcOutputCleanup
            key={`${uuid}-cleanup`}
            uuid={uuid}
            state={state}
            setState={setState}
          />
        ))}
    </>
  );
};

type LtcOutputCleanupProps = {
  uuid: string;
  state: ApplicationState;
  setState: Dispatch<SetStateAction<ApplicationState>>;
};

const LtcOutputCleanup: FC<LtcOutputCleanupProps> = ({
  uuid,
  state,
  setState,
}) => {
  const { connections } = useContext(ConnectionsContext);

  const matchingConnection = !!connections.find(
    (c) => c.uuid === state.outputs?.[uuid]?.controlledBy?.uuid,
  );

  useEffect(() => {
    if (!matchingConnection) {
      // Clean up state & handlers for this player
      setState((current) => ({
        ...current,
        outputs: Object.fromEntries(
          Object.entries(current.outputs ?? {}).filter(([g]) => g !== uuid),
        ),
      }));
    }
  }, [uuid, matchingConnection, setState]);

  return null;
};
