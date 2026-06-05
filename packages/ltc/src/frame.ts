import {
  isValidTimecode,
  SMPTE_TIMECODE_FPS,
  type SMPTETimecodeFrame,
  type SMPTETimecodeMode,
} from '@arcanewizards/smpte';

export type LTCBit = 0 | 1;
export type LTCBits = Uint8Array;
export type LTCNibble =
  | 0
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15;
export type LTCDirection = 'forward' | 'reverse';
export type LTCBinaryGroupFlags = [boolean, boolean, boolean];
export type LTCUserBits = [
  LTCNibble,
  LTCNibble,
  LTCNibble,
  LTCNibble,
  LTCNibble,
  LTCNibble,
  LTCNibble,
  LTCNibble,
];

export type LTCFrameAddress = {
  hours: number;
  minutes: number;
  seconds: number;
  frame: number;
  dropFrame: boolean;
  colorFrame: boolean;
  binaryGroupFlags: LTCBinaryGroupFlags;
  userBits: LTCUserBits;
};

export type LTCFrameEncodeOptions = {
  timecode: SMPTETimecodeFrame;
  colorFrame?: boolean;
  binaryGroupFlags?: Partial<LTCBinaryGroupFlags>;
  userBits?: Partial<LTCUserBits>;
  dst?: LTCBits;
};

export type LTCFrameDecodeOptions = {
  direction?: LTCDirection;
  mode?: SMPTETimecodeMode;
  frameRate?: number;
};

export type LTCDecodedFrame = {
  timecode: SMPTETimecodeFrame;
  direction: LTCDirection;
  dropFrame: boolean;
  colorFrame: boolean;
  binaryGroupFlags: LTCBinaryGroupFlags;
  userBits: LTCUserBits;
};

export const LTC_FRAME_BIT_COUNT = 80;
export const LTC_SYNC_WORD_START = 64;
const LTC_SYNC_WORD_VALUES: readonly LTCBit[] = [
  0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1,
];
export const LTC_SYNC_WORD_BITS: Readonly<LTCBits> = new Uint8Array(
  LTC_SYNC_WORD_VALUES,
);
export const LTC_REVERSE_SYNC_WORD_BITS: Readonly<LTCBits> = new Uint8Array(
  [...LTC_SYNC_WORD_VALUES].reverse(),
);

const DEFAULT_BINARY_GROUP_FLAGS: LTCBinaryGroupFlags = [false, false, false];
const DEFAULT_USER_BITS: LTCUserBits = [0, 0, 0, 0, 0, 0, 0, 0];

const readBits = (
  bits: ArrayLike<number>,
  offset: number,
  length: number,
): number => {
  let value = 0;
  for (let i = 0; i < length; i += 1) {
    value |= bits[offset + i]! << i;
  }
  return value;
};

const readNibble = (bits: ArrayLike<number>, offset: number): LTCNibble => {
  return readBits(bits, offset, 4) as LTCNibble;
};

const writeBits = (
  bits: LTCBits,
  offset: number,
  length: number,
  value: number,
): void => {
  for (let i = 0; i < length; i += 1) {
    bits[offset + i] = (value >> i) & 1;
  }
};

const hasExpectedBitCount = (bits: ArrayLike<number>): boolean => {
  return bits.length === LTC_FRAME_BIT_COUNT;
};

const hasBCDRange = (units: number, tens: number, max: number): boolean => {
  return units < 10 && tens * 10 + units <= max;
};

const copyReversedBits = (bits: ArrayLike<number>): LTCBits => {
  const reversed = new Uint8Array(bits.length);
  for (let i = 0; i < bits.length; i += 1) {
    reversed[i] = bits[bits.length - i - 1]!;
  }
  return reversed;
};

const getLTCParityBitIndex = (mode: SMPTETimecodeMode): number => {
  return mode === 'EBU' ? 59 : 27;
};

export const applyLTCParityCorrection = (
  bits: LTCBits,
  mode: SMPTETimecodeMode,
): void => {
  const parityBitIndex = getLTCParityBitIndex(mode);
  bits[parityBitIndex] = 0;

  const zeroCount = bits.reduce<number>(
    (count, bit) => (bit === 0 ? count + 1 : count),
    0,
  );

  if (zeroCount % 2 !== 0) {
    bits[parityBitIndex] = 1;
  }
};

