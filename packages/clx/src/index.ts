import {
  bindSocket,
  ConnectionConfig,
  getNetworkInterfaces,
} from '@arcanewizards/net-utils';
import { createSocket, RemoteInfo, Socket } from 'node:dgram';
import { EventEmitter } from 'node:events';
import { CLX_PORT, CLX_SERVER_PORT } from './constants.js';
import { decode } from '@msgpack/msgpack';
import {
  CLX_CONTROL_PACKET,
  CLX_DECK_PACKET,
  CLX_EVENT_PACKET,
  CLX_METADATA_PACKET,
  ClxBeatGridDataPayload,
  ClxControlPacket,
  ClxDeckPacket,
  ClxEventPacket,
  ClxMetadataPacket,
  ClxWaveformDataPayload,
} from './messagepack.js';

export type ClxServerConnectionInfo = {
  host: string;
  port: number;
};

export type ClxBasePacketEvent<Packet> = ClxServerConnectionInfo & {
  packet: Packet;
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
export type ClxDeckPacketEvent = ClxBasePacketEvent<ClxDeckPacket>;

export type ClxMetadataPacketEvent = ClxBasePacketEvent<ClxMetadataPacket>;

export type ClxControlPacketEvent = ClxBasePacketEvent<ClxControlPacket>;

/**
 * Signals a client-initiated action or state change.
 *
 * @see https://github.com/medcelerate/CLX-Spec#event-packet-0x04
 */
export type ClxEventPacketEvent = ClxBasePacketEvent<ClxEventPacket>;

/**
 * A binary packet containing arbitrary data.
 *
 * This event is only fired if the payload type is not something handled by
 * this library, allowing consumers to handle new payloads without
 * waiting for a library update.
 *
 * It is also only fired when the entire binary payload has been constructed
 *
 * @see https://github.com/medcelerate/CLX-Spec#binary-data-0x05
 */
export type ClxBinaryPacketEvent = ClxServerConnectionInfo & {
  /** Payload discriminator, e.g. waveform or beatgrid */
  type: string;
  /** 32-byte payload identifier (ASCII-hex track hash) */
  hash: Buffer<ArrayBufferLike>;
  /** The reassembled data */
  data: Buffer<ArrayBufferLike>;
};

export type ClxWaveformDataEvent = ClxServerConnectionInfo & {
  payload: ClxWaveformDataPayload;
};

export type ClxBeatGridDataEvent = ClxServerConnectionInfo & {
  payload: ClxBeatGridDataPayload;
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
  /**
   * Send a request to the given host to resync the CLX session state.
   * This is useful if the client has missed packets and needs to resync.
   *
   * @param host The host to send the resync request to.
   */
  resync: (host: string) => void;
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
    let data: unknown = null;
    try {
      data = decode(packet.subarray(1));
    } catch (cause) {
      const error = new Error(
        `Received non Message-pack packet for type ${packet[0]?.toString(16)}`,
        { cause },
      );
      events.emit('error', error);
      return;
    }
    try {
      switch (packet[0]) {
        case PACKET_TYPES.DECK:
          events.emit('deckPacket', {
            host: source.address,
            port: source.port,
            packet: CLX_DECK_PACKET.parse(data),
          });
          return;
        case PACKET_TYPES.META:
          events.emit('metadataPacket', {
            host: source.address,
            port: source.port,
            packet: CLX_METADATA_PACKET.parse(data),
          });
          return;
        case PACKET_TYPES.CONTROL:
          events.emit('controlPacket', {
            host: source.address,
            port: source.port,
            packet: CLX_CONTROL_PACKET.parse(data),
          });
          return;
        case PACKET_TYPES.EVENT:
          events.emit('eventPacket', {
            host: source.address,
            port: source.port,
            packet: CLX_EVENT_PACKET.parse(data),
          });
          return;
        case PACKET_TYPES.WAVEFORM_REQUEST:
        case PACKET_TYPES.BINARY:
        case PACKET_TYPES.RESYNC_REQUEST:
          // TODO: Currently not implemented
          return;
      }
      const error = new Error(
        `Received unknown packet with id: ${packet[0]} - ${JSON.stringify(data)}`,
      );
      events.emit('error', error);
    } catch (cause) {
      const error = new Error(
        `Error handling CLX packet for type ${packet[0]?.toString(16)}`,
        { cause },
      );
      events.emit('error', error);
    }
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

  const resync: ClxClient['resync'] = (host) => {
    if (!receiveSocket) {
      throw new Error('Cannot resync before connecting');
    }
    const resyncPacket = Buffer.from([PACKET_TYPES.RESYNC_REQUEST]);
    receiveSocket.send(resyncPacket, CLX_SERVER_PORT, host);
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
    resync,
  };
};
