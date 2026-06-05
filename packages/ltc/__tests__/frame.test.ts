import {
  createLTCModeDetector,
  decodeLTCFrameAddress,
  decodeLTCFrameBits,
  encodeLTCFrameBits,
  findLTCSyncWord,
  LTC_FRAME_BIT_COUNT,
  LTC_SYNC_WORD_START,
  matchesLTCSyncWord,
} from '../src/frame';
import type {
  SMPTETimecodeFrame,
  SMPTETimecodeMode,
} from '@arcanewizards/smpte';

const frameAddress = (frame: number, dropFrame = false) => ({
  frame,
  dropFrame,
});

const timecode = (
  mode: SMPTETimecodeMode,
  frame: number,
): SMPTETimecodeFrame => ({
  hours: 1,
  minutes: mode === 'DF' ? 10 : 2,
  seconds: 3,
  frame,
  mode,
});

describe('LTC frame utilities', () => {
  test('encodes into reusable Uint8Array buffers', () => {
    const dst = new Uint8Array(LTC_FRAME_BIT_COUNT);
    dst.fill(1);

    const bits = encodeLTCFrameBits({
      timecode: timecode('SMPTE', 29),
      dst,
    });

    expect(bits).toBe(dst);
    expect(bits).toBeInstanceOf(Uint8Array);
    expect(bits).toHaveLength(LTC_FRAME_BIT_COUNT);
    expect(matchesLTCSyncWord(bits)).toBe('forward');
  });

  test.each([
    ['FILM', 23],
    ['EBU', 24],
    ['DF', 2],
    ['SMPTE', 29],
  ] as const)('round trips %s timecode fields', (mode, frame) => {
    const expectedTimecode = timecode(mode, frame);
    const bits = encodeLTCFrameBits({
      timecode: expectedTimecode,
      colorFrame: true,
      binaryGroupFlags: [true, false, true],
      userBits: [0, 1, 2, 3, 4, 5, 6, 7],
    });

    const decoded = decodeLTCFrameBits(bits, { mode });

    expect(decoded?.timecode).toEqual(expectedTimecode);
    expect(decoded?.direction).toBe('forward');
    expect(decoded?.dropFrame).toBe(mode === 'DF');
    expect(decoded?.colorFrame).toBe(true);
    expect(decoded?.userBits).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  test('decodes reversed bit windows when direction is reverse', () => {
    const expectedTimecode = timecode('SMPTE', 17);
    const bits = encodeLTCFrameBits({ timecode: expectedTimecode });
    const reversedBits = new Uint8Array([...bits].reverse());

    expect(matchesLTCSyncWord(reversedBits, 0)).toBe('reverse');
    expect(
      decodeLTCFrameBits(reversedBits, {
        direction: 'reverse',
        mode: 'SMPTE',
      })?.timecode,
    ).toEqual(expectedTimecode);
  });

  test('finds sync words inside larger bit windows', () => {
    const bits = encodeLTCFrameBits({ timecode: timecode('SMPTE', 1) });
    const largerWindow = new Uint8Array(LTC_FRAME_BIT_COUNT + 13);
    largerWindow.set(bits, 13);

    expect(findLTCSyncWord(largerWindow)).toEqual({
      offset: 13 + LTC_SYNC_WORD_START,
      direction: 'forward',
    });
  });

  test('infers mode from frame rate when the frame number cannot disambiguate it', () => {
    const bits = encodeLTCFrameBits({ timecode: timecode('FILM', 12) });

    expect(decodeLTCFrameBits(bits, { frameRate: 24 })?.timecode.mode).toBe(
      'FILM',
    );
    expect(decodeLTCFrameBits(bits, { frameRate: 25 })?.timecode.mode).toBe(
      'EBU',
    );
    expect(decodeLTCFrameBits(bits, { frameRate: 30 })?.timecode.mode).toBe(
      'SMPTE',
    );
  });

  test('infers mode from drop-frame flag and high frame numbers where possible', () => {
    expect(
      decodeLTCFrameBits(encodeLTCFrameBits({ timecode: timecode('DF', 2) }))
        ?.timecode.mode,
    ).toBe('DF');
    expect(
      decodeLTCFrameBits(
        encodeLTCFrameBits({ timecode: timecode('SMPTE', 29) }),
      )?.timecode.mode,
    ).toBe('SMPTE');
    expect(
      decodeLTCFrameBits(encodeLTCFrameBits({ timecode: timecode('EBU', 24) }))
        ?.timecode.mode,
    ).toBe('EBU');
  });

  test('detects mode from recent distinctive frame evidence', () => {
    const detector = createLTCModeDetector();

    expect(detector.recordFrame(frameAddress(29), 1_000)).toBeNull();
    expect(detector.recordFrame(frameAddress(25), 1_500)).toBeNull();
    expect(detector.recordFrame(frameAddress(29), 1_901)).toBe('SMPTE');
    expect(detector.recordFrame(frameAddress(12), 2_000)).toBe('SMPTE');
    expect(detector.recordFrame(frameAddress(24), 6_000)).toBeNull();
    expect(detector.recordFrame(frameAddress(24), 6_901)).toBe('EBU');
    expect(detector.recordFrame(frameAddress(12), 7_000)).toBe('EBU');
    expect(detector.recordFrame(frameAddress(23), 11_000)).toBeNull();
    expect(detector.recordFrame(frameAddress(23), 11_901)).toBe('FILM');
    expect(detector.recordFrame(frameAddress(12), 12_000)).toBe('FILM');
  });

  test('allows mode changes once stronger frame evidence expires', () => {
    const detector = createLTCModeDetector({
      evidenceTimeoutMillis: 4_000,
    });

    expect(detector.recordFrame(frameAddress(29), 1_000)).toBeNull();
    expect(detector.recordFrame(frameAddress(29), 1_901)).toBe('SMPTE');
    expect(detector.recordFrame(frameAddress(24), 5_902)).toBeNull();
    expect(detector.recordFrame(frameAddress(24), 6_803)).toBe('EBU');
    expect(detector.recordFrame(frameAddress(23), 10_804)).toBeNull();
    expect(detector.recordFrame(frameAddress(23), 11_705)).toBe('FILM');
  });

  test('treats drop-frame flag as immediate mode evidence without poisoning non-drop detection', () => {
    const detector = createLTCModeDetector({
      evidenceTimeoutMillis: 4_000,
    });

    expect(detector.recordFrame(frameAddress(29, true), 1_000)).toBe('DF');
    expect(detector.recordFrame(frameAddress(24), 1_500)).toBeNull();
    expect(detector.recordFrame(frameAddress(24), 2_401)).toBe('EBU');
  });

  test('can be tuned to require a different amount of mode evidence', () => {
    const detector = createLTCModeDetector({
      minimumEvidenceCount: 3,
      minimumEvidenceSpanMillis: 1_500,
    });

    expect(detector.recordFrame(frameAddress(29), 1_000)).toBeNull();
    expect(detector.recordFrame(frameAddress(28), 1_901)).toBeNull();
    expect(detector.recordFrame(frameAddress(27), 2_501)).toBe('SMPTE');
  });

  test('rejects invalid BCD fields', () => {
    const bits = encodeLTCFrameBits({ timecode: timecode('SMPTE', 1) });
    bits[0] = 0;
    bits[1] = 1;
    bits[2] = 0;
    bits[3] = 1;

    expect(decodeLTCFrameAddress(bits)).toBeNull();
  });

  test('rejects invalid timecode addresses', () => {
    expect(() =>
      encodeLTCFrameBits({
        timecode: {
          hours: 0,
          minutes: 1,
          seconds: 0,
          frame: 0,
          mode: 'DF',
        },
      }),
    ).toThrow('Cannot encode invalid LTC timecode frame');
  });
});
