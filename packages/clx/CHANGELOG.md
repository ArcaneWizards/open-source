# @arcanewizards/clx

## 0.1.1

### Patch Changes

- a6e5a54: Fix parsing of CLX control packets
- d52bd77: Determine onAir state based on fader & EQ values
- a6e5a54: Request resync when CLX data is missing
- ea73abe: Make Active optional for compatibility with Clockworks Server

  The `Active` field of control packets is not always present,
  for example when using Server with Serato.

- a6e5a54: Only consider a deck playing after receiving proper packets

  Until we receive packets that are advancing at roughly the same speed as
  indicated by the pitch value, dont' consider a deck as being in the played state

  This will mean when seeking or scratching, a deck will be in a stopped state,
  and no flywheel behaviour will be observed.

- a6e5a54: Correct use of pitch information

  Ensure we avoid many internal state updates by correctly incorporating the pitch
  of each deck as the speed information.

- Updated dependencies [b3238bb]
- Updated dependencies [271713b]
  - @arcanewizards/net-utils@0.3.0
