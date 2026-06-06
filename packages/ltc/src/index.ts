import {
  getMillisFromTimecode,
  type SMPTETimecodeMode,
  type SMPTETimecodePlayState,
} from '@arcanewizards/smpte';
import {
  createLTCModeDetector,
  createLTCTimingStabilizer,
  decodeLTCFrameAddress,
  decodeLTCFrameBits,
  LTC_FRAME_BIT_COUNT,
  normalizeLTCSpeed,
  type LTCModeDetector,
  type LTCTimingStabilizer,
} from './frame.js';

export type {
  SMPTETimecodeMode,
  SMPTETimecodePlayState,
} from '@arcanewizards/smpte';

export type LTCTimecodePlayState =
  | SMPTETimecodePlayState
  | {
      state: 'detecting-mode';
    };

export type LTCReaderOptions = {
  ctx: AudioContext;
  channels: number;
  frameMode?: SMPTETimecodeMode;
  handlePlayStateChange: (channel: number, state: LTCTimecodePlayState) => void;
};

export type LTCReader = {
  getInput(): AudioNode;
  close(): void;
};

export type LTCWriterOptions = {
  ctx: AudioContext;
  channels: number;
};

export type LTCWriter = {
  getOutput(): AudioNode;
  setPlayState: (channel: number, state: SMPTETimecodePlayState | null) => void;
  close(): void;
};

const LTC_READER_PROCESSOR_NAME = 'arcanewizards-ltc-reader';
const LTC_WRITER_PROCESSOR_NAME = 'arcanewizards-ltc-writer';
const MIN_TC_DIFF_TOLERANCE_MS = 10;
const MIN_SPEED_CHANGE_TOLERANCE = 0.05;
const DEFAULT_STOPPED_TIMEOUT_MS = 150;
const DEFAULT_WRITER_STOPPED_MODE: SMPTETimecodeMode = 'SMPTE';

