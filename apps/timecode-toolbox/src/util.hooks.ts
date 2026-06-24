import { useEffect, useState } from 'react';
import { TimecodeInstance, TimecodePlayState } from './components/proto';
import { adjustTimecodeForDelay } from './util';

/**
 * A hook that only changes the returned value when the play state has
 * substantially changed,
 * to avoid re-transmission of timecode data when irrelevant data changes
 * (such as track metadata, or accuracy / onAir state).
 */
export const useTimecodePlayStateForTransmission = (
  instance: TimecodeInstance | null,
  delayMillis: number,
  applyDelayToStopped: boolean,
): TimecodePlayState | null => {
  const [state, setState] = useState<TimecodePlayState | null>(null);

  useEffect(() => {
    if (!instance) {
      setState(null);
      return;
    }

    const adjustedState = adjustTimecodeForDelay(
      instance.state,
      delayMillis,
      applyDelayToStopped,
    );

    setState((prevState): TimecodePlayState => {
      if (!prevState) {
        return adjustedState;
      }

      if (adjustedState.state === 'stopped') {
        if (
          prevState.state === 'stopped' &&
          prevState.positionMillis === adjustedState.positionMillis
        ) {
          // not significant, don't return new object
          return prevState;
        }
        // significant change, return new object
        return adjustedState;
      }

      if (
        adjustedState.state === 'playing' ||
        adjustedState.state === 'lagging'
      ) {
        if (
          prevState.state === adjustedState.state &&
          prevState.effectiveStartTimeMillis ===
            adjustedState.effectiveStartTimeMillis &&
          prevState.speed === adjustedState.speed
        ) {
          // not significant, don't return new object
          return prevState;
        }
        // significant change, return new object
        return adjustedState;
      }

      if (adjustedState.state === 'analysing') {
        if (
          prevState.state === 'analysing' &&
          prevState.message === adjustedState.message
        ) {
          // not significant, don't return new object
          return prevState;
        }
        // significant change, return new object
        return adjustedState;
      }

      if (
        adjustedState.state === 'none' ||
        adjustedState.state === 'unloaded'
      ) {
        if (prevState.state !== adjustedState.state) {
          return adjustedState;
        } else {
          return prevState;
        }
      }

      const _exhaustiveCheck: never = adjustedState.state;
      throw new Error(`Unhandled state: ${_exhaustiveCheck}`);
    });
  }, [instance, delayMillis, applyDelayToStopped]);

  return state;
};
