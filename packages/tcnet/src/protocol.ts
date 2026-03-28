import { TCNetError, TCNetProtocolError } from './errors.js';

/**
 * Branded Layer ID as provided / required in TCNet Data Packets.
 *
 * Allows for type-checking to avoid confusion between
 * layer indices used in status packets and layer IDs used in data packets,
 * which are not necessarily the same.
 *
 * Example: 1=LAYER1, 2=LAYER2, 3=LAYER3, 4=LAYER4, 5=LAYER A, 6=LAYER B, 7=MASTER OUT, 8=RESERVED
 */
export type LayerDataId = number & {
  __brand: 'LayerDataId';
};

export const TCNET_LAYER_COUNT = 8;

const TCNET_LAYER_STATE_IDS = Object.freeze({
  IDLE: 0,
  /**
   * Not in spec, but seems to be what's observed.
   */
  LOADING: 2,
  PLAYING: 3,
  LOOPING: 4,
  PAUSED: 5,
  STOPPED: 6,
  CUEDOWN: 7,
  PLATTERDOWN: 8,
  FFWD: 9,
  FFRV: 10,
  HOLD: 11,
  /**
   * Not in spec, but seems to be what's observed.
   */
  END: 17,
  /**
   * TODO: determine what this means, seems to be disconnected state?
   */
  UNKNOWN: 255,
});

export type TCNetLayerState = keyof typeof TCNET_LAYER_STATE_IDS;

const TCNET_LAYER_STATES = Object.freeze(
  Object.fromEntries(
    Object.entries(TCNET_LAYER_STATE_IDS).map(([key, value]) => [
      value,
      key as unknown as TCNetLayerState,
    ]),
  ) as Record<number, TCNetLayerState>,
);

export const getTcNetLayerState = (id: number): TCNetLayerState => {
  const state = TCNET_LAYER_STATES[id];
  if (!state) {
    throw new TCNetProtocolError(`Unknown TCNet layer state: ${id}`);
  }
  return state;
};

const TCNET_MIXER_TYPE_IDS = Object.freeze({
  STANDARD: 0,
  EXTENDED: 2,
});

export type TCNetMixerType = keyof typeof TCNET_MIXER_TYPE_IDS;

const TCNET_MIXER_TYPES = Object.freeze(
  Object.fromEntries(
    Object.entries(TCNET_MIXER_TYPE_IDS).map(([key, value]) => [
      value,
      key as unknown as TCNetMixerType,
    ]),
  ) as Record<number, TCNetMixerType>,
);

export const getTcNetMixerType = (id: number): TCNetMixerType => {
  const type = TCNET_MIXER_TYPES[id];
  if (!type) {
    throw new TCNetProtocolError(`Unknown TCNet mixer type: ${id}`);
  }
  return type;
};

const TCNET_MESSAGE_TYPE_IDS = Object.freeze({
  OPT_IN: 2,
  OPT_OUT: 3,
  STATUS: 5,
  TIME_SYNC: 10,
  ERROR: 13,
  REQUEST: 20,
  APPLICATION_SPECIFIC_DATA_1: 30,
  CONTROL: 101,
  TEXT_DATA: 128,
  KEYBOARD_DATA: 132,
  DATA: 200,
  FILE: 204,
  APPLICATION_SPECIFIC_DATA_2: 213,
  TIME: 254,
});

export type TCNetMessageType = keyof typeof TCNET_MESSAGE_TYPE_IDS;

const TCNET_MESSAGE_TYPES = Object.freeze(
  Object.fromEntries(
    Object.entries(TCNET_MESSAGE_TYPE_IDS).map(([key, value]) => [value, key]),
  ) as Record<number, TCNetMessageType>,
);

export const getTcNetMessageType = (id: number): TCNetMessageType => {
  const type = TCNET_MESSAGE_TYPES[id];
  if (!type) {
    throw new TCNetProtocolError(`Unknown TCNet message type: ${id}`);
  }
  return type;
};

const TCNET_DATA_PACKET_TYPE_IDS = Object.freeze({
  METRICS_DATA: 2,
  METADATA: 4,
  BEAT_GRID_DATA: 8,
  CUE_DATA: 12,
  SMALL_WAVEFORM: 16,
  BIG_WAVEFORM: 32,
  MIXER_DATA: 150,
});

export type TCNetDataPacketType = keyof typeof TCNET_DATA_PACKET_TYPE_IDS;

