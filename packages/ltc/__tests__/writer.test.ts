import vm from 'node:vm';
import type { SMPTETimecodePlayState } from '@arcanewizards/smpte';
import { createLTCReader, createLTCWriter } from '../src';
import { decodeLTCFrameBits } from '../src/frame';

const SAMPLE_RATE = 48_000;
const RENDER_QUANTUM = 128;
const WALL_START_MILLIS = 1_000_000;
const FPS = 30;
const FRAME_SAMPLES = SAMPLE_RATE / FPS;

type MessageListener = ((event: { data: unknown }) => void) | null;

type FakePort = {
  onmessage: MessageListener;
  postMessage: (data: unknown) => void;
  close: () => void;
};

type WorkletProcessor = {
  port: FakePort;
  process: (inputs: Float32Array[][], outputs: Float32Array[][]) => boolean;
};

type ReaderFrameMessage = {
  type: 'frame';
  direction: 'forward' | 'reverse';
  bits: Uint8Array;
  bitStartFrame: number;
};

/**
 * Minimal AudioWorklet environment that evaluates the real worklet sources
 * in a sandbox, so the writer and reader DSP can be driven sample-accurately.
 */
const createWorkletHarness = () => {
  const context = vm.createContext({
    sampleRate: SAMPLE_RATE,
    currentFrame: 0,
    console,
  });
  let pendingPort: FakePort | null = null;
  vm.runInContext(
    `globalThis.AudioWorkletProcessor = class AudioWorkletProcessor {
      constructor() { this.port = globalThis.__takePort(); }
    };`,
    context,
  );
  context.__takePort = () => {
    const port = pendingPort;
    pendingPort = null;
    return port;
  };
  const processorClasses = new Map<string, new (options: unknown) => unknown>();
  context.registerProcessor = (
    name: string,
    cls: new (options: unknown) => unknown,
  ) => {
    processorClasses.set(name, cls);
  };

  const blobs = new Map<string, Blob>();
  let nextBlobId = 0;
  jest.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    const url = `blob:test/${nextBlobId++}`;
    blobs.set(url, blob as Blob);
    return url;
  });
  jest.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

  const processors: WorkletProcessor[] = [];

  class FakeAudioWorkletNode {
    public readonly port: FakePort;
    public readonly processor: WorkletProcessor;

    constructor(
      _ctx: unknown,
      name: string,
      options: { processorOptions: unknown },
    ) {
      const ProcessorClass = processorClasses.get(name);
      if (!ProcessorClass) {
        throw new Error(`Unknown processor ${name}`);
      }
      const nodePort: FakePort = {
        onmessage: null,
        postMessage: (data) => processorPort.onmessage?.({ data }),
        close: () => undefined,
      };
      const processorPort: FakePort = {
        onmessage: null,
        postMessage: (data) => nodePort.onmessage?.({ data }),
        close: () => undefined,
      };
      pendingPort = processorPort;
      this.port = nodePort;
      this.processor = new ProcessorClass(options) as WorkletProcessor;
      processors.push(this.processor);
    }

    connect() {}
    disconnect() {}
  }

  (globalThis as Record<string, unknown>).AudioWorkletNode =
    FakeAudioWorkletNode;

  const fakeNode = () => ({
    channelCount: 1,
    channelCountMode: 'explicit',
    channelInterpretation: 'discrete',
    gain: { value: 1 },
    connect() {},
    disconnect() {},
  });

  const ctx = {
    currentTime: 0,
    destination: fakeNode(),
    createGain: fakeNode,
    createChannelSplitter: fakeNode,
    audioWorklet: {
      addModule: async (url: string) => {
        const blob = blobs.get(url);
        if (!blob) {
          throw new Error(`Unknown module ${url}`);
        }
        // Each worklet module has its own top-level scope
        vm.runInContext(`{\n${await blob.text()}\n}`, context);
      },
    },
  } as unknown as AudioContext;

  const setCurrentFrame = (frame: number) => {
    context.currentFrame = frame;
  };

  return { ctx, processors, setCurrentFrame };
};