const LTC_READER_WORKLET_SOURCE = `
const LTC_FRAME_BIT_COUNT = 80;
const LTC_SYNC_WORD_START = 64;
const LTC_SYNC_WORD_BITS = [
  0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1,
];
const LTC_REVERSE_SYNC_WORD_BITS = [...LTC_SYNC_WORD_BITS].reverse();

const matchesSyncWord = (bits, syncWord) => {
  for (let i = 0; i < syncWord.length; i += 1) {
    if (bits[LTC_SYNC_WORD_START + i] !== syncWord[i]) {
      return false;
    }
  }
  return true;
};

class LTCReaderProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();

    this.channel = options.processorOptions.channel;
    this.midpoint = 0;
    this.amplitude = 0;
    this.polarity = 0;
    this.lastTransitionFrame = -1;
    this.bitSamples = 0;
    this.pendingInterval = 0;
    this.pendingIntervalStartFrame = 0;
    this.pendingHalfInterval = 0;
    this.pendingHalfStartFrame = 0;
    this.bits = new Uint8Array(LTC_FRAME_BIT_COUNT);
    this.bitStartFrames = new Float64Array(LTC_FRAME_BIT_COUNT);
    this.bitCount = 0;
  }

  pushBit(bit, bitStartFrame) {
    this.bits.copyWithin(0, 1);
    this.bits[LTC_FRAME_BIT_COUNT - 1] = bit;
    this.bitStartFrames.copyWithin(0, 1);
    this.bitStartFrames[LTC_FRAME_BIT_COUNT - 1] = bitStartFrame;
    this.bitCount += 1;

    if (this.bitCount < LTC_FRAME_BIT_COUNT) {
      return;
    }

    let direction = null;
    if (matchesSyncWord(this.bits, LTC_SYNC_WORD_BITS)) {
      direction = 'forward';
    } else if (matchesSyncWord(this.bits, LTC_REVERSE_SYNC_WORD_BITS)) {
      direction = 'reverse';
    }

    if (!direction) {
      return;
    }

    const frameBits = new Uint8Array(this.bits);
    this.port.postMessage({
      type: 'frame',
      channel: this.channel,
      direction,
      bits: frameBits,
      bitStartFrame: this.bitStartFrames[0],
      bitSamples: this.bitSamples,
      sampleRate,
    });
  }

  updateBitSamples(measuredBitSamples) {
    if (this.bitSamples <= 0) {
      this.bitSamples = measuredBitSamples;
    } else {
      this.bitSamples = this.bitSamples * 0.9 + measuredBitSamples * 0.1;
    }
  }

  handleUncalibratedInterval(interval, startFrame) {
    if (this.pendingInterval <= 0) {
      this.pendingInterval = interval;
      this.pendingIntervalStartFrame = startFrame;
      return;
    }

    const shorter = Math.min(this.pendingInterval, interval);
    const longer = Math.max(this.pendingInterval, interval);
    const ratio = longer / shorter;

    if (ratio < 1.35) {
      const measuredBitSamples = this.pendingInterval + interval;
      this.updateBitSamples(measuredBitSamples);
      this.pushBit(1, this.pendingIntervalStartFrame);
      this.pendingInterval = 0;
      return;
    }

    if (this.pendingInterval > interval * 1.45) {
      this.updateBitSamples(this.pendingInterval);
      this.pushBit(0, this.pendingIntervalStartFrame);
      this.pendingInterval = interval;
      this.pendingIntervalStartFrame = startFrame;
      return;
    }

    if (interval > this.pendingInterval * 1.45) {
      this.updateBitSamples(interval);
      this.pushBit(0, startFrame);
      this.pendingInterval = 0;
      return;
    }

    this.pendingInterval = interval;
    this.pendingIntervalStartFrame = startFrame;
  }

  handleCalibratedInterval(interval, startFrame) {
    if (interval >= this.bitSamples * 0.72) {
      this.pendingHalfInterval = 0;
      this.updateBitSamples(interval);
      this.pushBit(0, startFrame);
      return;
    }

    if (this.pendingHalfInterval <= 0) {
      this.pendingHalfInterval = interval;
      this.pendingHalfStartFrame = startFrame;
      return;
    }

    const measuredBitSamples = this.pendingHalfInterval + interval;
    this.updateBitSamples(measuredBitSamples);
    this.pushBit(1, this.pendingHalfStartFrame);
    this.pendingHalfInterval = 0;
  }

  handleTransition(frame) {
    if (this.lastTransitionFrame < 0) {
      this.lastTransitionFrame = frame;
      return;
    }

    const interval = frame - this.lastTransitionFrame;
    const startFrame = this.lastTransitionFrame;
    this.lastTransitionFrame = frame;

    if (interval < 2) {
      return;
    }

    if (this.bitSamples <= 0) {
      this.handleUncalibratedInterval(interval, startFrame);
    } else {
      this.handleCalibratedInterval(interval, startFrame);
    }
  }

  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input) {
      return true;
    }

    for (let i = 0; i < input.length; i += 1) {
      const sample = input[i];
      this.midpoint += (sample - this.midpoint) * 0.001;
      const centered = sample - this.midpoint;
      this.amplitude += (Math.abs(centered) - this.amplitude) * 0.01;

      const threshold = Math.max(0.015, this.amplitude * 0.35);
      let nextPolarity = this.polarity;

      if (this.polarity <= 0 && centered > threshold) {
        nextPolarity = 1;
      } else if (this.polarity >= 0 && centered < -threshold) {
        nextPolarity = -1;
      }

      if (nextPolarity !== this.polarity) {
        this.polarity = nextPolarity;
        this.handleTransition(currentFrame + i);
      }
    }

    return true;
  }
}

registerProcessor('${LTC_READER_PROCESSOR_NAME}', LTCReaderProcessor);
`;

