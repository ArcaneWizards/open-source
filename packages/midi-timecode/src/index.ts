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
  setPlayState: (state: MIDITimecodePlayState) => void;
};

export const createMIDITimecodeSender = ({
  sendMessage,
  mode,
}: MIDITimecodeSenderOptions): MIDITimecodeSender => {
  let playState: MIDITimecodePlayState = {
    state: 'stopped',
    currentTimeMillis: 0,
  };

  const setPlayState: MIDITimecodeSender['setPlayState'] = (state) => {
    playState = state;
  };

  setInterval(() => {
    sendMessage([0xf0, 0x7f, 0x00, 0x01, 0x01, 0x02, 0x03, 0x04, 0x05, 0xf7]);
  }, 100);

  return {
    setPlayState,
  };
};

export type MIDITimecodeReceiverOptions = {
  handlePlayStateChange: (state: MIDITimecodePlayState) => void;
};

export type MIDITimecodeReceiver = {
  receiveMessage: (message: number[]) => void;
};

export const createMIDITimecodeReceiver = ({
  handlePlayStateChange,
}: MIDITimecodeReceiverOptions): MIDITimecodeReceiver => {
  const receiveMessage: MIDITimecodeReceiver['receiveMessage'] = (message) => {
    handlePlayStateChange({
      state: 'playing',
      effectiveStartTime: Date.now(),
      speed: 1,
    });
  };

  return {
    receiveMessage,
  };
};
