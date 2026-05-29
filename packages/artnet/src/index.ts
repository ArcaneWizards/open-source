import { createSocket, RemoteInfo, Socket } from 'node:dgram';
import EventEmitter from 'node:events';
import { ARTNET_PORT, TIMECODE_MODES } from './constants.js';
import {
  type ConnectionConfig,
  getNetworkInterfaces,
} from '@arcanewizards/net-utils';
import {
  getTimecodeFromMillis,
  getMillisFromTimecode,
  SMPTE_TIMECODE_FPS,
  type SMPTETimecodeFrame,
  type SMPTETimecodeMode,
} from '@arcanewizards/smpte';

const ARTNET_HEADER = 'Art-Net\0';
const ARTNET_VERSION = 14;

const OP_TIME_CODE = 0x9700;
const TIMECODE_MODE_IDS = Object.fromEntries(
  Object.entries(TIMECODE_MODES).map(([mode, id]) => [id, mode]),
) as Record<number, SMPTETimecodeMode>;

export type ArtNetTimecode = SMPTETimecodeFrame;

export type ArtNetTimecodeEvent = ArtNetTimecode & {
  host: string;
  port: number;
};

export type ArtNetEventMap = {
  destroy: [];
  timecode: [ArtNetTimecodeEvent];
  error: [Error];
};

const bindSocket = (
  socket: Socket,
  port: number,
  address?: string,
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const onError = (error: Error) => {
      socket.removeListener('error', onError);
      reject(error);
    };
    socket.once('error', onError);

    const onBound = () => {
      socket.removeListener('error', onError);
      resolve();
    };

    if (address) {
      socket.bind(port, address, onBound);
    } else {
      socket.bind(port, onBound);
    }
  });
};

const parseTimecodePacket = (
  packet: Buffer,
  source: RemoteInfo,
): ArtNetTimecodeEvent | null => {
  if (packet.length < 19) {
    return null;
  }
  if (packet.subarray(0, 8).toString('ascii') !== ARTNET_HEADER) {
    return null;
  }
  if (packet.readUInt16LE(8) !== OP_TIME_CODE) {
    return null;
  }

  const mode = TIMECODE_MODE_IDS[packet.readUInt8(18)];
  if (!mode) {
    return null;
  }

  const hours = packet.readUInt8(17);
  const minutes = packet.readUInt8(16);
  const seconds = packet.readUInt8(15);
  const frame = packet.readUInt8(14);

  return {
    hours,
    minutes,
    seconds,
    frame,
    mode,
    timeMillis: getMillisFromTimecode({
      hours,
      minutes,
      seconds,
      frame,
      mode,
    }),
    host: source.address,
    port: source.port,
  };
};

export type FrameTimingResult = {
  /**
   * The time in milliseconds where the next frame will occur after the sent timecode.
   * This can be used to schedule the next timecode update for smoother updates when sending timecodes in a loop.
   */
  nextFrameTimeMillis: number;
};

export type ArtNet = {
  connect: () => Promise<void>;
  getNextFrameTiming: (
    mode: SMPTETimecodeMode,
    timeMillis: number,
  ) => FrameTimingResult;
  sendTimecode: (
    mode: SMPTETimecodeMode,
    timeMillis: number,
  ) => Promise<FrameTimingResult>;
  on<K extends keyof ArtNetEventMap>(
    event: K,
    callback: (...args: ArtNetEventMap[K]) => void,
  ): void;
  addListener<K extends keyof ArtNetEventMap>(
    event: K,
    callback: (...args: ArtNetEventMap[K]) => void,
  ): void;
  removeListener<K extends keyof ArtNetEventMap>(
    event: K,
    callback: (...args: ArtNetEventMap[K]) => void,
  ): void;
  destroy: () => void;
};

type SendSocket = {
  socket: Socket;
  sendHost: string;
};

export type ArtNetConnectionConfig = ConnectionConfig & {
  mode: 'send' | 'receive' | 'both';
};

