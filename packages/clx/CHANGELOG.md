# @arcanewizards/clx

## 0.2.1

### Patch Changes

- db2ce7d: Decrease reported totalTime precision to 150ms

  This accounts for the less accurate track-length that usage of Server with
  Serato reports.

- 4ce9591: Fire a `deck-disconnected` for every known deck when server disconnects

  A monitor client may not make use of host / server information in the same way
  as decks (for example, it may only care about connected decks).
  As such, to make cleanup easier,
  send a `deck-disconnected` event for every known deck, and every deck that will
  have had a `timecode-changed` event fired,
  before sending the `server-disconnected` event.

## 0.2.0

### Minor Changes

- 73ec783: [breaking] Implement multicast for CLX

  This requires a new multicast property to be passed to `createClxClient`

### Patch Changes

- e5bf408: Handle Pitch=0 for paused states

  In Clockworks Server, Pitch is calculated automatically by the server and is not
  always reported by the DJ software, as a result, when paused pitch will be 0.

  This is in contrast to to when used with Gateway and CDJs,
  where Pitch is always reported to be the value of the tempo slider,
  even when paused.

  As such we needed to add logic to account for a 0-valued Pitch,
  and assume that the decks are paused when in this state.

- a6e5a54: Fix parsing of CLX control packets
- e5bf408: Better handling of 0-length tracks
  - Also correctly handle +/-Infinity values for NormalizedPosition
    (not just NaN)
  - When a track has a length of 0, ensure that totalTime is not present
    (as with SMPTE timecodes).

- 2299816: [breaking] Send host & port in monitor

  Rather than sending a host ID, always send the hostname and port in all events,
  so that consumers can decide how they want to aggregate this data.

- 2299816: Wait for minimum amount of time before considering deck paused

  Rather than considering sequential deck messages with the same position as the
  deck being in a paused state, wait for a minimum amount of time.
  This previously worked well with Clockworks Gateway and Pioneer equipment,
  but some integrations like Clockworks Server with Serato will send multiple
  deck messages with the same position even if the playback is proceeding normally.

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

- 2299816: Report time/length precision as 1ms

  Avoid a situation where floating-point-comparisons may consider a timecode track
  to be for a different song, even though the length will be within 1ms and track
  metadata matching.

- 2299816: Handle NaN in NormalizedPosition

  Better handle Serato integration for tracks that weren't analysed prior to being
  loaded into the decks.

- a6e5a54: Correct use of pitch information

  Ensure we avoid many internal state updates by correctly incorporating the pitch
  of each deck as the speed information.

- Updated dependencies [b3238bb]
- Updated dependencies [271713b]
  - @arcanewizards/net-utils@0.3.0
