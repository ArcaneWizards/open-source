import {
  addFramesMutate,
  getMillisFromTimecode,
  getTimecodeFromMillis,
  SMPTE_TIMECODE_FPS,
  SMPTETimecodeFrame,
  SMPTETimecodeMode,
} from '@arcanewizards/smpte';

/**
 * How long should we wait (for potential future frames)
 * before considering the timecode to be stopped.
 *
 * This is used both:
 * - After receiving a full frame message,
 *   to wait for the first quarter frame
 * - After receiving a quarter frame message,
 *   to wait for the next quarter frame
 */
const MIDI_TIMEOUT_BUFFER_MS = 100;
/**
 * How many milliseconds of difference between the current and most recently
 * calculated timecode effective start time should be required before we trigger
 * a play state update.
 */
const MIN_TC_DIFF_TOLERANCE_MS = 10;
/**
 * How different does the playback speed need to be from:
 *
 * - 1 to be considered a non-standard speed (e.g. fast forward or slow motion)
 * - the previous speed to trigger a play state update
 */
const MIN_SPEED_CHANGE_TOLERANCE = 0.01;

export type MIDITimecodePlayState =
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

export type MIDISMPTEMode = 'FILM' | 'EBU' | 'DF' | 'SMPTE';

export type MIDITimecodeSenderOptions = {
  sendMessage: (message: number[]) => void;
  mode: MIDISMPTEMode;
};

export type MIDITimecodeSender = {
  setPlayState: (state: MIDITimecodePlayState | null) => void;
};

const MODE_VALUES: Record<MIDISMPTEMode, number> = {
  FILM: 0b00,
  EBU: 0b01,
  DF: 0b10,
  SMPTE: 0b11,
};

const modeFromValue = (value: number): MIDISMPTEMode | null => {
  switch (value) {
    case MODE_VALUES.FILM:
      return 'FILM';
    case MODE_VALUES.EBU:
      return 'EBU';
    case MODE_VALUES.DF:
      return 'DF';
    case MODE_VALUES.SMPTE:
      return 'SMPTE';
    default:
      return null;
  }
};

type FullTimecodeMessage = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

const fullTimecodeMessage = (
  frame: SMPTETimecodeFrame,
): FullTimecodeMessage => {
  return [
    0xf0, // SysEx start
    0x7f, // Real Time Universal SysEx
    0x7f, // Device ID (all devices)
    0x01, // Sub-ID #1: Time Code
    0x01, // Sub-ID #2: Full Time Code Message
    (frame.hours & 0b11111) | (MODE_VALUES[frame.mode] << 5),
    frame.minutes & 0b111111,
    frame.seconds & 0b111111,
    frame.frame & 0b11111,
    0xf7, // SysEx end
  ];
};

const isFullTimecodeMessage = (
  message: number[],
): message is FullTimecodeMessage => {
  return (
    message.length === 10 &&
    message[0] === 0xf0 &&
    message[1] === 0x7f &&
    message[2] === 0x7f &&
    message[3] === 0x01 &&
    message[4] === 0x01 &&
    message[9] === 0xf7
  );
};

const extractTimecodeFromFullMessage = (
  message: FullTimecodeMessage,
): SMPTETimecodeFrame => {
  const hours = message[5] & 0b11111;
  const minutes = message[6];
  const seconds = message[7];
  const frame = message[8];
  const modeValue = (message[5] & 0b01100000) >> 5;
  // We can be sure this won't be null because modeValue is only 2 bits,
  // so it will always be between 0-3, which are all valid modes
  const mode = modeFromValue(modeValue)!;
  return {
    hours,
    minutes,
    seconds,
    frame,
    mode,
  };
};

/**
 * An Array of 8 quarter frames,
 * alongside the real (device) clock time that they should be sent out.
 *
 * - [2n] is the quarter frame message itself
 * - [2n + 1] is the absolute clock time in milliseconds when it should be sent out
 */
type QuarterFrameSchedule = [
  [number, number],
  number,
  [number, number],
  number,
  [number, number],
  number,
  [number, number],
  number,
  [number, number],
  number,
  [number, number],
  number,
  [number, number],
  number,
  [number, number],
  number,
];