export const createArtnet = (config: ArtNetConnectionConfig): ArtNet => {
  const events = new EventEmitter<ArtNetEventMap>();

  let sendSocket: SendSocket | null = null;
  let receiveSocket: Socket | null = null;

  let destroyed = false;

  let connectPromise: Promise<void> | null = null;
  let interfacePromise: Promise<
    Awaited<ReturnType<typeof getNetworkInterfaces>>[string]
  > | null = null;

  const on = events.on.bind(events) as ArtNet['on'];
  const addListener = events.addListener.bind(events) as ArtNet['addListener'];
  const removeListener = events.removeListener.bind(
    events,
  ) as ArtNet['removeListener'];

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
    sendSocket?.socket.close();
    receiveSocket?.close();
    sendSocket = null;
    receiveSocket = null;
    connectPromise = null;
  };

  const initializeSendSocket = async () => {
    if (sendSocket) {
      return;
    }

    const socket = createSocket({ type: 'udp4', reuseAddr: true });

    let sendHost: string;
    if (config.type === 'interface') {
      const iface = await getInterface();
      sendHost = iface.broadcastAddress;
      await bindSocket(socket, 0);
      socket.setBroadcast(true);
    } else {
      sendHost = config.host;
    }

    sendSocket = { socket, sendHost };
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
    socket.on('message', (packet, source) => {
      const timecode = parseTimecodePacket(packet, source);
      if (!timecode) {
        return;
      }
      events.emit('timecode', timecode);
    });

    try {
      await bindSocket(socket, config.port ?? ARTNET_PORT, bindAddress);
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

  const connect: ArtNet['connect'] = async () => {
    if (destroyed) {
      throw new Error('Cannot connect destroyed ArtNet instance');
    }
    if (connectPromise) {
      return connectPromise;
    }

    connectPromise = (async () => {
      try {
        if (config.mode !== 'receive') {
          await initializeSendSocket();
        }
        if (config.mode !== 'send') {
          if (config.type === 'interface') {
            await initializeReceiveSocket();
          } else if (events.listenerCount('timecode') > 0) {
            throw new Error(
              'Network interface must be specified when listening for ArtNet packets',
            );
          }
        }
      } catch (error) {
        cleanupSockets();
        throw error instanceof Error ? error : new Error(String(error));
      }
    })();

    return connectPromise;
  };

  const getNextFrameTiming: ArtNet['getNextFrameTiming'] = (
    mode,
    timeMillis,
  ) => {
    const timecode = getTimecodeFromMillis(mode, timeMillis);
    // Increment timecode by one frame
    timecode.frame += 1;
    if (timecode.frame >= SMPTE_TIMECODE_FPS[mode]) {
      timecode.frame = 0;
      timecode.seconds += 1;
      if (timecode.seconds >= 60) {
        timecode.seconds = 0;
        timecode.minutes += 1;
        if (timecode.minutes >= 60) {
          timecode.minutes = 0;
          timecode.hours += 1;
        }
      }
    }
    const nextFrameTimeMillis = getMillisFromTimecode(timecode);
    return { nextFrameTimeMillis };
  };

  const sendTimecode: ArtNet['sendTimecode'] = (mode, timeMillis) => {
    if (timeMillis < 0) {
      // Ignore negative timecodes, as they don't exist on ArtNet
      return Promise.resolve(getNextFrameTiming(mode, timeMillis));
    }
    if (!sendSocket) {
      return Promise.reject(new Error('ArtNet connection has not been opened'));
    }
    if (destroyed) {
      return Promise.reject(
        new Error('Cannot send timecode with destroyed ArtNet instance'),
      );
    }
    const { socket, sendHost } = sendSocket;

    const { hours, minutes, seconds, frame } = getTimecodeFromMillis(
      mode,
      timeMillis,
    );

    const packet = Buffer.alloc(19);
    packet.write(ARTNET_HEADER, 0, 'ascii'); // ID
    packet.writeUInt16LE(OP_TIME_CODE, 8); // OpCode for Timecode
    packet.writeUint16BE(ARTNET_VERSION, 10); // Protocol Version
    packet.writeUInt8(0, 12); // Filler

    packet.writeUInt8(0, 13); // Stream ID (master)
    packet.writeUInt8(frame, 14); // Frames
    packet.writeUInt8(seconds, 15); // Seconds
    packet.writeUInt8(minutes, 16); // Minutes
    packet.writeUInt8(hours, 17); // Hours
    packet.writeUInt8(TIMECODE_MODES[mode], 18); // Timecode Type

    return new Promise((resolve, reject) =>
      socket.send(
        packet,
        0,
        packet.length,
        config.port ?? ARTNET_PORT,
        sendHost,
        (err) => {
          if (err) {
            const error = new Error('Failed to send ArtNet timecode packet', {
              cause: err instanceof Error ? err : new Error(String(err)),
            });
            events.emit('error', error);
            reject(error);
          } else {
            resolve(getNextFrameTiming(mode, timeMillis));
          }
        },
      ),
    );
  };

  const destroy = () => {
    destroyed = true;
    events.emit('destroy');
    cleanupSockets();
  };

  return {
    connect,
    getNextFrameTiming,
    sendTimecode,
    on,
    addListener,
    removeListener,
    destroy,
  };
};