const TCNET_DATA_PACKET_TYPES = Object.freeze(
  Object.fromEntries(
    Object.entries(TCNET_DATA_PACKET_TYPE_IDS).map(([key, value]) => [
      value,
      key as unknown as TCNetDataPacketType,
    ]),
  ) as Record<number, TCNetDataPacketType>,
);

export const getTcNetDataPacketType = (id: number): TCNetDataPacketType => {
  const type = TCNET_DATA_PACKET_TYPES[id];
  if (!type) {
    throw new TCNetProtocolError(`Unknown TCNet data packet type: ${id}`);
  }
  return type;
};

const TCNET_NODE_TYPE_IDS = Object.freeze({
  AUTO: 0x1,
  MASTER: 0x2,
  SLAVE: 0x4,
  REPEATER: 0x8,
});

export type TCNetNodeType = keyof typeof TCNET_NODE_TYPE_IDS;

const TCNET_NODE_TYPES = Object.freeze(
  Object.fromEntries(
    Object.entries(TCNET_NODE_TYPE_IDS).map(([key, value]) => [value, key]),
  ) as Record<number, TCNetNodeType>,
);

export const getTcNetNodeType = (id: number): TCNetNodeType => {
  const type = TCNET_NODE_TYPES[id];
  if (!type) {
    throw new TCNetProtocolError(`Unknown TCNet node type: ${id}`);
  }
  return type;
};

const TCNET_PORT_NODE_OPTION_FLAGS = Object.freeze({
  NEED_AUTHENTICATION: 0x1,
  /**
   * Listens to TCNet Control Messages
   */
  SUPPORTS_TCNCM: 0x2,
  /**
   * Listens to TCNet Application Specific Data Packets
   */
  SUPPORTS_TCNASDP: 0x4,
  /**
   * Do not disturb/Sleeping. Node will request data itself if needed to avoid traffic
   */
  DO_NOT_DISTURB: 0x8,
});

export type TCNetPortNodeOption = keyof typeof TCNET_PORT_NODE_OPTION_FLAGS;

export type TCNetPortNodeOptions = Partial<
  Record<TCNetPortNodeOption, true | undefined>
>;

export const parseTcNetPortNodeOptions = (
  flags: number,
): TCNetPortNodeOptions => {
  return Object.fromEntries(
    Object.entries(TCNET_PORT_NODE_OPTION_FLAGS).map(([key, flag]) => [
      key,
      (flags & flag) !== 0 ? (true as const) : undefined,
    ]),
  ) as TCNetPortNodeOptions;
};

export const generateTcNetPortNodeOptionsFlags = (
  options: TCNetPortNodeOptions,
): number => {
  let flags = 0;
  for (const [option, value] of Object.entries(options)) {
    if (value) {
      const flag = TCNET_PORT_NODE_OPTION_FLAGS[option as TCNetPortNodeOption];
      flags |= flag;
    }
  }
  return flags;
};

const TCNET_LAYER_TC_STATE_IDS = Object.freeze({
  STOPPED: 0,
  RUNNING: 1,
  FORCE_RESYNC: 2,
});

export type TCNetLayerTCState = keyof typeof TCNET_LAYER_TC_STATE_IDS;

const TCNET_LAYER_TC_STATES = Object.freeze(
  Object.fromEntries(
    Object.entries(TCNET_LAYER_TC_STATE_IDS).map(([key, value]) => [
      value,
      key as unknown as TCNetLayerTCState,
    ]),
  ) as Record<number, TCNetLayerTCState>,
);

export const getTcNetLayerTCState = (id: number): TCNetLayerTCState => {
  const state = TCNET_LAYER_TC_STATES[id];
  if (!state) {
    throw new TCNetProtocolError(`Unknown TCNet layer timecode state: ${id}`);
  }
  return state;
};

export const MAX_NODE_ID = 256 * 256 - 1;

export const MGMT_HEADER_VERSION = 3;
export const MGMT_HEADER_MINOR_VERSION = 5;
const MGMT_MAGIC_HEADER = 'TCN';