const LTC_WRITER_WORKLET_SOURCE = `
const LTC_FRAME_BIT_COUNT = 80;
const LTC_SYNC_WORD_START = 64;
const LTC_OUTPUT_AMPLITUDE = 0.8;
const SMPTE_TIMECODE_FPS = {
  FILM: 24,
  EBU: 25,
  DF: 30000 / 1001,
  SMPTE: 30,
};
const LTC_SYNC_WORD_BITS = [
  0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1,
];

const DROP_FRAME_NUMERATOR = 30000;
const DROP_FRAME_DENOMINATOR = 1001;
const DROP_FRAME_COUNT = 2;
const DROP_FRAME_FRAMES_PER_SECOND = 30;
const DROP_FRAME_FRAMES_PER_MINUTE =
  DROP_FRAME_FRAMES_PER_SECOND * 60 - DROP_FRAME_COUNT;
const DROP_FRAME_FRAMES_PER_10_MINUTES =
  DROP_FRAME_FRAMES_PER_MINUTE * 9 + DROP_FRAME_FRAMES_PER_SECOND * 60;
const DROP_FRAME_FRAMES_PER_HOUR = DROP_FRAME_FRAMES_PER_10_MINUTES * 6;
const DROP_FRAME_FRAMES_PER_24_HOURS = DROP_FRAME_FRAMES_PER_HOUR * 24;
const DAY_MILLIS = 24 * 60 * 60 * 1000;
const DROP_FRAME_DAY_MILLIS =
  (DROP_FRAME_FRAMES_PER_24_HOURS * 1000 * DROP_FRAME_DENOMINATOR) /
  DROP_FRAME_NUMERATOR;

const wrapTimeMillis = (mode, timeMillis) => {
  const duration = mode === 'DF' ? DROP_FRAME_DAY_MILLIS : DAY_MILLIS;
  return ((timeMillis % duration) + duration) % duration;
};

const getDropFrameTimecode = (timeMillis) => {
  const totalFrames = Math.floor(
    (timeMillis * DROP_FRAME_NUMERATOR) /
      (1000 * DROP_FRAME_DENOMINATOR),
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
          (remainingFrames - DROP_FRAME_COUNT) /
            DROP_FRAME_FRAMES_PER_MINUTE,
        )
      : 0);
  const displayFrameNumber = wrappedFrames + skippedFrames;

  return {
    hours: Math.floor(
      displayFrameNumber / (DROP_FRAME_FRAMES_PER_SECOND * 60 * 60),
    ),
    minutes:
      Math.floor(displayFrameNumber / (DROP_FRAME_FRAMES_PER_SECOND * 60)) %
      60,
    seconds: Math.floor(displayFrameNumber / DROP_FRAME_FRAMES_PER_SECOND) % 60,
    frame: displayFrameNumber % DROP_FRAME_FRAMES_PER_SECOND,
    mode: 'DF',
  };
};

const getTimecodeFromMillis = (mode, timeMillis) => {
  const wrappedMillis = wrapTimeMillis(mode, timeMillis);
  if (mode === 'DF') {
    return getDropFrameTimecode(wrappedMillis);
  }

  const fps = SMPTE_TIMECODE_FPS[mode];
  return {
    hours: Math.floor(wrappedMillis / 3600000),
    minutes: Math.floor((wrappedMillis % 3600000) / 60000),
    seconds: Math.floor((wrappedMillis % 60000) / 1000),
    frame: Math.floor(((wrappedMillis % 1000) / 1000) * fps),
    mode,
  };
};

const getMillisFromTimecode = (timecode) => {
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
    return (totalFrames * 1000 * DROP_FRAME_DENOMINATOR) /
      DROP_FRAME_NUMERATOR;
  }

  return (
    (hours * 60 * 60 + minutes * 60 + seconds) * 1000 +
    (frame * 1000) / SMPTE_TIMECODE_FPS[mode]
  );
};

const writeBits = (bits, offset, length, value) => {
  for (let i = 0; i < length; i += 1) {
    bits[offset + i] = (value >> i) & 1;
  }
};

const applyLTCParityCorrection = (bits, mode) => {
  const parityBitIndex = mode === 'EBU' ? 59 : 27;
  bits[parityBitIndex] = 0;

  let zeroCount = 0;
  for (let i = 0; i < bits.length; i += 1) {
    if (bits[i] === 0) {
      zeroCount += 1;
    }
  }

  if (zeroCount % 2 !== 0) {
    bits[parityBitIndex] = 1;
  }
};

const encodeLTCFrameBits = (bits, timecode) => {
  bits.fill(0);

  writeBits(bits, 0, 4, timecode.frame % 10);
  writeBits(bits, 8, 2, Math.floor(timecode.frame / 10));
  bits[10] = timecode.mode === 'DF' ? 1 : 0;

  writeBits(bits, 16, 4, timecode.seconds % 10);
  writeBits(bits, 24, 3, Math.floor(timecode.seconds / 10));

  writeBits(bits, 32, 4, timecode.minutes % 10);
  writeBits(bits, 40, 3, Math.floor(timecode.minutes / 10));

  writeBits(bits, 48, 4, timecode.hours % 10);
  writeBits(bits, 56, 2, Math.floor(timecode.hours / 10));

  for (let i = 0; i < LTC_SYNC_WORD_BITS.length; i += 1) {
    bits[LTC_SYNC_WORD_START + i] = LTC_SYNC_WORD_BITS[i];
  }

  applyLTCParityCorrection(bits, timecode.mode);
};

const getFrameKey = (timecode, reverse) => {
  return [
    timecode.mode,
    timecode.hours,
    timecode.minutes,
    timecode.seconds,
    timecode.frame,
    reverse ? 1 : 0,
  ].join(':');
};

class LTCWriterChannel {
  constructor() {
    this.playState = null;
    this.oneShot = null;
    this.lastMode = 'SMPTE';
    this.bits = new Uint8Array(LTC_FRAME_BIT_COUNT);
    this.encodedBits = new Uint8Array(LTC_FRAME_BIT_COUNT);
    this.prefixOnes = new Uint8Array(LTC_FRAME_BIT_COUNT + 1);
    this.frameKey = '';
  }

  setPlayState(state, mode) {
    this.lastMode = mode ?? this.lastMode;
    this.playState = state;
    this.oneShot = null;
  }

  setStoppedState(currentTimeMillis, mode) {
    this.lastMode = mode ?? this.lastMode;
    this.playState = null;
    this.oneShot = {
      currentTimeMillis,
      mode: this.lastMode,
      sampleOffset: 0,
    };
  }

  clear() {
    this.playState = null;
    this.oneShot = null;
  }

  updateFrameBits(timecode, reverse) {
    const frameKey = getFrameKey(timecode, reverse);
    if (this.frameKey === frameKey) {
      return;
    }

    encodeLTCFrameBits(this.encodedBits, timecode);
    if (reverse) {
      for (let i = 0; i < LTC_FRAME_BIT_COUNT; i += 1) {
        this.bits[i] = this.encodedBits[LTC_FRAME_BIT_COUNT - i - 1];
      }
    } else {
      this.bits.set(this.encodedBits);
    }

    this.prefixOnes[0] = 0;
    for (let i = 0; i < LTC_FRAME_BIT_COUNT; i += 1) {
      this.prefixOnes[i + 1] = this.prefixOnes[i] + this.bits[i];
    }

    this.frameKey = frameKey;
  }

  getSampleForProgress(timecode, progressMillis, frameDurationMillis, reverse) {
    this.updateFrameBits(timecode, reverse);

    const progress =
      ((progressMillis % frameDurationMillis) + frameDurationMillis) %
      frameDurationMillis;
    const bitPhase = Math.min(
      LTC_FRAME_BIT_COUNT - Number.EPSILON,
      (progress / frameDurationMillis) * LTC_FRAME_BIT_COUNT,
    );
    const bitIndex = Math.floor(bitPhase);
    const bitHalf = bitPhase - bitIndex >= 0.5 ? 1 : 0;
    const bit = this.bits[bitIndex];
    const transitions =
      bitIndex +
      1 +
      this.prefixOnes[bitIndex] +
      (bitHalf === 1 && bit === 1 ? 1 : 0);

    return transitions % 2 === 0 ? LTC_OUTPUT_AMPLITUDE : -LTC_OUTPUT_AMPLITUDE;
  }

  getPlayingSample(contextTimeMillis) {
    const state = this.playState;
    if (!state || state.speed === 0) {
      return 0;
    }

    const mode = state.smpteMode;
    const reverse = state.speed < 0;
    const timecodeMillis =
      (contextTimeMillis - state.effectiveStartContextTimeMillis) *
      state.speed;
    const wrappedTimecodeMillis = wrapTimeMillis(mode, timecodeMillis);
    const timecode = getTimecodeFromMillis(mode, wrappedTimecodeMillis);
    const frameDurationMillis = 1000 / SMPTE_TIMECODE_FPS[mode];
    const frameStartMillis = getMillisFromTimecode(timecode);
    const positionMillis = wrappedTimecodeMillis - frameStartMillis;
    const progressMillis = reverse
      ? frameDurationMillis - positionMillis
      : positionMillis;

    return this.getSampleForProgress(
      timecode,
      progressMillis,
      frameDurationMillis,
      reverse,
    );
  }

  getOneShotSample() {
    const oneShot = this.oneShot;
    if (!oneShot) {
      return 0;
    }

    const mode = oneShot.mode;
    const frameDurationMillis = 1000 / SMPTE_TIMECODE_FPS[mode];
    const frameDurationSamples = Math.max(
      1,
      Math.ceil((frameDurationMillis / 1000) * sampleRate),
    );

    if (oneShot.sampleOffset >= frameDurationSamples) {
      this.oneShot = null;
      return 0;
    }

    const timecode = getTimecodeFromMillis(mode, oneShot.currentTimeMillis);
    const progressMillis =
      (oneShot.sampleOffset / frameDurationSamples) * frameDurationMillis;
    oneShot.sampleOffset += 1;

    return this.getSampleForProgress(
      timecode,
      progressMillis,
      frameDurationMillis,
      false,
    );
  }

  getSample(contextTimeMillis) {
    if (this.oneShot) {
      return this.getOneShotSample();
    }
    return this.getPlayingSample(contextTimeMillis);
  }
}

class LTCWriterProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();

    this.channels = options.processorOptions.channels;
    this.channelStates = Array.from(
      { length: this.channels },
      () => new LTCWriterChannel(),
    );

    this.port.onmessage = (event) => {
      const message = event.data;
      const channelState = this.channelStates[message.channel];
      if (!channelState) {
        return;
      }

      if (message.type === 'clear') {
        channelState.clear();
      } else if (message.type === 'playing') {
        channelState.setPlayState(message.state, message.state.smpteMode);
      } else if (message.type === 'stopped') {
        channelState.setStoppedState(
          message.currentTimeMillis,
          message.mode,
        );
      }
    };
  }

  process(inputs, outputs) {
    const output = outputs[0];
    if (!output) {
      return true;
    }

    for (let channel = 0; channel < output.length; channel += 1) {
      const samples = output[channel];
      const channelState = this.channelStates[channel];
      if (!samples || !channelState) {
        continue;
      }

      for (let i = 0; i < samples.length; i += 1) {
        const contextTimeMillis = ((currentFrame + i) * 1000) / sampleRate;
        samples[i] = channelState.getSample(contextTimeMillis);
      }
    }

    return true;
  }
}

registerProcessor('${LTC_WRITER_PROCESSOR_NAME}', LTCWriterProcessor);
`;

