import { Dispatch, FC, SetStateAction, useContext, useEffect } from 'react';
import { ApplicationState } from '../components/proto';
import { ConnectionsContext } from '@arcanejs/react-toolkit/connections';
import { ToolboxConfigData } from '../config';
import { useDataFileData } from '@arcanejs/react-toolkit/data';
import { StateSensitiveComponentProps } from '../types';

export const LtcInputsStateManager: FC<StateSensitiveComponentProps> = ({
  state,
  setState,
}) => {
  const { inputs } = useDataFileData(ToolboxConfigData);

  return (
    <>
      {Object.entries(inputs)
        .filter(([_, input]) => input.definition.type === 'ltc')
        .map(([uuid]) => (
          <LtcInputCleanup
            key={`${uuid}-cleanup`}
            uuid={uuid}
            state={state}
            setState={setState}
          />
        ))}
    </>
  );
};

type LtcInputCleanupProps = {
  uuid: string;
  state: ApplicationState;
  setState: Dispatch<SetStateAction<ApplicationState>>;
};

const LtcInputCleanup: FC<LtcInputCleanupProps> = ({
  uuid,
  state,
  setState,
}) => {
  const { connections } = useContext(ConnectionsContext);

  const matchingConnection = !!connections.find(
    (c) => c.uuid === state.inputs?.[uuid]?.controlledBy?.uuid,
  );

  useEffect(() => {
    if (!matchingConnection) {
      // Clean up state & handlers for this player
      setState((current) => ({
        ...current,
        inputs: Object.fromEntries(
          Object.entries(current.inputs ?? {}).filter(([g]) => g !== uuid),
        ),
      }));
    }
  }, [uuid, matchingConnection, setState]);

  return null;
};