export type TCNetManagementHeader = {
  /**
   * Unique Node ID. When multiple applications/services are running on same IP, this number must be unique
   */
  nodeId: number;
  protocolVersionMajor: number;
  protocolVersionMinor: number;
  messageType: TCNetMessageType;
  /**
   * GW Code of software/machine/source that sends packet.
   */
  nodeName: Buffer;
  /**
   * Sequence number of packet
   */
  seq: number;
  nodeType: TCNetNodeType;
  nodeOptions: TCNetPortNodeOptions;
  timestamp: number;
};

export type TCNetManagementHeaderWithoutMessageType = Omit<
  TCNetManagementHeader,
  'messageType'
>;

export const writeManagementHeader = (
  buffer: Buffer,
  header: TCNetManagementHeaderWithoutMessageType,
  messageType: TCNetMessageType,
): void => {
  buffer.writeUInt16LE(header.nodeId, 0);
  buffer.writeUInt8(header.protocolVersionMajor, 2);
  buffer.writeUInt8(header.protocolVersionMinor, 3);
  buffer.write(MGMT_MAGIC_HEADER, 4, 'ascii');
  buffer.writeUInt8(TCNET_MESSAGE_TYPE_IDS[messageType], 7);
  header.nodeName.copy(buffer, 8, 0, 8);
  buffer.writeUInt8(header.seq, 16);
  buffer.writeUInt8(TCNET_NODE_TYPE_IDS[header.nodeType], 17);
  buffer.writeUInt16LE(
    generateTcNetPortNodeOptionsFlags(header.nodeOptions),
    18,
  );
  buffer.writeUInt32LE(header.timestamp, 20);
};

export const parseManagementHeader = (
  buffer: Buffer,
): TCNetManagementHeader => {
  const magicHeader = buffer.toString('ascii', 4, 7);
  if (magicHeader !== MGMT_MAGIC_HEADER) {
    throw new TCNetProtocolError(
      `Invalid management header magic: ${magicHeader}`,
    );
  }
  return {
    nodeId: buffer.readUInt16LE(0),
    protocolVersionMajor: buffer.readUInt8(2),
    protocolVersionMinor: buffer.readUInt8(3),
    messageType: getTcNetMessageType(buffer.readUInt8(7)),
    nodeName: buffer.subarray(8, 16),
    seq: buffer.readUInt8(16),
    nodeType: getTcNetNodeType(buffer.readUInt8(17)),
    nodeOptions: parseTcNetPortNodeOptions(buffer.readUInt16LE(18)),
    timestamp: buffer.readUInt32LE(20),
  };
};

type TCNetBasePacket<T extends TCNetMessageType> = {
  header: TCNetManagementHeaderWithoutMessageType;
  type: T;
};

export type TCNetOptInPacket = TCNetBasePacket<'OPT_IN'> & {
  /**
   * Number of nodes registered by system
   */
  nodeCount: number;
  /**
   * Listener port of node (Used to receive unicast messages)
   */
  nodeListenerPort: number;
  uptime: number;
  vendorName: Buffer;
  applicationName: Buffer;
  applicationVersion: Buffer;
};

export const writeOptInPacket = (
  data: Omit<TCNetOptInPacket, 'type'>,
): Buffer => {
  const buffer = Buffer.alloc(68);
  writeManagementHeader(buffer, data.header, 'OPT_IN');

  buffer.writeUInt16LE(data.nodeCount, 24);
  buffer.writeUInt16LE(data.nodeListenerPort, 26);
  buffer.writeUInt16LE(data.uptime, 28);
  data.vendorName.copy(buffer, 32, 0, 16);
  data.applicationName.copy(buffer, 48, 0, 16);
  data.applicationVersion.copy(buffer, 64, 0, 3);

  return buffer;
};

const parseOptInPacket = (
  header: TCNetManagementHeader,
  buffer: Buffer,
): TCNetOptInPacket => {
  return {
    header,
    type: 'OPT_IN',
    nodeCount: buffer.readUInt16LE(24),
    nodeListenerPort: buffer.readUInt16LE(26),
    uptime: buffer.readUInt16LE(28),
    vendorName: buffer.subarray(32, 48),
    applicationName: buffer.subarray(48, 64),
    applicationVersion: buffer.subarray(64, 67),
  };
};

export type TCNetOptOutPacket = TCNetBasePacket<'OPT_OUT'> &
  Pick<TCNetOptInPacket, 'nodeCount' | 'nodeListenerPort'>;