const readerWorkletLoadPromises = new WeakMap<AudioContext, Promise<void>>();
const writerWorkletLoadPromises = new WeakMap<AudioContext, Promise<void>>();

const loadReaderWorklet = (ctx: AudioContext): Promise<void> => {
  const existingPromise = readerWorkletLoadPromises.get(ctx);
  if (existingPromise) {
    return existingPromise;
  }

  const blob = new Blob([LTC_READER_WORKLET_SOURCE], {
    type: 'text/javascript',
  });
  const url = URL.createObjectURL(blob);
  const promise = ctx.audioWorklet.addModule(url).finally(() => {
    URL.revokeObjectURL(url);
  });

  readerWorkletLoadPromises.set(ctx, promise);
  return promise;
};

const loadWriterWorklet = (ctx: AudioContext): Promise<void> => {
  const existingPromise = writerWorkletLoadPromises.get(ctx);
  if (existingPromise) {
    return existingPromise;
  }

  const blob = new Blob([LTC_WRITER_WORKLET_SOURCE], {
    type: 'text/javascript',
  });
  const url = URL.createObjectURL(blob);
  const promise = ctx.audioWorklet.addModule(url).finally(() => {
    URL.revokeObjectURL(url);
  });

  writerWorkletLoadPromises.set(ctx, promise);
  return promise;
};

