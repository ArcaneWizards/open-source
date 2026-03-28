import { NetworkPortStatus } from '@arcanewizards/net-utils';
import {
  AnyTCNetDataPacket,
  LayerDataId,
  TCNetDataPacketType,
  TCNetNodeType,
  TCNetPacket,
  TCNetPortNodeOptions,
  TCNetStatusPacket,
  TCNetTimePacket,
} from './protocol.js';

export type NodeState = {
  /**
   * Unique Node ID. When multiple applications/services are running on same IP, this number must be unique.
   *
   * By default, we generate a random node ID on startup.
   *
   * TODO: Detect if there is a conflict,
   * and if so, log a warning and generate a new random node ID.
   */
  nodeId: number;
  /**
   * The time (in milliseconds since Unix epoch) when this node started.
   */
  startTime: number;
  /**
   * Sequence number of packet,
   * each time a packet is sent, this number should be incremented by 1
   * (modulo 256).
   */
  seq: number;
  /**
   * Number of nodes registered by this system,
   * will need to be increased if there are other TCNet apps running on the same system to prevent conflicts.
   */
  nodeCount: number;
};
export type TCNetSinglePortInformation = {
  port: number | { from: number; to: number };
  error?: string;
};

export type TCNetPortUsage =
  | 'broadcastSend'
  | 'broadcastRecv'
  | 'time'
  | 'unicast';

export type TCNetPortInformation = Record<TCNetPortUsage, NetworkPortStatus>;

export type TCNetConnectedNodes = Record<string, TCNetNodeInfo>;

export type TCNetPacketEvent<P extends TCNetPacket> = {
  node: TCNetNodeIdentity;
  packet: P;
  port: TCNetPortUsage;
};

export type TCNetEventMap = {
  destroy: [];
  ready: [];
  'port-state-changed': [TCNetPortInformation];
  'nodes-changed': [TCNetConnectedNodes];
  data: [TCNetPacketEvent<AnyTCNetDataPacket>];
  time: [TCNetPacketEvent<TCNetTimePacket>];
  'node-status': [TCNetPacketEvent<TCNetStatusPacket>];
};

export type TCNetNode = {
  connect: () => void;
  destroy: () => Promise<void>;
  /**
   * Get the ports in-use by this node,
   * these may change depending on availability and configuration.
   */
  getPortInformation: () => TCNetPortInformation;
  on<K extends keyof TCNetEventMap>(
    event: K,
    callback: (...args: TCNetEventMap[K]) => void,
  ): void;
  addListener<K extends keyof TCNetEventMap>(
    event: K,
    callback: (...args: TCNetEventMap[K]) => void,
  ): void;
  removeListener<K extends keyof TCNetEventMap>(
    event: K,
    callback: (...args: TCNetEventMap[K]) => void,
  ): void;
  requestData: (
    node: TCNetNodeIdentity,
    dataType: TCNetDataPacketType,
    layer: LayerDataId,
  ) => Promise<void>;
};

export type TCNetLogger = {
  error: (error: Error) => void;
  warn: (error: Error) => void;
  info: (message: string) => void;
  debug: (message: string) => void;
};

/**
 * Key properties important for uniquely identifying a TCNet node
 */
export type TCNetNodeIdentity = {
  host: string;
  nodeId: number;
};

export type TCNetNodeInfo = TCNetNodeIdentity & {
  nodeListenerPort: number;
  protocolVersion: string;
  nodeName: string;
  nodeType: TCNetNodeType;
  nodeOptions: TCNetPortNodeOptions;
  vendorName: string;
  appName: string;
  appVersion: string;
};