/**
 * Calculate all the quarter frames and schedule send times for them,
 * mutating the provided `dst` array to contain the result.
 *
 * We avoid creating any new objects/arrays in this function to
 * minimize GC overhead.
 */
const calculateNextQuarterFrames = (
  dst: QuarterFrameSchedule,
  frame: SMPTETimecodeFrame,
  /** The absolute clock time in milliseconds when the first quarter frame message should be sent */
  frameClockMillis: number,
  qfInterval: number,
) => {
  const modeValue = MODE_VALUES[frame.mode];
  dst[0] = [0xf1, 0x00 | (frame.frame & 0b1111)];
  dst[1] = frameClockMillis;
  dst[2] = [0xf1, 0x10 | ((frame.frame >> 4) & 0b1111)];
  dst[3] = frameClockMillis + qfInterval;
  dst[4] = [0xf1, 0x20 | (frame.seconds & 0b1111)];
  dst[5] = frameClockMillis + qfInterval * 2;
  dst[6] = [0xf1, 0x30 | ((frame.seconds >> 4) & 0b1111)];
  dst[7] = frameClockMillis + qfInterval * 3;
  dst[8] = [0xf1, 0x40 | (frame.minutes & 0b1111)];
  dst[9] = frameClockMillis + qfInterval * 4;
  dst[10] = [0xf1, 0x50 | ((frame.minutes >> 4) & 0b1111)];
  dst[11] = frameClockMillis + qfInterval * 5;
  dst[12] = [0xf1, 0x60 | (frame.hours & 0b1111)];
  dst[13] = frameClockMillis + qfInterval * 6;
  dst[14] = [0xf1, 0x70 | ((frame.hours >> 4) & 0b1) | (modeValue << 1)];
  dst[15] = frameClockMillis + qfInterval * 7;
};

export const createMIDITimecodeSender = ({
  sendMessage,
  mode,
}: MIDITimecodeSenderOptions): MIDITimecodeSender => {
  let timeoutId: NodeJS.Timeout | null = null;
  /**
   * Keep track of the current play state,
   * so that any timeouts / timers that aren't cleared immediately,
   * don't cause incorrect messages to be sent after a state change.
   */
  let currentPlayState: MIDITimecodePlayState | null = null;

  const setPlayState: MIDITimecodeSender['setPlayState'] = (state) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    currentPlayState = state;

    if (!state) {
      // No play state means we should stop the timecode and clear any timers
      return;
    }

    if (state.state === 'stopped') {
      // Send a message with the current time to indicate stopping
      const frame = getTimecodeFromMillis(mode, state.currentTimeMillis);
      sendMessage(fullTimecodeMessage(frame));
      return;
    }

    // Configure ongoing messages at appropriate times
    const { speed } = state;
    const tcMillisStart = (Date.now() - state.effectiveStartTime) * speed;
    const frame: SMPTETimecodeFrame = getTimecodeFromMillis(
      mode,
      tcMillisStart,
    );
    sendMessage(fullTimecodeMessage(frame));

    // Start scheduling quarter frames

    /**
     * How many milliseconds between each quarter frame message
     * based on the current speed.
     */
    const qfInterval =
      (1000 / SMPTE_TIMECODE_FPS[mode] / 4 / Math.abs(speed)) | 0;
    /**
     * The actual timestamp in milliseconds represented by `frame`.
     */
    let frameTcMillis = getMillisFromTimecode(frame);
    let frameClockMillis = state.effectiveStartTime + frameTcMillis / speed;

    const schedule = new Array(16) as unknown as QuarterFrameSchedule;
    /**
     * The next quarter frame index to send, between 0-7
     */
    let nextQf = 0;
    calculateNextQuarterFrames(schedule, frame, frameClockMillis, qfInterval);

    const sendFrames = () => {
      if (currentPlayState !== state) {
        return;
      }

      const now = Date.now();

      while (nextQf < 8 && (schedule[(nextQf << 1) + 1] as number) <= now) {
        const message = schedule[nextQf << 1]! as [number, number];
        sendMessage(message);
        nextQf++;
        if (nextQf === 8) {
          // Schedule the next 8 quarter frames (2 frames ahead)
          addFramesMutate(frame, speed > 0 ? 2 : -2);
          frameTcMillis = getMillisFromTimecode(frame);
          frameClockMillis = state.effectiveStartTime + frameTcMillis / speed;
          calculateNextQuarterFrames(
            schedule,
            frame,
            frameClockMillis,
            qfInterval,
          );
          nextQf = 0;
        }
      }

      const nextQfTime = schedule[(nextQf << 1) + 1] as number;
      // Schedule the timout 1 millisecond after the next quarter frame time,
      // to ensure that we don't accidentally schedule it before its due
      timeoutId = setTimeout(sendFrames, nextQfTime - now + 1);
    };

    sendFrames();
  };

  return {
    setPlayState,
  };
};

