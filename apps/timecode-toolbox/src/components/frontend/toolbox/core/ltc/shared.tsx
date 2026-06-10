import { createContext } from 'react';

export type LtcState = 'here' | 'elsewhere' | null;

export type LtcContextData = {
  /**
   * Is this LTC timecode currently connected to an audio input/output?
   * And if so where...
   *
   * To keep things simple,
   * we require that only one window / client is playing/receiving a
   * specific LTC output/input at a time.
   */
  state: LtcState;
  startLtcConnection: () => void;
  release: () => void;
  /**
   * @deprecated TODO: pass all errors into server state and remove this arg.
   */
  errors: string[];
} | null;

export const LtcContext = createContext<LtcContextData>(null);