export const writeOptOutPacket = (
  data: Omit<TCNetOptOutPacket, 'type'>,
): Buffer => {
  const buffer = Buffer.alloc(28);
  writeManagementHeader(buffer, data.header, 'OPT_OUT');

  buffer.writeUInt16LE(data.nodeCount, 24);
  buffer.writeUInt16LE(data.nodeListenerPort, 26);

  return buffer;
};

const parseOptOutPacket = (
  header: TCNetManagementHeader,
  buffer: Buffer,
): TCNetOptOutPacket => {
  return {
    header,
    type: 'OPT_OUT',
    nodeCount: buffer.readUInt16LE(24),
    nodeListenerPort: buffer.readUInt16LE(26),
  };
};

export type TCNetStatusPacketLayer = {
  source: number;
  status: TCNetLayerState;
  trackId: number;
  name: string;
};

export type TCNetStatusPacket = TCNetBasePacket<'STATUS'> & {
  nodeCount: number;
  nodeListenerPort: number;
  smpteMode: number;
  /**
   * Auto Master mode on node (0=Disabled, 1=HTP Master, 2=Link Master)
   */
  autoMasterMode: number;
  layers: TCNetStatusPacketLayer[];
};

const parseStatusPacket = (
  header: TCNetManagementHeader,
  buffer: Buffer,
): TCNetStatusPacket => {
  const nodeCount = buffer.readUInt16LE(24);
  const nodeListenerPort = buffer.readUInt16LE(26);
  const smpteMode = buffer.readUInt8(83);
  const autoMasterMode = buffer.readUInt8(84);
  const layers = new Array(8) as TCNetStatusPacketLayer[];
  for (let n = 0; n < 8; n++) {
    layers[n] = {
      source: buffer.readUInt8(34 + n),
      status: getTcNetLayerState(buffer.readUInt8(42 + n)),
      trackId: buffer.readUInt32LE(50 + n * 4),
      name: buffer
        .slice(172 + n * 16, 172 + (n + 1) * 16)
        .toString('ascii')
        .replace(/\0/g, ''),
    };
  }
  return {
    header,
    type: 'STATUS',
    nodeCount,
    nodeListenerPort,
    smpteMode,
    autoMasterMode,
    layers,
  };
};

export type TCNetRequestPacket = TCNetBasePacket<'REQUEST'> & {
  dataType: TCNetDataPacketType;
  layer: LayerDataId;
};

export const writeRequestPacket = (
  data: Omit<TCNetRequestPacket, 'type'>,
): Buffer => {
  const buffer = Buffer.alloc(26);
  writeManagementHeader(buffer, data.header, 'REQUEST');

  buffer.writeUInt8(TCNET_DATA_PACKET_TYPE_IDS[data.dataType], 24);
  buffer.writeUInt8(data.layer, 25);

  return buffer;
};

export type TCNetApplicationSpecificData1Packet =
  TCNetBasePacket<'APPLICATION_SPECIFIC_DATA_1'>;

const parseApplicationSpecificData1Packet = (
  header: TCNetManagementHeader,
  _buffer: Buffer,
): TCNetApplicationSpecificData1Packet => {
  // TODO: Implement this when there's a use-case
  return {
    header,
    type: 'APPLICATION_SPECIFIC_DATA_1',
  };
};

export type TCNetDataPacket<D extends TCNetDataPacketType> =
  TCNetBasePacket<'DATA'> & {
    dataType: D;
  };

export type TCNetMetricsDataPacket = TCNetDataPacket<'METRICS_DATA'> & {
  /**
   * Layer number of layer sending data.
   *
   * see {@link LayerDataId}
   */
  layer: LayerDataId;
  /** Play head status of layer */
  state: TCNetLayerState;
  /** Sync master status of layer. Example use of this status is to follow the current active layer and allows auto cue to this layer.  */
  syncMaster: number;
  /**
   * Range 1-4
   */
  beatMarker: number;
  trackLengthMillis: number;
  /**
   * Play head position of layer
   */
  currentPositionMillis: number;
  /**
   * Play head speed on layer
   *
   * 0~65536 (Where 32768 = 100% speed, 0 = 0% Speed, 65536=200% speed)
   */
  speed: number;
  beatNumber: number;
  /** Play head BPM speed of layer. Example: 0.01~999.99  */
  bpm: number;
  /**
   * Play head speed bend value of layer. (Used for live adjust.)
   * Example: 0~65536 (Where 32768 = 100% speed, 0 = 0% Speed, 65536=200% speed)
   */
  pitchBend: number;
  /**
   * Track ID number of the track that is loaded on layer. This is usually the database ID number. (Used to reflect track selection changes)
   */
  trackId: number;
};