type LTCReaderWorkletMessage = {
  type: 'frame';
  channel: number;
  direction: 'forward' | 'reverse';
  bits: Uint8Array;
  bitStartFrame: number;
  bitSamples: number;
  sampleRate: number;
};

type LTCWriterChannelState = {
  playState: SMPTETimecodePlayState | null;
  lastMode: SMPTETimecodeMode;
};

type LTCWriterWorkletMessage =
  | {
      type: 'clear';
      channel: number;
    }
  | {
      type: 'playing';
      channel: number;
      state: {
        state: 'playing';
        effectiveStartContextTimeMillis: number;
        speed: number;
        smpteMode: SMPTETimecodeMode;
      };
    }
  | {
      type: 'stopped';
      channel: number;
      currentTimeMillis: number;
      mode: SMPTETimecodeMode;
    };

type LTCReaderChannelState = {
  lastFrameWallMillis: number | null;
  lastTimecodeMillis: number | null;
  lastPlayState: LTCTimecodePlayState | null;
  /**
   * Timeout to send stopped state after losing sync.
   */
  stoppedTimeout: {
    id: ReturnType<typeof setTimeout>;
    timeMillis: number;
  } | null;
  modeDetector: LTCModeDetector;
  timingStabilizer: LTCTimingStabilizer;
};