/**
 * All toe data from the most recent 8 quarter frames received,
 * which will cover a full timecode
 */
type QuarterFrameData = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

const newQuarterFrameData = (): QuarterFrameData => {
  return new Array(8).fill(0) as QuarterFrameData;
};

const quarterFrameDataToTimecode = (
  data: QuarterFrameData,
): SMPTETimecodeFrame | null => {
  const frame =
    (data[0] & 0b1111) | // low nibble of frame
    ((data[1] & 0b1111) << 4); // high nibble of frame
  const seconds =
    (data[2] & 0b1111) | // low nibble of seconds
    ((data[3] & 0b1111) << 4); // high nibble of seconds
  const minutes =
    (data[4] & 0b1111) | // low nibble of minutes
    ((data[5] & 0b1111) << 4); // high nibble of minutes
  const hours =
    (data[6] & 0b1111) | // low nibble of hours
    ((data[7] & 0b0001) << 4); // high nibble of hours (only bit 4)
  const modeValue = (data[7] & 0b1110) >> 1;
  const mode = modeFromValue(modeValue);

  if (mode === null) {
    return null;
  }
  return {
    frame,
    seconds,
    minutes,
    hours,
    mode,
  };
};

export type MIDITimecodeReceiverOptions = {
  handlePlayStateChange: (state: MIDITimecodePlayState) => void;
  handleJitterChange?: (jitterMillis: number) => void;
};

export type MIDITimecodeReceiver = {
  receiveMessage: (message: number[]) => void;
};

