export type SMPTETimecodeMode = 'FILM' | 'EBU' | 'DF' | 'SMPTE';

export const SMPTE_TIMECODE_FPS: Record<SMPTETimecodeMode, number> = {
  FILM: 24,
  EBU: 25,
  DF: 29.97,
  SMPTE: 30,
};

export type SMPTETimecodeFrame = {
  hours: number;
  minutes: number;
  seconds: number;
  frame: number;
  mode: SMPTETimecodeMode;
};

export type SMPTETimecodeFrameWithMillis = SMPTETimecodeFrame & {
  timeMillis: number;
};

export type SMPTETimecodePlayState =
  | {
      state: 'playing';
      effectiveStartTime: number;
      /**
       * 1.0 means normal speed, 2.0 means double speed, etc.
       * Can be negative for reverse playback,
       *
       * in which case effectiveStartTime represents the time when the track will reach 0:00.
       */
      speed: number;
      smpteMode: SMPTETimecodeMode;
    }
  | {
      state: 'stopped';
      currentTimeMillis: number;
    };

const getDisplayFrameCount = (mode: SMPTETimecodeMode): number => {
  return mode === 'DF' ? 30 : SMPTE_TIMECODE_FPS[mode];
};

export const isValidTimecode = (timecode: SMPTETimecodeFrame): boolean => {
  const displayFrameCount = getDisplayFrameCount(timecode.mode);

  if (
    timecode.hours < 0 ||
    timecode.hours > 23 ||
    timecode.minutes < 0 ||
    timecode.minutes > 59 ||
    timecode.seconds < 0 ||
    timecode.seconds > 59 ||
    timecode.frame < 0 ||
    timecode.frame >= displayFrameCount
  ) {
    return false;
  }

  if (
    timecode.mode === 'DF' &&
    timecode.seconds === 0 &&
    timecode.frame < 2 &&
    timecode.minutes % 10 !== 0
  ) {
    return false;
  }

  return true;
};

const DROP_FRAME_NUMERATOR = 30_000;
const DROP_FRAME_DENOMINATOR = 1_001;
const DROP_FRAME_COUNT = 2;
const DROP_FRAME_FRAMES_PER_SECOND = 30;
const DROP_FRAME_FRAMES_PER_MINUTE =
  DROP_FRAME_FRAMES_PER_SECOND * 60 - DROP_FRAME_COUNT;
const DROP_FRAME_FRAMES_PER_10_MINUTES =
  DROP_FRAME_FRAMES_PER_MINUTE * 9 + DROP_FRAME_FRAMES_PER_SECOND * 60;
const DROP_FRAME_FRAMES_PER_HOUR = DROP_FRAME_FRAMES_PER_10_MINUTES * 6;
const DROP_FRAME_FRAMES_PER_24_HOURS = DROP_FRAME_FRAMES_PER_HOUR * 24;

export const getDropFrameTimecode = (
  timeMillis: number,
): SMPTETimecodeFrameWithMillis => {
  const totalFrames = Math.floor(
    (timeMillis * DROP_FRAME_NUMERATOR) / (1000 * DROP_FRAME_DENOMINATOR),
  );
  const wrappedFrames =
    ((totalFrames % DROP_FRAME_FRAMES_PER_24_HOURS) +
      DROP_FRAME_FRAMES_PER_24_HOURS) %
    DROP_FRAME_FRAMES_PER_24_HOURS;
  const tenMinuteChunks = Math.floor(
    wrappedFrames / DROP_FRAME_FRAMES_PER_10_MINUTES,
  );
  const remainingFrames = wrappedFrames % DROP_FRAME_FRAMES_PER_10_MINUTES;
  const skippedFrames =
    DROP_FRAME_COUNT * 9 * tenMinuteChunks +
    (remainingFrames > DROP_FRAME_COUNT
      ? DROP_FRAME_COUNT *
        Math.floor(
          (remainingFrames - DROP_FRAME_COUNT) / DROP_FRAME_FRAMES_PER_MINUTE,
        )
      : 0);
  const displayFrameNumber = wrappedFrames + skippedFrames;

  return {
    hours: Math.floor(
      displayFrameNumber / (DROP_FRAME_FRAMES_PER_SECOND * 60 * 60),
    ),
    minutes:
      Math.floor(displayFrameNumber / (DROP_FRAME_FRAMES_PER_SECOND * 60)) % 60,
    seconds: Math.floor(displayFrameNumber / DROP_FRAME_FRAMES_PER_SECOND) % 60,
    frame: displayFrameNumber % DROP_FRAME_FRAMES_PER_SECOND,
    mode: 'DF',
    timeMillis,
  };
};

