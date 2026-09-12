import {
  bindSocket,
  ConnectionConfig,
  getNetworkInterfaces,
} from '@arcanewizards/net-utils';
import { createSocket, RemoteInfo, Socket } from 'node:dgram';
import { EventEmitter } from 'node:events';
import { CLX_PORT } from './constants.js';

export type ClxBasePacketEvent = {
  host: string;
  port: number;
};

const PACKET_TYPES = Object.freeze({
  DECK: 0x01,
  META: 0x02,
  CONTROL: 0x00,
  WAVEFORM_REQUEST: 0x03,
  EVENT: 0x04,
  BINARY: 0x05,
  RESYNC_REQUEST: 0x09,
});

/**
 * Represents the real-time state of a single playback deck.
 *
 * @see https://github.com/medcelerate/CLX-Spec#deck-packet-0x01
 */
export type ClxDeckPacketEvent = ClxBasePacketEvent & {
  /**
   * Track pitch or velocity
   */
  pitch: number;
  /** Current playhead position */
  positionSeconds: number;
  /** Beatgrid position (Beat Number.fraction) */
  positionBeatGrid: number;
  /** Position normalized to range [0.0–1.0] */
  positionNormalized: number;
  bpm: number;
  /** Track duration (in seconds) */
  durationSeconds: number;
  /** Low EQ gain level */
  eqLow: number;
  /** Mid EQ gain level */
  eqMid: number;
  /** High EQ gain level */
  eqHigh: number;
  /** Deck index (0 = A, 1 = B, etc...) */
  deck: number;
  /** Current Beat (1-4) all other values should be ignored */
  beat: number;
};

/**
 * Track metadata, typically sent once on load or when requested.
 *
 * @see Fader https://github.com/medcelerate/CLX-Spec#metadata-packet-0x02
 */
export type ClxMetadataPacketEvent = ClxBasePacketEvent & {
  deck: number;
  title: string;
  artist: string;
  album: string;
  filePath: string;
};

/**
 * Represents mixer fader states and app state.
 *
 * @see https://github.com/medcelerate/CLX-Spec#control-packet-0x00
 */
export type ClxControlPacketEvent = ClxBasePacketEvent & {
  /** Fader level for Deck A */
  upFaderA: number;
  /** Fader level for Deck B */
  upFaderB: number;
  /** Fader level for Deck C */
  upFaderC: number;
  /** Fader level for Deck D */
  upFaderD: number;
  /** Crossfader position (range between 0 - 1) */
  crossfader: number;
  /** Active deck or focus status */
  activeDeck: number;
  /** App connection or session state */
  appState: string;
};

/**
 * Signals a client-initiated action or state change.
 *
 * @see https://github.com/medcelerate/CLX-Spec#event-packet-0x04
 */
export type ClxEventPacketEvent = ClxBasePacketEvent & {
  /** Event name */
  event: string;
  /** Optional numeric value for the event */
  eventData: number;
};

/**
 * A binary packet containing arbitrary data.
 *
 * This event is only fired if the payload type is not something handled by
 * this library, allowing consumers to handle new payloads without
 * waiting for a library update.
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
export type ClxBinaryPacketEvent = ClxBasePacketEvent & {
  /** Payload discriminator, e.g. waveform or beatgrid */
  type: string;
  /** 32-byte payload identifier (ASCII-hex track hash) */
  hash: Buffer<ArrayBufferLike>;
  /** The reassembled data */
  data: Buffer<ArrayBufferLike>;
};

/**
 * Waveform Payload
 *
 * These should be saved as rwf files in a local cache.
 *
 * @see https://github.com/medcelerate/CLX-Spec#waveform-payload-type--waveform
 */
export type ClxWaveformDataEvent = ClxBinaryPacketEvent & {
  /**
   * The waveform data
   *
   * We follow the conventions from the BBC, with one alteration,
   * appended to the bottom is a CLRS section in binary
   * containing the rgb color values for each pair of values.
   * This is represented as clrs in the json format.
   * https://github.com/bbc/audiowaveform/blob/master/doc/DataFormat.md
   */
  data: Buffer<ArrayBufferLike>;
  /** md5 sum of track title, waveform file name */
  hash: Buffer<ArrayBufferLike>;
  /**
   * Optional; if true the receiver overwrites an existing cached waveform
   * for this hash
   * (older senders omit it, defaulting to false) */
  replace: boolean;
};

/**
 * These should be saved as bg files in a local cache.
 *
 * @see https://github.com/medcelerate/CLX-Spec#beatgrid-payload-type--beatgrid
 */
