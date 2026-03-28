export const ARTNET_PORT = 6454;

export const TIMECODE_MODES = {
  FILM: 0,
  EBU: 1,
  DF: 2,
  SMPTE: 3,
};

export type TimecodeMode = keyof typeof TIMECODE_MODES;

export const TIMECODE_FPS: Record<TimecodeMode, number> = {
  FILM: 24,
  EBU: 25,
  DF: 29.97,
  SMPTE: 30,
};
