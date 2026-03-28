import { createSocket, RemoteInfo, Socket } from 'node:dgram';
import EventEmitter from 'node:events';
import {
  ARTNET_PORT,
  TIMECODE_FPS,
  TIMECODE_MODES,
  TimecodeMode,
} from './constants.js';
import {
  ConnectionConfig,
  getNetworkInterfaces,
} from '@arcanewizards/net-utils';

const ARTNET_HEADER = 'Art-Net\0';
const ARTNET_VERSION = 14;

const OP_TIME_CODE = 0x9700;
const DROP_FRAME_NUMERATOR = 30_000;
const DROP_FRAME_DENOMINATOR = 1_001;
const DROP_FRAME_COUNT = 2;
const DROP_FRAME_FRAMES_PER_SECOND = 30;
const DROP_FRAME_FRAMES_PER_MINUTE =
  DROP_FRAME_FRAMES_PER_SECOND * 60 - DROP_FRAME_COUNT;
const DROP_FRAME_FRAMES_PER_10_MINUTES =
  DROP_FRAME_FRAMES_PER_MINUTE * 9 + DROP_FRAME_FRAMES_PER_SECOND * 60;
const DROP_FRAME_FRAMES_PER_HOUR = DROP_FRAME_FRAMES_PER_10_MINUTES * 6;
const DROP_FRAME_FRAMES_PER_24_HOURS = DROP_FRAME_FRAMES_PER_HOUR * 24;
const TIMECODE_MODE_IDS = Object.fromEntries(
  Object.entries(TIMECODE_MODES).map(([mode, id]) => [id, mode]),
) as Record<number, TimecodeMode>;

export type ArtNetTimecode = {
  hours: number;
  minutes: number;
  seconds: number;
  frame: number;
  mode: TimecodeMode;
  timeMillis: number;
};

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

const getDropFrameTimecode = (timeMillis: number): ArtNetTimecode => {
  const totalFrames = Math.floor(
    (timeMillis * DROP_FRAME_NUMERATOR) / (1000 * DROP_FRAME_DENOMINATOR),
  );
  const wrappedFrames =
    ((totalFrames % DROP_FRAME_FRAMES_PER_24_HOURS) +
      DROP_FRAME_FRAMES_PER_24_HOURS) %
    DROP_FRAME_FRAMES_PER_24_HOURS;
  const tenMinuteChunks = Math.floor(
    wrappedFrames / DROP_FRAME_FRAMES_PER_10_MINUTES,
  );
  const remainingFrames = wrappedFrames % DROP_FRAME_FRAMES_PER_10_MINUTES;
  const skippedFrames =
    DROP_FRAME_COUNT * 9 * tenMinuteChunks +
    (remainingFrames > DROP_FRAME_COUNT
      ? DROP_FRAME_COUNT *
        Math.floor(
          (remainingFrames - DROP_FRAME_COUNT) / DROP_FRAME_FRAMES_PER_MINUTE,
        )
      : 0);
  const displayFrameNumber = wrappedFrames + skippedFrames;

  return {
    hours: Math.floor(
      displayFrameNumber / (DROP_FRAME_FRAMES_PER_SECOND * 60 * 60),
    ),
    minutes:
      Math.floor(displayFrameNumber / (DROP_FRAME_FRAMES_PER_SECOND * 60)) % 60,
    seconds: Math.floor(displayFrameNumber / DROP_FRAME_FRAMES_PER_SECOND) % 60,
    frame: displayFrameNumber % DROP_FRAME_FRAMES_PER_SECOND,
    mode: 'DF',
    timeMillis,
  };
};

const getTimecodeFromMillis = (
  mode: TimecodeMode,
  timeMillis: number,
): ArtNetTimecode => {
  if (mode === 'DF') {
    return getDropFrameTimecode(timeMillis);
  }

  return {
    hours: Math.floor(timeMillis / 3600000),
    minutes: Math.floor((timeMillis % 3600000) / 60000),
    seconds: Math.floor((timeMillis % 60000) / 1000),
    frame: Math.floor(((timeMillis % 1000) / 1000) * TIMECODE_FPS[mode]),
    mode,
    timeMillis,
  };
};

const getTimeMillisFromTimecode = (
  timecode: Omit<ArtNetTimecode, 'timeMillis'>,
): number => {
  const { hours, minutes, seconds, frame, mode } = timecode;
  if (mode === 'DF') {
    const totalMinutes = hours * 60 + minutes;
    const droppedFrames =
      DROP_FRAME_COUNT * (totalMinutes - Math.floor(totalMinutes / 10));
    const displayFrameNumber =
      (hours * 60 * 60 + minutes * 60 + seconds) *
        DROP_FRAME_FRAMES_PER_SECOND +
      frame;
    const totalFrames = displayFrameNumber - droppedFrames;
    return (totalFrames * 1000 * DROP_FRAME_DENOMINATOR) / DROP_FRAME_NUMERATOR;
  }

  return (
    (hours * 60 * 60 + minutes * 60 + seconds) * 1000 +
    (frame * 1000) / TIMECODE_FPS[mode]
  );
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
    timeMillis: getTimeMillisFromTimecode({
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

export type ArtNet = {
  connect: () => Promise<void>;
  sendTimecode: (mode: TimecodeMode, timeMillis: number) => Promise<void>;
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
    const bindAddress = iface.internal ? iface.address : iface.broadcastAddress;
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

  const sendTimecode: ArtNet['sendTimecode'] = (mode, timeMillis) => {
    if (timeMillis < 0) {
      // Ignore negative timecodes, as they don't exist on ArtNet
      return Promise.resolve();
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
            resolve();
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
    sendTimecode,
    on,
    addListener,
    removeListener,
    destroy,
  };
};