const flushPromises = async () => {
  for (let i = 0; i < 10; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
};

const getFrameIndex = (bits: Uint8Array) => {
  const decoded = decodeLTCFrameBits(bits, { mode: 'SMPTE' });
  if (!decoded) {
    return null;
  }
  const { hours, minutes, seconds, frame } = decoded.timecode;
  return ((hours * 60 + minutes) * 60 + seconds) * FPS + frame;
};

type RunOptions = {
  durationSeconds: number;
  /**
   * Play state updates to apply before rendering the quantum that contains
   * the given sample.
   */
  updates: Array<{ atSample: number; state: SMPTETimecodePlayState }>;
};

const runWriterIntoReader = async ({
  durationSeconds,
  updates,
}: RunOptions) => {
  jest.spyOn(Date, 'now').mockReturnValue(WALL_START_MILLIS);
  const { ctx, processors, setCurrentFrame } = createWorkletHarness();

  const writer = createLTCWriter({ ctx, channels: 1 });
  const reader = createLTCReader({
    ctx,
    channels: 1,
    frameMode: 'SMPTE',
    handlePlayStateChange: () => undefined,
  });
  await flushPromises();

  const [writerProcessor, readerProcessor] = processors;
  if (!writerProcessor || !readerProcessor) {
    throw new Error('Worklets were not created');
  }

  const frames: ReaderFrameMessage[] = [];
  const readerNodePort = readerProcessor.port;
  readerProcessor.port = {
    ...readerNodePort,
    postMessage: (data) => frames.push(data as ReaderFrameMessage),
  };

  const pendingUpdates = [...updates].sort((a, b) => a.atSample - b.atSample);
  const totalSamples = durationSeconds * SAMPLE_RATE;
  const buffer = new Float32Array(RENDER_QUANTUM);

  for (let start = 0; start < totalSamples; start += RENDER_QUANTUM) {
    while (
      pendingUpdates.length > 0 &&
      pendingUpdates[0]!.atSample < start + RENDER_QUANTUM
    ) {
      writer.setPlayState(0, pendingUpdates.shift()!.state);
    }
    setCurrentFrame(start);
    writerProcessor.process([], [[buffer]]);
    readerProcessor.process([[buffer]], [[new Float32Array(RENDER_QUANTUM)]]);
  }

  writer.close();
  reader.close();
  return frames;
};

const playingFromZero = (offsetMillis = 0): SMPTETimecodePlayState => ({
  state: 'playing',
  effectiveStartTime: WALL_START_MILLIS + offsetMillis,
  speed: 1,
  smpteMode: 'SMPTE',
});

const expectContinuousFrames = (frames: ReaderFrameMessage[]) => {
  // Skip the first frames while the reader calibrates
  const settled = frames.slice(2);
  expect(settled.length).toBeGreaterThan(0);

  const problems: string[] = [];
  for (let i = 1; i < settled.length; i += 1) {
    const prev = settled[i - 1]!;
    const next = settled[i]!;
    const prevIndex = getFrameIndex(prev.bits);
    const nextIndex = getFrameIndex(next.bits);
    if (prevIndex === null || nextIndex === null) {
      problems.push(`undecodable frame near sample ${next.bitStartFrame}`);
      continue;
    }
    if (nextIndex !== prevIndex + 1) {
      problems.push(
        `frame ${prevIndex} followed by ${nextIndex} at sample ${next.bitStartFrame}`,
      );
    }
    const spacing = next.bitStartFrame - prev.bitStartFrame;
    // Allow for sample quantization of bit edges and gentle slewing,
    // but not for a splice (which shifts a frame by a whole millisecond).
    if (Math.abs(spacing - FRAME_SAMPLES) > FRAME_SAMPLES * 0.005 + 1) {
      problems.push(
        `frame ${nextIndex} is ${spacing} samples long (expected ${FRAME_SAMPLES})`,
      );
    }
  }
  expect(problems).toEqual([]);
};

describe('LTC writer', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    delete (globalThis as Record<string, unknown>).AudioWorkletNode;
  });

  it('outputs continuous, evenly spaced frames for a steady play state', async () => {
    const frames = await runWriterIntoReader({
      durationSeconds: 3,
      updates: [{ atSample: 0, state: playingFromZero() }],
    });

    expect(frames.length).toBeGreaterThanOrEqual(3 * FPS - 2);
    expectContinuousFrames(frames);
  });

  it('does not splice the waveform when the start time is nudged by clock-sync jitter', async () => {
    // Mimic a browser/server clock-offset estimate that is re-measured once a
    // second and jitters by ~1ms, landing mid-frame each time.
    const jitterMillis = [1, 0, 1, -1, 0, 1, 2, 1, 0];
    const updates = [
      { atSample: 0, state: playingFromZero() },
      ...jitterMillis.map((offsetMillis, i) => ({
        atSample: Math.round((i + 1 + 22.4 / FPS) * SAMPLE_RATE),
        state: playingFromZero(offsetMillis),
      })),
    ];

    const frames = await runWriterIntoReader({
      durationSeconds: jitterMillis.length + 2,
      updates,
    });

    expect(frames.length).toBeGreaterThanOrEqual(
      (jitterMillis.length + 2) * FPS - 2,
    );
    expectContinuousFrames(frames);
  });

  it('converges on the new start time after a small correction', async () => {
    const frames = await runWriterIntoReader({
      durationSeconds: 4,
      updates: [
        { atSample: 0, state: playingFromZero() },
        // Shift the timeline 2ms later, i.e. timecode should run 2ms behind
        { atSample: SAMPLE_RATE, state: playingFromZero(2) },
      ],
    });

    expectContinuousFrames(frames);
    // After slewing, frame boundaries should land 2ms (96 samples) later
    // than they did before the correction.
    const last = frames[frames.length - 1]!;
    const lastIndex = getFrameIndex(last.bits)!;
    const expectedStart = lastIndex * FRAME_SAMPLES + 0.002 * SAMPLE_RATE;
    expect(Math.abs(last.bitStartFrame - expectedStart)).toBeLessThanOrEqual(2);
  });

  it('jumps immediately for large changes in start time', async () => {
    const frames = await runWriterIntoReader({
      durationSeconds: 3,
      updates: [
        { atSample: 0, state: playingFromZero() },
        // Seek forward by 10 seconds
        { atSample: SAMPLE_RATE, state: playingFromZero(-10_000) },
      ],
    });

    const indices = frames
      .map((frame) => getFrameIndex(frame.bits))
      .filter((index): index is number => index !== null);
    expect(indices.some((index) => index >= 10 * FPS + FPS)).toBe(true);
    expect(indices.some((index) => index > FPS + 5 && index < 10 * FPS)).toBe(
      false,
    );
  });
});