export const encodeLTCFrameBits = ({
  timecode,
  colorFrame = false,
  binaryGroupFlags = DEFAULT_BINARY_GROUP_FLAGS,
  userBits = DEFAULT_USER_BITS,
  dst,
}: LTCFrameEncodeOptions): LTCBits => {
  if (!isValidTimecode(timecode)) {
    throw new Error('Cannot encode invalid LTC timecode frame');
  }

  const bits = dst ?? new Uint8Array(LTC_FRAME_BIT_COUNT);
  if (bits.length !== LTC_FRAME_BIT_COUNT) {
    throw new Error('LTC frame destination buffer must contain 80 bits');
  }
  bits.fill(0);

  const resolvedBinaryGroupFlags = DEFAULT_BINARY_GROUP_FLAGS.map(
    (flag, i) => binaryGroupFlags[i] ?? flag,
  ) as LTCBinaryGroupFlags;
  const resolvedUserBits = DEFAULT_USER_BITS.map(
    (value, i) => userBits[i] ?? value,
  ) as LTCUserBits;

  writeBits(bits, 0, 4, timecode.frame % 10);
  writeBits(bits, 4, 4, resolvedUserBits[0]);
  writeBits(bits, 8, 2, Math.floor(timecode.frame / 10));
  bits[10] = timecode.mode === 'DF' ? 1 : 0;
  bits[11] = colorFrame ? 1 : 0;
  writeBits(bits, 12, 4, resolvedUserBits[1]);

  writeBits(bits, 16, 4, timecode.seconds % 10);
  writeBits(bits, 20, 4, resolvedUserBits[2]);
  writeBits(bits, 24, 3, Math.floor(timecode.seconds / 10));
  writeBits(bits, 28, 4, resolvedUserBits[3]);

  writeBits(bits, 32, 4, timecode.minutes % 10);
  writeBits(bits, 36, 4, resolvedUserBits[4]);
  writeBits(bits, 40, 3, Math.floor(timecode.minutes / 10));
  bits[43] = resolvedBinaryGroupFlags[0] ? 1 : 0;
  writeBits(bits, 44, 4, resolvedUserBits[5]);

  writeBits(bits, 48, 4, timecode.hours % 10);
  writeBits(bits, 52, 4, resolvedUserBits[6]);
  writeBits(bits, 56, 2, Math.floor(timecode.hours / 10));
  bits[58] = resolvedBinaryGroupFlags[1] ? 1 : 0;
  bits[59] = resolvedBinaryGroupFlags[2] ? 1 : 0;
  writeBits(bits, 60, 4, resolvedUserBits[7]);

  for (let i = 0; i < LTC_SYNC_WORD_BITS.length; i += 1) {
    bits[LTC_SYNC_WORD_START + i] = LTC_SYNC_WORD_BITS[i]!;
  }

  applyLTCParityCorrection(bits, timecode.mode);

  return bits;
};

export const matchesLTCSyncWord = (
  bits: ArrayLike<number>,
  offset = LTC_SYNC_WORD_START,
): LTCDirection | null => {
  const canContainSync =
    offset >= 0 && offset + LTC_SYNC_WORD_BITS.length <= bits.length;
  if (!canContainSync) {
    return null;
  }

  let matchesForward = true;
  let matchesReverse = true;

  for (let i = 0; i < LTC_SYNC_WORD_BITS.length; i += 1) {
    const bit = bits[offset + i];
    matchesForward &&= bit === LTC_SYNC_WORD_BITS[i];
    matchesReverse &&= bit === LTC_REVERSE_SYNC_WORD_BITS[i];
  }

  if (matchesForward) {
    return 'forward';
  }
  if (matchesReverse) {
    return 'reverse';
  }
  return null;
};

export const findLTCSyncWord = (
  bits: ArrayLike<number>,
): { offset: number; direction: LTCDirection } | null => {
  for (
    let offset = 0;
    offset <= bits.length - LTC_SYNC_WORD_BITS.length;
    offset += 1
  ) {
    const direction = matchesLTCSyncWord(bits, offset);
    if (direction) {
      return { offset, direction };
    }
  }
  return null;
};