export const createMIDITimecodeReceiver = ({
  handlePlayStateChange,
}: MIDITimecodeReceiverOptions): MIDITimecodeReceiver => {
  // Ongoing playback state

  /**
   * The most recent nibbles received of each type
   */
  const frameInfo: QuarterFrameData = newQuarterFrameData();
  let quarterFramesReceived = 0;
  let lastQfReceivedAt = 0;
  let lastQf0ReceivedAt = 0;
  let lastPlayingState: MIDITimecodePlayState | null = null;

  // Stopped state

  /**
   * When set,
   * the last message received was a full timecode message,
   * and this is the corresponding timecode frame.
   *
   * We keep track of this here so that we can use it to update the play state
   * to stopped (after a short timeout)
   */
  let receivedFullTimecode: SMPTETimecodeFrame | null = null;
  let considerStoppedTimeout: NodeJS.Timeout | null = null;
  let sentStopped = false;

  const sendStoppedPlayState = (frame: SMPTETimecodeFrame) => {
    const currentTimeMillis = getMillisFromTimecode(frame);
    handlePlayStateChange({
      state: 'stopped',
      currentTimeMillis,
    });
    sentStopped = true;
  };

  const considerStoppedUsingFullFrame = () => {
    if (receivedFullTimecode) {
      sendStoppedPlayState(receivedFullTimecode);
      receivedFullTimecode = null;
    }
  };

  const checkIfStoppedDueToTimeout = () => {
    if (sentStopped) {
      return;
    }

    if (
      lastQfReceivedAt > 0 &&
      Date.now() - lastQfReceivedAt > MIDI_TIMEOUT_BUFFER_MS &&
      quarterFramesReceived > 8
    ) {
      const timecode = quarterFrameDataToTimecode(frameInfo);
      if (timecode) {
        sendStoppedPlayState(timecode);
        sentStopped = true;
      }
    }
  };
  setInterval(checkIfStoppedDueToTimeout, MIDI_TIMEOUT_BUFFER_MS / 2);

  /**
   * Called at 8th quarter frame (full timecode).
   *
   * By the time we process
   *
   * @param qf the current quarter frame index (0 or 7) that was just received.
   *           when running forward, we trigger on 7 as that's when we have
   *           the full timecode available,
   *.          but when running in reverse, we trigger on 0.
   *
   * @returns true if the play state was updated, false otherwise
   */
  const handleNibbles = (qf: 0 | 7): boolean => {
    if (quarterFramesReceived < 8) {
      // not enough data yet, ignore
    }

    /**
     * Approximate speed of playback, based on the last X received full
     * set of nibbles
     *
     * TODO: dynamically calculate this
     */
    const speed = qf === 7 ? 1 : 0;
    const timecode = quarterFrameDataToTimecode(frameInfo);
    if (!timecode) {
      // invalid timecode, ignore
      return false;
    }
    // millis of current data
    // accounting for the time at which we received the last
    const millis = getMillisFromTimecode(timecode);
    /**
     * The MIDI Spec is a bit unclear on this,
     * but it seems to be the case that when running backwards,
     * QF0 will be sent at the point that the timecode _reaches_ the frame whose
     * data has now been completely sent.
     *
     * So then regardless of whether we're running forward or backward,
     * we can consider `lastQf0ReceivedAt` to be the correct time
     * for the now received timecode.
     *
     * @see https://web.archive.org/web/20110629053759/http://web.media.mit.edu/~meyers/mcgill/multimedia/senior_project/MTC.html
     */
    const effectiveStartTime = lastQf0ReceivedAt - millis / speed;
    if (
      !lastPlayingState ||
      lastPlayingState.state !== 'playing' ||
      Math.abs(effectiveStartTime - lastPlayingState.effectiveStartTime) >
        MIN_TC_DIFF_TOLERANCE_MS ||
      Math.abs(speed - lastPlayingState.speed) > MIN_SPEED_CHANGE_TOLERANCE ||
      lastPlayingState.smpteMode !== timecode.mode
    ) {
      lastPlayingState = {
        state: 'playing',
        effectiveStartTime,
        speed,
        smpteMode: timecode.mode,
      };
      handlePlayStateChange(lastPlayingState);
      return true;
    }

    return false;
  };

  const receiveMessage: MIDITimecodeReceiver['receiveMessage'] = (message) => {
    if (message[0] === 0xf1 && message.length === 2) {
      // Handle quarter frame
      const data = message[1]!;
      const nibbleIndex = (data & 0b01110000) >> 4; // 0-7
      const nibbleData = data & 0b1111;
      frameInfo[nibbleIndex] = nibbleData;
      quarterFramesReceived++;
      receivedFullTimecode = null; // Prevent sending stopped state
      lastQfReceivedAt = Date.now();
      sentStopped = false;

      if (nibbleIndex === 0) {
        lastQf0ReceivedAt = lastQfReceivedAt;
      }

      if (nibbleIndex === 7) {
        // TODO: handle processing in reverse direction
        handleNibbles(7);
      }
    } else if (isFullTimecodeMessage(message)) {
      // Clear out existing quarter frame data
      quarterFramesReceived = 0;
      lastQfReceivedAt = 0;
      sentStopped = false;
      frameInfo.fill(0);

      if (receivedFullTimecode && considerStoppedTimeout) {
        clearTimeout(considerStoppedTimeout);
        // Send stopped state for previous timecode before processing new on
        // as we will be within the timeout period,
        // and want to remain responsive to seeking around in the timecode
        sendStoppedPlayState(receivedFullTimecode);
      }
      // Handle full timecode message
      receivedFullTimecode = extractTimecodeFromFullMessage(message);
      considerStoppedTimeout = setTimeout(
        considerStoppedUsingFullFrame,
        MIDI_TIMEOUT_BUFFER_MS,
      );
    }
  };

  return {
    receiveMessage,
  };
};