const createReaderChannelState = (): LTCReaderChannelState => ({
  lastFrameWallMillis: null,
  lastTimecodeMillis: null,
  lastPlayState: null,
  stoppedTimeout: null,
  modeDetector: createLTCModeDetector(),
  timingStabilizer: createLTCTimingStabilizer(),
});

export const createLTCReader = ({
  ctx,
  channels,
  frameMode,
  handlePlayStateChange,
}: LTCReaderOptions): LTCReader => {
  const input = ctx.createGain();
  input.channelCount = channels;
  input.channelCountMode = 'explicit';
  input.channelInterpretation = 'discrete';

  const splitter = ctx.createChannelSplitter(channels);
  const silentSink = ctx.createGain();
  silentSink.gain.value = 0;

  let closed = false;
  const channelNodes: AudioWorkletNode[] = [];
  const contextStartWallMillis = Date.now() - ctx.currentTime * 1000;
  const channelStates = Array.from({ length: channels }, () =>
    createReaderChannelState(),
  );

  const sendStoppedState = (channel: number, currentTimeMillis: number) => {
    const channelState = channelStates[channel];
    if (!channelState || closed) {
      return;
    }

    const stoppedState: SMPTETimecodePlayState = {
      state: 'stopped',
      currentTimeMillis,
    };

    channelState.lastPlayState = stoppedState;
    handlePlayStateChange(channel, stoppedState);
  };

  const sendDetectingModeState = (channel: number) => {
    const channelState = channelStates[channel];
    if (!channelState || closed) {
      return;
    }

    if (channelState.lastPlayState?.state === 'detecting-mode') {
      return;
    }

    const detectingModeState: LTCTimecodePlayState = {
      state: 'detecting-mode',
    };
    channelState.lastPlayState = detectingModeState;
    handlePlayStateChange(channel, detectingModeState);
  };

  const scheduleStoppedState = (
    channel: number,
    frameDurationMillis: number,
    timeMillis: number,
  ) => {
    const channelState = channelStates[channel];
    if (!channelState || closed) {
      return;
    }

    if (channelState.stoppedTimeout) {
      clearTimeout(channelState.stoppedTimeout.id);
    }

    const stoppedTimeoutMillis = Math.max(
      DEFAULT_STOPPED_TIMEOUT_MS,
      frameDurationMillis * 4,
    );

    channelState.stoppedTimeout = {
      id: setTimeout(() => {
        // Only send timeout if the value to send is unchanged
        if (channelState.stoppedTimeout?.timeMillis === timeMillis) {
          sendStoppedState(channel, timeMillis);
        }
      }, stoppedTimeoutMillis),
      timeMillis,
    };
  };

  const handleWorkletMessage = (
    event: MessageEvent<LTCReaderWorkletMessage>,
  ) => {
    if (closed || event.data.type !== 'frame') {
      return;
    }

    const { channel, bits, direction, bitStartFrame, bitSamples, sampleRate } =
      event.data;
    const channelState = channelStates[channel];
    if (!channelState || bits.length !== LTC_FRAME_BIT_COUNT) {
      return;
    }

    const frameDurationMillis =
      (bitSamples * LTC_FRAME_BIT_COUNT * 1000) / sampleRate;
    if (channelState.stoppedTimeout) {
      // Clear and re-schedule stopped timeout for the same value as last time
      scheduleStoppedState(
        channel,
        frameDurationMillis,
        channelState.stoppedTimeout.timeMillis,
      );
    }

    const frameWallMillis =
      contextStartWallMillis + (bitStartFrame / sampleRate) * 1000;
    const frameAddress = decodeLTCFrameAddress(bits, direction);
    if (!frameAddress) {
      return;
    }

    const mode =
      frameMode ??
      channelState.modeDetector.recordFrame(frameAddress, frameWallMillis);
    if (!mode) {
      sendDetectingModeState(channel);
      return;
    }

    const decodedFrame = decodeLTCFrameBits(bits, { direction, mode });
    if (!decodedFrame) {
      return;
    }

    const timecodeMillis = getMillisFromTimecode(decodedFrame.timecode);
    scheduleStoppedState(channel, frameDurationMillis, timecodeMillis);
    const wallDelta =
      channelState.lastFrameWallMillis === null
        ? null
        : frameWallMillis - channelState.lastFrameWallMillis;
    const timecodeDelta =
      channelState.lastTimecodeMillis === null
        ? null
        : timecodeMillis - channelState.lastTimecodeMillis;
    const measuredSpeed =
      wallDelta && timecodeDelta !== null && Math.abs(wallDelta) > 0
        ? timecodeDelta / wallDelta
        : direction === 'reverse'
          ? -1
          : 1;
    const previousSpeed =
      channelState.lastPlayState?.state === 'playing'
        ? channelState.lastPlayState.speed
        : null;
    const speed = normalizeLTCSpeed({
      measuredSpeed,
      direction,
      previousSpeed,
      tolerance: MIN_SPEED_CHANGE_TOLERANCE,
    });
    const effectiveStartTime = frameWallMillis - timecodeMillis / speed;
    const nextPlayingState: SMPTETimecodePlayState = {
      state: 'playing',
      effectiveStartTime,
      speed,
      smpteMode: decodedFrame.timecode.mode,
    };
    const previousPlayingState = channelState.lastPlayState;

    if (
      previousPlayingState?.state === 'playing' &&
      !channelState.timingStabilizer.shouldAccept(
        nextPlayingState,
        previousPlayingState,
      )
    ) {
      return;
    }

    if (
      !previousPlayingState ||
      previousPlayingState.state !== 'playing' ||
      Math.abs(effectiveStartTime - previousPlayingState.effectiveStartTime) >
        MIN_TC_DIFF_TOLERANCE_MS ||
      Math.abs(speed - previousPlayingState.speed) >
        MIN_SPEED_CHANGE_TOLERANCE ||
      previousPlayingState.smpteMode !== decodedFrame.timecode.mode
    ) {
      channelState.lastPlayState = nextPlayingState;
      handlePlayStateChange(channel, nextPlayingState);
    }

    channelState.lastFrameWallMillis = frameWallMillis;
    channelState.lastTimecodeMillis = timecodeMillis;
  };

  input.connect(splitter);

  const initializeReaderGraph = async () => {
    await loadReaderWorklet(ctx);

    if (closed) {
      return;
    }

    for (let channel = 0; channel < channels; channel += 1) {
      const node = new AudioWorkletNode(ctx, LTC_READER_PROCESSOR_NAME, {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        channelCount: 1,
        channelCountMode: 'explicit',
        channelInterpretation: 'discrete',
        processorOptions: { channel },
      });

      node.port.onmessage = handleWorkletMessage;
      splitter.connect(node, channel, 0);
      node.connect(silentSink);
      channelNodes.push(node);
    }

    silentSink.connect(ctx.destination);
  };

  void initializeReaderGraph();

  return {
    getInput() {
      return input;
    },
    close() {
      closed = true;
      input.disconnect();
      splitter.disconnect();
      for (const channelState of channelStates) {
        if (channelState.stoppedTimeout) {
          clearTimeout(channelState.stoppedTimeout.id);
        }
      }
      for (const node of channelNodes) {
        node.port.onmessage = null;
        node.disconnect();
        node.port.close();
      }
      silentSink.disconnect();
    },
  };
};

