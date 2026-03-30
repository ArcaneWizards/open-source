import { Dispatch, SetStateAction } from 'react';
import {
  ApplicationState,
  InputOrGenInstance,
  isTimecodeGroup,
  isTimecodeInstance,
  TimecodeInstance,
  TimecodeState,
} from './components/proto';

export const isKeyedEntry =
  <K, I, O extends I>(typeGuard: (value: I) => value is O) =>
  (entry: [K, I]): entry is [K, O] =>
    entry.length === 2 && typeGuard(entry[1]);

export type StateSensitiveComponentProps = {
  state: ApplicationState;
  setState: Dispatch<SetStateAction<ApplicationState>>;
};

export const getTimecodeInstance = (
  state: ApplicationState,
  id: InputOrGenInstance,
): TimecodeInstance | null => {
  const [firstId, ...remainingPath] = id.id;
  if (!firstId) {
    return null;
  }
  let current =
    state[id.type === 'input' ? 'inputs' : 'generators'][firstId]?.timecode ??
    null;
  for (const idPart of remainingPath) {
    if (!current || !isTimecodeGroup(current)) {
      return null;
    }
    current = current.timecodes[idPart] ?? null;
  }
  if (isTimecodeInstance(current)) {
    return current;
  }
  return null;
};

export const adjustTimecodeForDelay = (
  state: TimecodeState,
  delayMillis: number,
): TimecodeState => {
  if (state.state === 'playing' || state.state === 'lagging') {
    return {
      ...state,
      effectiveStartTimeMillis: state.effectiveStartTimeMillis + delayMillis,
    };
  } else if (state.state === 'stopped') {
    return {
      ...state,
      positionMillis: state.positionMillis - delayMillis,
    };
  }
  return state;
};
