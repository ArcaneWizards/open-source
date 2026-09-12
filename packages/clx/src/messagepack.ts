import z from 'zod/v4';

/**
 * Represents the real-time state of a single playback deck.
 *
 * @see https://github.com/medcelerate/CLX-Spec#deck-packet-0x01
 */
export const CLX_DECK_PACKET = z.object({
  /**
   * Track pitch or velocity
   */
  Pitch: z.number(),
  /** Current playhead position (in seconds) */
  Position: z.number(),
  /** Beatgrid position (Beat Number.fraction) */
  Position2: z.number(),
  /** Position normalized to range [0.0–1.0] */
  NormalizedPosition: z.number(),
  BPM: z.number(),
  /** Track duration (in seconds) */
  Length: z.number(),
  /** Low EQ gain level */
  EQLow: z.number(),
  /** Mid EQ gain level */
  EQMid: z.number(),
  /** High EQ gain level */
  EQHigh: z.number(),
  /** Deck index (0 = A, 1 = B, etc...) */
  Deck: z.number(),
  /** Current Beat (1-4) all other values should be ignored */
  Beat: z.number(),
});

export type ClxDeckPacket = z.infer<typeof CLX_DECK_PACKET>;

/**
 * Track metadata, typically sent once on load or when requested.
 *
 * @see Fader https://github.com/medcelerate/CLX-Spec#metadata-packet-0x02
 */
export const CLX_METADATA_PACKET = z.object({
  /** Deck index (0 = A, 1 = B, etc...) */
  Deck: z.number(),
  Title: z.string(),
  Artist: z.string(),
  Album: z.string(),
  FilePath: z.string(),
});

export type ClxMetadataPacket = z.infer<typeof CLX_METADATA_PACKET>;

/**
 * Represents mixer fader states and app state.
 *
 * @see https://github.com/medcelerate/CLX-Spec#control-packet-0x00
 */
export const CLX_CONTROL_PACKET = z.object({
  /** Fader level for Deck A */
  UpFaderA: z.number(),
  /** Fader level for Deck B */
  UpFaderB: z.number(),
  /** Fader level for Deck C */
  UpFaderC: z.number(),
  /** Fader level for Deck D */
  UpFaderD: z.number(),
  /** Crossfader position (range between 0 - 1) */
  Crossfader: z.number(),
  /** Active deck or focus status */
  Active: z.number(),
  /** App connection or session state */
  AppState: z.string(),
});

export type ClxControlPacket = z.infer<typeof CLX_CONTROL_PACKET>;

export const CLX_EVENT_PACKET = z.object({
  /** Event name (e.g., "Load", "Cue", "Play") */
  Event: z.string(),
  /** Optional numeric value for the event */
  Value: z.number().optional(),
});

export type ClxEventPacket = z.infer<typeof CLX_EVENT_PACKET>;

/**
 * A binary packet containing arbitrary data.
 *
 * Payloads larger than a single UDP datagram are split into fragments;
 * each fragment is one 0x05 packet carrying the same envelope fields below,
 * and the receiver reassembles them by Order.
 *
 * The Type field discriminates the payload (e.g. waveform, beatgrid).
 * Additional fields are optional depending on how the data needs to be used.
 * It is recommended to include an order value as well as the expected total size.
 *
 * @see https://github.com/medcelerate/CLX-Spec#binary-data-0x05
 */
export const CLX_BINARY_DATA_PACKET = z.object({
  /** Payload discriminator, e.g. waveform or beatgrid */
  Type: z.string(),
  /** 32-byte payload identifier (ASCII-hex track hash) */
  Hash: z.instanceof(Buffer),
  /** Total size of the reassembled payload in bytes */
  Total: z.number(),
  /** Fragment order index (0-based) */
  Order: z.number(),
  /**
   * Total number of fragments (optional; 0/absent on older senders
   * receiver then completes on the byte Total)
   */
  TotalFragments: z.number().optional(),
  /** Fragment binary data */
  Data: z.instanceof(Buffer),
});

export type ClxBinaryDataPacket = z.infer<typeof CLX_BINARY_DATA_PACKET>;

/**
 * Waveform Payload
 *
 * These should be saved as rwf files in a local cache.
 *
 * @see https://github.com/medcelerate/CLX-Spec#waveform-payload-type--waveform
 */
export const CLX_WAVEFORM_DATA_PAYLOAD = z.object({
  /** The binary of the waveform data */
  Data: z.instanceof(Buffer),
  /** md5 sum of track title, waveform file name */
  Hash: z.instanceof(Buffer),
  /**
   * Optional; if true the receiver overwrites an existing cached waveform
   * for this hash
   * (older senders omit it, defaulting to false)
   */
  Replace: z.boolean().optional(),
});

export type ClxWaveformDataPayload = z.infer<typeof CLX_WAVEFORM_DATA_PAYLOAD>;

/**
 * These should be saved as bg files in a local cache.
 *
 * @see https://github.com/medcelerate/CLX-Spec#beatgrid-payload-type--beatgrid
 */
export const CLX_BEATGRID_DATA_PAYLOAD = z.object({
  /** 32-byte ASCII-hex track hash */
  Hash: z.instanceof(Buffer),
  /** Total number of beats in the grid */
  Total: z.number(),
  /** Array of beatgrid marker maps */
  Markers: z.array(
    z.object({
      /** Tempo in effect from this marker */
      Bpm: z.number(),
      /** Marker position in seconds from the start of the track (in seconds) */
      Position: z.number(),
      /** True for the start/end markers that bracket the grid */
      Terminal: z.boolean(),
      /** Number of beats from this marker to the next */
      BeatsToNext: z.number(),
    }),
  ),
});

export type ClxBeatGridDataPayload = z.infer<typeof CLX_BEATGRID_DATA_PAYLOAD>;
