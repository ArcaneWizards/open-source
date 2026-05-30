import { SMPTE_TIMECODE_FPS, SMPTETimecodeMode } from '@arcanewizards/smpte';

export const ARTNET_PORT = 6454;

export const TIMECODE_MODES: Record<SMPTETimecodeMode, number> = {
  FILM: 0,
  EBU: 1,
  DF: 2,
  SMPTE: 3,
};

/**
 * @deprecated Use `SMPTE_TIMECODE_FPS` from `@arcanewizards/smpte` instead.
 */
export const TIMECODE_FPS = SMPTE_TIMECODE_FPS;

/**
 * @deprecated Use `TimecodeMode` from `@arcanewizards/smpte` instead.
 */
export type TimecodeMode = SMPTETimecodeMode;
