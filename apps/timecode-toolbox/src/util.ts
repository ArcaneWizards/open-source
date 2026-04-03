import {
  ApplicationState,
  InputOrGenInstance,
  isTimecodeGroup,
  isTimecodeInstance,
  OutputConfig,
  TimecodeInstance,
  TimecodeState,
} from './components/proto';

export const isKeyedEntry =
  <K, I, O extends I>(typeGuard: (value: I) => value is O) =>
  (entry: [K, I]): entry is [K, O] =>
    entry.length === 2 && typeGuard(entry[1]);

export const getTimecodeInstance = (
  state: ApplicationState,
  id: InputOrGenInstance,
): TimecodeInstance | null => {
  const [type, firstId, ...remainingPath] = id;
  if (!firstId) {
    return null;
  }
  let current =
    state[type === 'input' ? 'inputs' : 'generators'][firstId]?.timecode ??
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

export const augmentUpstreamTimecodeWithOutputMetadata = (
  tc: TimecodeInstance | null,
  config: OutputConfig,
): TimecodeInstance => {
  if (!tc) {
    return {
      name: null,
      metadata: null,
      state: {
        state: 'none',
        accuracyMillis: null,
        smpteMode: config.definition.mode,
        onAir: null,
      },
    };
  }
  // Adjust the timecode instance with output-specific metadata
  return {
    name: null,
    metadata: tc.metadata,
    state: {
      ...adjustTimecodeForDelay(tc.state, config.delayMs ?? 0),
      smpteMode: config.definition.mode,
    },
  };
};