const parseMetricsDataPacket = (
  header: TCNetManagementHeader,
  buffer: Buffer,
): TCNetMetricsDataPacket => {
  return {
    header,
    type: 'DATA',
    dataType: 'METRICS_DATA',
    layer: buffer.readUInt8(25) as LayerDataId,
    state: getTcNetLayerState(buffer.readUInt8(27)),
    syncMaster: buffer.readUInt8(29),
    beatMarker: buffer.readUInt8(31),
    trackLengthMillis: buffer.readUInt32LE(32),
    currentPositionMillis: buffer.readUInt32LE(36),
    speed: buffer.readUInt32LE(40),
    beatNumber: buffer.readUInt32LE(57),
    bpm: buffer.readUInt32LE(112),
    pitchBend: buffer.readInt16LE(116),
    trackId: buffer.readUInt32LE(118),
  };
};

export type TCNetMetadataDataPacket = TCNetDataPacket<'METADATA'> & {
  /**
   * Layer number of layer sending data.
   *
   * see {@link LayerDataId}
   */
  layer: LayerDataId;
  trackArtist: string;
  trackTitle: string;
  trackKey: number;
  /**
   * @deprecated Note that ShowKontrol seems to not consistently send the correct
   * trackID here, and you need to rely on the trackID from the status packet instead.
   */
  trackId: number;
};

const parseMetadataDataPacket = (
  header: TCNetManagementHeader,
  buffer: Buffer,
): TCNetMetadataDataPacket => {
  const encoding: BufferEncoding =
    header.protocolVersionMajor >= 3 && header.protocolVersionMinor >= 5
      ? 'utf16le'
      : 'utf-8';
  return {
    header,
    type: 'DATA',
    dataType: 'METADATA',
    layer: buffer.readUInt8(25) as LayerDataId,
    trackArtist: buffer.toString(encoding, 29, 285).replace(/\0/g, ''),
    trackTitle: buffer.toString(encoding, 285, 541).replace(/\0/g, ''),
    trackKey: buffer.readUInt16LE(541),
    trackId: buffer.readUInt32LE(543),
  };
};

export type TCNetMixerDataPacket = TCNetDataPacket<'MIXER_DATA'> & {
  mixerId: number;
  mixerType: TCNetMixerType;
  mixerName: string;
  micEqHi: number;
  micEqLow: number;
  masterAudioLevel: number;
  masterFaderLevel: number;
  // TODO: Implement the rest, however most of it does not seem to be
  // implemented by The Bridge or ShowKontrol
};

const parseMixerDataPacket = (
  header: TCNetManagementHeader,
  buffer: Buffer,
): TCNetMixerDataPacket => {
  return {
    header,
    type: 'DATA',
    dataType: 'MIXER_DATA',
    mixerId: buffer.readUInt8(25),
    mixerType: getTcNetMixerType(buffer.readUInt8(26)),
    mixerName: buffer.toString('ascii', 29, 45).replace(/\0/g, ''),
    micEqHi: buffer.readUInt8(59),
    micEqLow: buffer.readUInt8(60),
    masterAudioLevel: buffer.readUInt8(61),
    masterFaderLevel: buffer.readUInt8(62),
  };
};

export type AnyTCNetDataPacket =
  | TCNetMetricsDataPacket
  | TCNetMetadataDataPacket
  | TCNetMixerDataPacket;

const parseDataPacket = (
  header: TCNetManagementHeader,
  buffer: Buffer,
): AnyTCNetDataPacket => {
  const dataType = getTcNetDataPacketType(buffer.readUInt8(24));

  if (dataType === 'METRICS_DATA') {
    return parseMetricsDataPacket(header, buffer);
  } else if (dataType === 'MIXER_DATA') {
    return parseMixerDataPacket(header, buffer);
  } else if (dataType === 'METADATA') {
    return parseMetadataDataPacket(header, buffer);
  }

  throw new TCNetError(`Library support for ${dataType} not implemented`);
};

/**
 * 24=24FPS (FILM)
 * 25=25FPS (EBU)
 * 29=29.7FPS (DF)
 * 30=30FPS (NTSC)
 */
