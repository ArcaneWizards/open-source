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

export const createLTCReader = ({
  ctx,
  channels,
}: LTCReaderOptions): LTCReader => {
  const input = ctx.createGain();
  input.channelCount = channels;
  input.channelCountMode = 'explicit';
  input.channelInterpretation = 'discrete';

  // TODO: temporarily just read the amplitude occasionally

  let lastValue = 0;
  const analyser = ctx.createAnalyser();
  input.connect(analyser);
  const interval = setInterval(() => {
    const data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);
    const value = data.reduce((sum, v) => sum + Math.abs(v - 128), 0);
    if (Math.abs(value - lastValue) > 10) {
      lastValue = value;
    }
  }, 100);

  return {
    getInput() {
      return input;
    },
    close() {
      clearInterval(interval);
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
