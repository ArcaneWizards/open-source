import {
  getMillisFromTimecode,
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

export type { SMPTETimecodePlayState } from '@arcanewizards/smpte';

export type LTCReaderOptions = {
  ctx: AudioContext;
  channels: number;
  handlePlayStateChange: (
    channel: number,
    state: SMPTETimecodePlayState,
  ) => void;
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
const MIN_TC_DIFF_TOLERANCE_MS = 10;
const MIN_SPEED_CHANGE_TOLERANCE = 0.05;
const DEFAULT_STOPPED_TIMEOUT_MS = 150;

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

const readerWorkletLoadPromises = new WeakMap<AudioContext, Promise<void>>();

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

type LTCReaderWorkletMessage = {
  type: 'frame';
  channel: number;
  direction: 'forward' | 'reverse';
  bits: Uint8Array;
  bitStartFrame: number;
  bitSamples: number;
  sampleRate: number;
};

type LTCReaderChannelState = {
  lastFrameWallMillis: number | null;
  lastTimecodeMillis: number | null;
  lastValidTimecodeMillis: number | null;
  lastPlayingState: SMPTETimecodePlayState | null;
  stoppedTimeoutId: ReturnType<typeof setTimeout> | null;
  modeDetector: LTCModeDetector;
  timingStabilizer: LTCTimingStabilizer;
};

const createReaderChannelState = (): LTCReaderChannelState => ({
  lastFrameWallMillis: null,
  lastTimecodeMillis: null,
  lastValidTimecodeMillis: null,
  lastPlayingState: null,
  stoppedTimeoutId: null,
  modeDetector: createLTCModeDetector(),
  timingStabilizer: createLTCTimingStabilizer(),
});

export const createLTCReader = ({
  ctx,
  channels,
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

    channelState.lastPlayingState = stoppedState;
    handlePlayStateChange(channel, stoppedState);
  };

  const scheduleStoppedState = (
    channel: number,
    frameDurationMillis: number,
  ) => {
    const channelState = channelStates[channel];
    if (!channelState || closed) {
      return;
    }

    if (channelState.stoppedTimeoutId) {
      clearTimeout(channelState.stoppedTimeoutId);
    }

    const stoppedTimeoutMillis = Math.max(
      DEFAULT_STOPPED_TIMEOUT_MS,
      frameDurationMillis * 4,
    );
    channelState.stoppedTimeoutId = setTimeout(() => {
      if (channelState.lastValidTimecodeMillis !== null) {
        sendStoppedState(channel, channelState.lastValidTimecodeMillis);
      }
    }, stoppedTimeoutMillis);
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
    scheduleStoppedState(channel, frameDurationMillis);

    const frameWallMillis =
      contextStartWallMillis + (bitStartFrame / sampleRate) * 1000;
    const frameAddress = decodeLTCFrameAddress(bits, direction);
    if (!frameAddress) {
      return;
    }

    const mode = channelState.modeDetector.recordFrame(
      frameAddress,
      frameWallMillis,
    );
    if (!mode) {
      return;
    }

    const decodedFrame = decodeLTCFrameBits(bits, { direction, mode });
    if (!decodedFrame) {
      return;
    }

    const timecodeMillis = getMillisFromTimecode(decodedFrame.timecode);
    channelState.lastValidTimecodeMillis = timecodeMillis;
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
      channelState.lastPlayingState?.state === 'playing'
        ? channelState.lastPlayingState.speed
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
    const previousPlayingState = channelState.lastPlayingState;

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
      channelState.lastPlayingState = nextPlayingState;
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
        if (channelState.stoppedTimeoutId) {
          clearTimeout(channelState.stoppedTimeoutId);
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

  // Create simple oscillator for testing
  const oscillator = ctx.createOscillator();
  oscillator.type = 'square';
  oscillator.frequency.value = 600;
  oscillator.connect(output);
  oscillator.start();

  return {
    getOutput() {
      return output;
    },
    setPlayState() {
      // TODO
    },
    close() {
      // TODO
      oscillator.stop();
    },
  };
};
