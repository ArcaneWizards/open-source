import type { SMPTETimecodePlayState } from '@arcanewizards/smpte';

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

const LTC_READER_WORKLET_SOURCE = `
class LTCReaderProcessor extends AudioWorkletProcessor {
  process() {
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

export const createLTCReader = ({
  ctx,
  channels,
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
      for (const node of channelNodes) {
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
