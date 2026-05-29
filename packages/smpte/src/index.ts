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
  timeMillis: number;
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
): SMPTETimecodeFrame => {
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
): SMPTETimecodeFrame => {
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

export const getMillisFromTimecode = (
  timecode: Omit<SMPTETimecodeFrame, 'timeMillis'>,
): number => {
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
