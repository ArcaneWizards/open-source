import { isValidTimecode } from '../dist/index.cjs';

describe('isValidTimecode', () => {
  test('accepts valid timecode frames for supported SMPTE modes', () => {
    expect(
      isValidTimecode({
        hours: 23,
        minutes: 59,
        seconds: 59,
        frame: 23,
        mode: 'FILM',
      }),
    ).toBe(true);
    expect(
      isValidTimecode({
        hours: 23,
        minutes: 59,
        seconds: 59,
        frame: 24,
        mode: 'EBU',
      }),
    ).toBe(true);
    expect(
      isValidTimecode({
        hours: 23,
        minutes: 59,
        seconds: 59,
        frame: 29,
        mode: 'SMPTE',
      }),
    ).toBe(true);
    expect(
      isValidTimecode({
        hours: 0,
        minutes: 1,
        seconds: 0,
        frame: 2,
        mode: 'DF',
      }),
    ).toBe(true);
  });

  test('rejects out-of-range timecode fields', () => {
    expect(
      isValidTimecode({
        hours: 24,
        minutes: 0,
        seconds: 0,
        frame: 0,
        mode: 'SMPTE',
      }),
    ).toBe(false);
    expect(
      isValidTimecode({
        hours: 0,
        minutes: 60,
        seconds: 0,
        frame: 0,
        mode: 'SMPTE',
      }),
    ).toBe(false);
    expect(
      isValidTimecode({
        hours: 0,
        minutes: 0,
        seconds: 60,
        frame: 0,
        mode: 'SMPTE',
      }),
    ).toBe(false);
    expect(
      isValidTimecode({
        hours: 0,
        minutes: 0,
        seconds: 0,
        frame: 30,
        mode: 'SMPTE',
      }),
    ).toBe(false);
  });

  test('rejects dropped drop-frame addresses', () => {
    expect(
      isValidTimecode({
        hours: 0,
        minutes: 1,
        seconds: 0,
        frame: 0,
        mode: 'DF',
      }),
    ).toBe(false);
    expect(
      isValidTimecode({
        hours: 0,
        minutes: 1,
        seconds: 0,
        frame: 1,
        mode: 'DF',
      }),
    ).toBe(false);
    expect(
      isValidTimecode({
        hours: 0,
        minutes: 10,
        seconds: 0,
        frame: 0,
        mode: 'DF',
      }),
    ).toBe(true);
  });
});