export const decodeLTCFrameAddress = (
  bits: ArrayLike<number>,
  direction: LTCDirection = 'forward',
): LTCFrameAddress | null => {
  if (!hasExpectedBitCount(bits)) {
    return null;
  }

  const frameBits = direction === 'reverse' ? copyReversedBits(bits) : bits;

  if (matchesLTCSyncWord(frameBits) !== 'forward') {
    return null;
  }

  const frameUnits = readBits(frameBits, 0, 4);
  const frameTens = readBits(frameBits, 8, 2);
  const secondsUnits = readBits(frameBits, 16, 4);
  const secondsTens = readBits(frameBits, 24, 3);
  const minutesUnits = readBits(frameBits, 32, 4);
  const minutesTens = readBits(frameBits, 40, 3);
  const hoursUnits = readBits(frameBits, 48, 4);
  const hoursTens = readBits(frameBits, 56, 2);

  if (
    !hasBCDRange(frameUnits, frameTens, 29) ||
    !hasBCDRange(secondsUnits, secondsTens, 59) ||
    !hasBCDRange(minutesUnits, minutesTens, 59) ||
    !hasBCDRange(hoursUnits, hoursTens, 23)
  ) {
    return null;
  }

  return {
    frame: frameTens * 10 + frameUnits,
    seconds: secondsTens * 10 + secondsUnits,
    minutes: minutesTens * 10 + minutesUnits,
    hours: hoursTens * 10 + hoursUnits,
    dropFrame: frameBits[10] === 1,
    colorFrame: frameBits[11] === 1,
    binaryGroupFlags: [
      frameBits[43] === 1,
      frameBits[58] === 1,
      frameBits[59] === 1,
    ],
    userBits: [
      readNibble(frameBits, 4),
      readNibble(frameBits, 12),
      readNibble(frameBits, 20),
      readNibble(frameBits, 28),
      readNibble(frameBits, 36),
      readNibble(frameBits, 44),
      readNibble(frameBits, 52),
      readNibble(frameBits, 60),
    ],
  };
};

export const getSMPTETimecodeModeFromLTCFrame = (
  address: Pick<LTCFrameAddress, 'dropFrame' | 'frame'>,
  frameRate?: number,
): SMPTETimecodeMode | null => {
  if (address.dropFrame) {
    return 'DF';
  }

  if (address.frame >= 25) {
    return 'SMPTE';
  }
  if (address.frame === 24) {
    return 'EBU';
  }

  if (typeof frameRate !== 'number') {
    return null;
  }

  let nearestMode: SMPTETimecodeMode | null = null;
  let nearestDiff = Number.POSITIVE_INFINITY;

  for (const mode of ['FILM', 'EBU', 'SMPTE'] as const) {
    const diff = Math.abs(SMPTE_TIMECODE_FPS[mode] - frameRate);
    if (diff < nearestDiff) {
      nearestDiff = diff;
      nearestMode = mode;
    }
  }

  return nearestDiff <= 0.2 ? nearestMode : null;
};

export const decodeLTCFrameBits = (
  bits: ArrayLike<number>,
  { direction = 'forward', mode, frameRate }: LTCFrameDecodeOptions = {},
): LTCDecodedFrame | null => {
  const address = decodeLTCFrameAddress(bits, direction);
  if (!address) {
    return null;
  }

  const resolvedMode =
    mode ?? getSMPTETimecodeModeFromLTCFrame(address, frameRate);
  if (!resolvedMode) {
    return null;
  }

  const timecode: SMPTETimecodeFrame = {
    hours: address.hours,
    minutes: address.minutes,
    seconds: address.seconds,
    frame: address.frame,
    mode: resolvedMode,
  };

  if (!isValidTimecode(timecode)) {
    return null;
  }

  return {
    timecode,
    direction,
    dropFrame: address.dropFrame,
    colorFrame: address.colorFrame,
    binaryGroupFlags: address.binaryGroupFlags,
    userBits: address.userBits,
  };
};