export const getTimecodeFromMillis = (
  mode: SMPTETimecodeMode,
  timeMillis: number,
): SMPTETimecodeFrameWithMillis => {
  if (mode === 'DF') {
    return getDropFrameTimecode(timeMillis);
  }

  return {
    hours: Math.floor(timeMillis / 3600000),
    minutes: Math.floor((timeMillis % 3600000) / 60000),
    seconds: Math.floor((timeMillis % 60000) / 1000),
    frame: Math.floor(((timeMillis % 1000) / 1000) * SMPTE_TIMECODE_FPS[mode]),
    mode,
    timeMillis,
  };
};

export const getMillisFromTimecode = (timecode: SMPTETimecodeFrame): number => {
  const { hours, minutes, seconds, frame, mode } = timecode;
  if (mode === 'DF') {
    const totalMinutes = hours * 60 + minutes;
    const droppedFrames =
      DROP_FRAME_COUNT * (totalMinutes - Math.floor(totalMinutes / 10));
    const displayFrameNumber =
      (hours * 60 * 60 + minutes * 60 + seconds) *
        DROP_FRAME_FRAMES_PER_SECOND +
      frame;
    const totalFrames = displayFrameNumber - droppedFrames;
    return (totalFrames * 1000 * DROP_FRAME_DENOMINATOR) / DROP_FRAME_NUMERATOR;
  }

  return (
    (hours * 60 * 60 + minutes * 60 + seconds) * 1000 +
    (frame * 1000) / SMPTE_TIMECODE_FPS[mode]
  );
};

export const addFrames = (
  timecode: SMPTETimecodeFrame,
  framesToAdd: number,
): SMPTETimecodeFrame => {
  let frame = timecode.frame + framesToAdd;
  let seconds = timecode.seconds;
  let minutes = timecode.minutes;
  let hours = timecode.hours;

  const fps = SMPTE_TIMECODE_FPS[timecode.mode];

  while (frame >= fps) {
    frame -= fps;
    seconds += 1;
  }

  while (frame < 0) {
    frame += fps;
    seconds -= 1;
  }

  while (seconds >= 60) {
    seconds -= 60;
    minutes += 1;
  }

  while (seconds < 0) {
    seconds += 60;
    minutes -= 1;
  }

  while (minutes >= 60) {
    minutes -= 60;
    hours += 1;
  }

  while (minutes < 0) {
    minutes += 60;
    hours -= 1;
  }

  return { hours, minutes, seconds, frame, mode: timecode.mode };
};

/**
 * Increment or decrement a timecode by a given number of frames,
 * mutating the original object and avoiding Object creation.
 */
export const addFramesMutate = (
  timecode: SMPTETimecodeFrame,
  framesToAdd: number,
): void => {
  let frame = timecode.frame + framesToAdd;
  let seconds = timecode.seconds;
  let minutes = timecode.minutes;
  let hours = timecode.hours;

  const fps = SMPTE_TIMECODE_FPS[timecode.mode];

  while (frame >= fps) {
    frame -= fps;
    seconds += 1;
  }

  while (frame < 0) {
    frame += fps;
    seconds -= 1;
  }

  while (seconds >= 60) {
    seconds -= 60;
    minutes += 1;
  }

  while (seconds < 0) {
    seconds += 60;
    minutes -= 1;
  }

  while (minutes >= 60) {
    minutes -= 60;
    hours += 1;
  }

  while (minutes < 0) {
    minutes += 60;
    hours -= 1;
  }

  timecode.frame = frame;
  timecode.seconds = seconds;
  timecode.minutes = minutes;
  timecode.hours = hours;
};