export type ClxBeatGridDataEvent = ClxBinaryPacketEvent & {
  /** 32-byte ASCII-hex track hash */
  hash: Buffer<ArrayBufferLike>;
  /** Total number of beats in the grid */
  total: number;
  /** Array of beatgrid marker maps */
  markers: Array<{
    /** Tempo in effect from this marker */
    bpm: number;
    /** Marker position in seconds from the start of the track */
    positionSeconds: number;
    /** True for the start/end markers that bracket the grid */
    terminal: boolean;
    /** Number of beats from this marker to the next */
    beatsToNext: number;
  }>;
};

export type ClxEventMap = {
  destroy: [];
  deckPacket: [ClxDeckPacketEvent];
  metadataPacket: [ClxMetadataPacketEvent];
  controlPacket: [ClxControlPacketEvent];
  eventPacket: [ClxEventPacketEvent];
  unhandledBinaryPacket: [ClxBinaryPacketEvent];
  waveformData: [ClxWaveformDataEvent];
  beatGridData: [ClxBeatGridDataEvent];
  error: [Error];
};

export type ClxClient = {
  connect: () => Promise<void>;
  on<K extends keyof ClxEventMap>(
    event: K,
    callback: (...args: ClxEventMap[K]) => void,
  ): void;
  addListener<K extends keyof ClxEventMap>(
    event: K,
    callback: (...args: ClxEventMap[K]) => void,
  ): void;
  removeListener<K extends keyof ClxEventMap>(
    event: K,
    callback: (...args: ClxEventMap[K]) => void,
  ): void;
  destroy: () => void;
};

export const createClxClient = (config: ConnectionConfig): ClxClient => {
  const events = new EventEmitter<ClxEventMap>();

  let receiveSocket: Socket | null = null;

  let destroyed = false;

  let connectPromise: Promise<void> | null = null;
  let interfacePromise: Promise<
    Awaited<ReturnType<typeof getNetworkInterfaces>>[string]
  > | null = null;

  const on = events.on.bind(events) as ClxClient['on'];
  const addListener = events.addListener.bind(
    events,
  ) as ClxClient['addListener'];
  const removeListener = events.removeListener.bind(
    events,
  ) as ClxClient['removeListener'];

  const getInterface = async () => {
    if (config.type === 'host') {
      throw new Error(
        'Network interface must be specified when listening for ArtNet packets',
      );
    }

    if (!interfacePromise) {
      interfacePromise = getNetworkInterfaces().then((interfaces) => {
        const iface = interfaces[config.interface];
        if (!iface) {
          throw new Error(`Network interface ${config.interface} not found`);
        }
        return iface;
      });
    }

    return interfacePromise;
  };

  const cleanupSockets = () => {
    receiveSocket?.close();
    receiveSocket = null;
    connectPromise = null;
  };

  const handlePacket = (packet: Buffer, source: RemoteInfo) => {
    for (const [type, code] of Object.entries(PACKET_TYPES)) {
      if (packet[0] === code) {
        console.log(`Received ${type}`);
        return;
      }
    }
    console.log(`Received unknown packet`);
  };

  const initializeReceiveSocket = async () => {
    if (receiveSocket) {
      return;
    }

    const iface = await getInterface();
    const bindAddress =
      iface.internal || process.platform === 'win32'
        ? iface.address
        : iface.broadcastAddress;
    const socket = createSocket({ type: 'udp4', reuseAddr: true });
    receiveSocket = socket;
    socket.on('message', handlePacket);

    try {
      await bindSocket(socket, config.port ?? CLX_PORT, bindAddress);
    } catch (error) {
      if (receiveSocket === socket) {
        receiveSocket = null;
      }
      socket.close();
      throw error;
    }

    socket.on('error', (error) => {
      events.emit('error', error);
    });
  };

  const connect: ClxClient['connect'] = async () => {
    if (destroyed) {
      throw new Error('Cannot connect destroyed ClxClient instance');
    }
    if (connectPromise) {
      return connectPromise;
    }

    connectPromise = (async () => {
      try {
        if (config.type === 'interface') {
          await initializeReceiveSocket();
        } else {
          throw new Error(
            'Network interface must be specified when listening for CLX packets',
          );
        }
      } catch (error) {
        cleanupSockets();
        throw error instanceof Error ? error : new Error(String(error));
      }
    })();

    return connectPromise;
  };

  const destroy = () => {
    destroyed = true;
    events.emit('destroy');
    cleanupSockets();
  };

  return {
    connect,
    on,
    addListener,
    removeListener,
    destroy,
  };
};