export type SMPTEFramerate = 24 | 25 | 29 | 30;

const parseSMPTEFramerate = (framerate: number): SMPTEFramerate => {
  if (
    framerate === 24 ||
    framerate === 25 ||
    framerate === 29 ||
    framerate === 30
  ) {
    return framerate;
  }
  throw new TCNetProtocolError(`Unknown SMPTE framerate: ${framerate}`);
};

export type TCNetTimePacketLayer = {
  currentTimeMillis: number;
  totalTimeMillis: number;
  /**
   * 0 = unknown, 1-4 = beat position in current bar
   */
  beatMarker: number;
  state: TCNetLayerState;
  smpte: {
    /**
     * See {@link SMPTEFramerate}
     */
    mode: null | SMPTEFramerate;
    state: TCNetLayerTCState;
    hours: number;
    minutes: number;
    seconds: number;
    frames: number;
  };
  /**
   * OnAir State & Fader Position (0-255) (Example: 0=Not on Air, >=1 =On Air)
   *
   * Note: ShowKontrol does not seem to include the actual mixer value here,
   * and only sends 0 or 1.
   */
  onAir: number;
};

type TCNetTimePacketLayers = [
  TCNetTimePacketLayer,
  TCNetTimePacketLayer,
  TCNetTimePacketLayer,
  TCNetTimePacketLayer,
  TCNetTimePacketLayer,
  TCNetTimePacketLayer,
  TCNetTimePacketLayer,
  TCNetTimePacketLayer,
];

export type TCNetTimePacket = TCNetBasePacket<'TIME'> & {
  /**
   * All layers:
   * - 0 - L1
   * - 1 - L2
   * - 2 - L3
   * - 3 - L4
   * - 4 - LA
   * - 5 - LB
   * - 6 - MASTER
   * - 7 - LC
   */
  layers: TCNetTimePacketLayers;
  generalSmpteFramerate: SMPTEFramerate;
};

const parseTimePacket = (
  header: TCNetManagementHeader,
  buffer: Buffer,
): TCNetTimePacket => {
  const layers = new Array(8) as TCNetTimePacketLayers;
  for (let i = 0; i < 8; i++) {
    const smpteMode = buffer.readUInt8(106 + i * 6);
    layers[i] = {
      currentTimeMillis: buffer.readUInt32LE(24 + i * 4),
      totalTimeMillis: buffer.readUInt32LE(56 + i * 4),
      beatMarker: buffer.readUInt8(88 + i),
      state: getTcNetLayerState(buffer.readUInt8(96 + i)),
      smpte: {
        /**
         * Spec says 0 here, but ShowKontrol seems to also be sending 1.
         */
        mode:
          smpteMode === 0 || smpteMode === 1
            ? null
            : parseSMPTEFramerate(smpteMode),
        state: getTcNetLayerTCState(buffer.readUInt8(107 + i * 6)),
        hours: buffer.readUInt8(108 + i * 6),
        minutes: buffer.readUInt8(109 + i * 6),
        seconds: buffer.readUInt8(110 + i * 6),
        frames: buffer.readUInt8(111 + i * 6),
      },
      onAir: buffer.length > 154 ? buffer.readUInt8(154 + i) : 255,
    };
  }
  return {
    header,
    type: 'TIME',
    layers,
    generalSmpteFramerate: parseSMPTEFramerate(buffer.readUInt8(105)),
  };
};

export type TCNetPacket =
  | TCNetOptInPacket
  | TCNetOptOutPacket
  | TCNetStatusPacket
  | TCNetApplicationSpecificData1Packet
  | TCNetTimePacket
  | AnyTCNetDataPacket;

export const parsePacket = (buffer: Buffer): TCNetPacket => {
  const header = parseManagementHeader(buffer);

  switch (header.messageType) {
    case 'OPT_IN':
      return parseOptInPacket(header, buffer);
    case 'OPT_OUT':
      return parseOptOutPacket(header, buffer);
    case 'STATUS':
      return parseStatusPacket(header, buffer);
    case 'DATA':
      return parseDataPacket(header, buffer);
    case 'APPLICATION_SPECIFIC_DATA_1':
      return parseApplicationSpecificData1Packet(header, buffer);
    case 'TIME':
      return parseTimePacket(header, buffer);
    default:
      throw new TCNetError(
        `Library support for ${header.messageType} not implemented`,
      );
  }
};