export const createLTCWriter = ({
  ctx,
  channels,
}: LTCWriterOptions): LTCWriter => {
  const output = ctx.createGain();
  output.channelCount = channels;
  output.channelCountMode = 'explicit';
  output.channelInterpretation = 'discrete';

  let closed = false;
  let writerNode: AudioWorkletNode | null = null;
  const contextStartWallMillis = Date.now() - ctx.currentTime * 1000;
  const channelStates: LTCWriterChannelState[] = Array.from(
    { length: channels },
    () => ({
      playState: null,
      lastMode: DEFAULT_WRITER_STOPPED_MODE,
    }),
  );

  const getChannelState = (channel: number): LTCWriterChannelState => {
    const channelState = channelStates[channel];
    if (!Number.isInteger(channel) || !channelState) {
      throw new RangeError(`Invalid LTC writer channel ${channel}`);
    }
    return channelState;
  };

  const postMessageToWriter = (message: LTCWriterWorkletMessage): void => {
    writerNode?.port.postMessage(message);
  };

  const serializePlayState = (
    channel: number,
    state: SMPTETimecodePlayState | null,
  ): LTCWriterWorkletMessage => {
    const channelState = getChannelState(channel);

    if (!state) {
      return { type: 'clear', channel };
    }

    if (state.state === 'stopped') {
      return {
        type: 'stopped',
        channel,
        currentTimeMillis: state.currentTimeMillis,
        mode: channelState.lastMode,
      };
    }

    channelState.lastMode = state.smpteMode;

    return {
      type: 'playing',
      channel,
      state: {
        state: 'playing',
        effectiveStartContextTimeMillis:
          state.effectiveStartTime - contextStartWallMillis,
        speed: state.speed,
        smpteMode: state.smpteMode,
      },
    };
  };

  const initializeWriterGraph = async () => {
    await loadWriterWorklet(ctx);

    if (closed) {
      return;
    }

    const node = new AudioWorkletNode(ctx, LTC_WRITER_PROCESSOR_NAME, {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [channels],
      channelCount: channels,
      channelCountMode: 'explicit',
      channelInterpretation: 'discrete',
      processorOptions: { channels },
    });

    node.connect(output);
    writerNode = node;

    for (let channel = 0; channel < channels; channel += 1) {
      const { playState } = channelStates[channel]!;
      if (playState) {
        postMessageToWriter(serializePlayState(channel, playState));
      }
    }
  };

  void initializeWriterGraph();

  return {
    getOutput() {
      return output;
    },
    setPlayState(channel, state) {
      if (closed) {
        return;
      }

      const channelState = getChannelState(channel);
      channelState.playState = state;
      postMessageToWriter(serializePlayState(channel, state));
    },
    close() {
      closed = true;
      writerNode?.disconnect();
      writerNode?.port.close();
      writerNode = null;
      output.disconnect();
    },
  };
};
