import { createSocket, RemoteInfo, Socket } from 'node:dgram';
import EventEmitter from 'node:events';
import {
  getNetworkInterfaces,
  NetworkInterface,
  NetworkPortStatus,
} from '@arcanewizards/net-utils';
import {
  TCNetConfigurationError,
  TCNetError,
  TCNetInitializationError,
  TCNetNetworkError,
  TCNetProtocolError,
} from './errors.js';
import { promisify } from 'node:util';
import {
  TCNetManagementHeaderWithoutMessageType,
  MAX_NODE_ID,
  MGMT_HEADER_MINOR_VERSION,
  MGMT_HEADER_VERSION,
  writeOptInPacket,
  writeOptOutPacket,
  parsePacket,
  TCNetPacket,
  TCNetOptInPacket,
  TCNetOptOutPacket,
  writeRequestPacket,
} from './protocol.js';
import {
  AppInfo,
  generateProtocolStrings,
  generateApplicationVersion,
  parseApplicationVersion,
  getNodeDescription,
  calculateUniqueNodeId,
} from './utils.js';
import { isEqual } from 'lodash';
import {
  TCNetEventMap,
  NodeState,
  TCNetLogger,
  TCNetNode,
  TCNetNodeInfo,
  TCNetPortUsage,
  TCNetNodeIdentity,
} from './types.js';

const OPT_IN_INTERVAL = 1000;
const PORT_BROADCAST = 60000;
const PORT_TIME = 60001;
const PORT_UNICAST_MIN = 65023;
const PORT_UNICAST_MAX = 65535;

/**
 * How many opt-in messages need to be missed before we consider a node disconnected
 */
const OPT_IN_TIMEOUT_MULTIPLIER = 3;

type Props = {
  logger: TCNetLogger;
  networkInterface: string;
  nodeName: string;
  vendorName: string;
  appName: string;
  appVersion: string;
};

const bindSocket = (
  socket: Socket,
  port: number,
  address: string,
): Promise<void> => {
  return new Promise((resolve, reject) => {
    socket.once('error', reject);

    // Enable SO_REUSEPORT manually on macOS
    // if (process.platform === 'darwin') {
    //   try {
    //     (socket as any)._handle?.setOption?.(1, 15, 1); // SOL_SOCKET, SO_REUSEPORT, 1
    //   } catch (err) {
    //     console.warn('Failed to set SO_REUSEPORT:', err);
    //   }
    // }

    socket.bind(port, address, () => {
      socket.removeListener('error', reject);
      resolve();
    });
  });
};

type TCNetConnectedNodeInternal = {
  info: TCNetNodeInfo;
  lastSeen: number;
};

export const createTCNetNode = (props: Props): TCNetNode => {
  const { logger } = props;

  const events = new EventEmitter<TCNetEventMap>();

  let iface: NetworkInterface | null = null;

  const sockets: Record<TCNetPortUsage, Socket | null> = {
    broadcastSend: null,
    broadcastRecv: null,
    time: null,
    unicast: null,
  };

  const nodes: Record<string, TCNetConnectedNodeInternal> = {};

  const portInformation: Record<TCNetPortUsage, NetworkPortStatus> = {
    broadcastSend: {
      direction: 'output',
      target: { type: 'interface', interface: props.networkInterface },
      port: PORT_BROADCAST,
      status: 'disabled',
    },
    broadcastRecv: {
      direction: 'input',
      target: { type: 'interface', interface: props.networkInterface },
      port: PORT_BROADCAST,
      status: 'disabled',
    },
    time: {
      direction: 'input',
      target: { type: 'interface', interface: props.networkInterface },
      port: PORT_TIME,
      status: 'disabled',
    },
    unicast: {
      direction: 'both',
      target: { type: 'interface', interface: props.networkInterface },
      port: {
        from: PORT_UNICAST_MIN,
        to: PORT_UNICAST_MAX,
      },
      status: 'disabled',
    },
  };

  const getPortInformation: TCNetNode['getPortInformation'] = () =>
    portInformation;

  const sendPortStateChanged = () => {
    events.emit('port-state-changed', { ...portInformation });
  };

  const closeActiveSockets = async () => {
    await Promise.all(
      (Object.keys(sockets) as TCNetPortUsage[]).map(async (socketKey) => {
        const socket = sockets[socketKey];
        if (socket) {
          await promisify(socket.close.bind(socket))();
          portInformation[socketKey].status = 'disabled';
          sockets[socketKey] = null;
        }
      }),
    );
    sendPortStateChanged();
  };

  let optInInterval: NodeJS.Timeout | null = null;

  let appInfo: AppInfo | null = null;

  const nodeState: NodeState = {
    nodeId: Math.floor(Math.random() * MAX_NODE_ID),
    startTime: Date.now(),
    seq: 0,
    nodeCount: 1,
  };

  const prepareNextHeader = (
    appInfo: AppInfo,
  ): TCNetManagementHeaderWithoutMessageType => {
    const data: TCNetManagementHeaderWithoutMessageType = {
      nodeId: nodeState.nodeId,
      protocolVersionMajor: MGMT_HEADER_VERSION,
      protocolVersionMinor: MGMT_HEADER_MINOR_VERSION,
      nodeName: appInfo.strings.nodeName,
      seq: nodeState.seq,
      nodeType: 'SLAVE',
      nodeOptions: {},
      // TODO: actually generate timestamp
      timestamp: 0,
    };
    // Increment sequence number for next packet
    nodeState.seq = (nodeState.seq + 1) % 256;
    return data;
  };

  const handleBroadcastCallback = (err: Error | null) => {
    if (err) {
      const error = new TCNetNetworkError(
        `Error occurred while sending broadcast packet`,
        err,
      );
      logger.error(error);
      portInformation.broadcastSend.status = 'error';
      portInformation.broadcastSend.errors = [error.message];
      sendPortStateChanged();
    }
  };

  const sendUnicastPacket = async (
    packet: Buffer,
    filter?: (node: TCNetConnectedNodeInternal) => boolean,
  ): Promise<void> => {
    const { unicast } = sockets;
    if (unicast) {
      return Promise.all(
        Object.values(nodes)
          .filter((node) => (filter ? filter(node) : true))
          .map((node) => {
            return new Promise<void>((resolve, reject) => {
              unicast.send(
                packet,
                node.info.nodeListenerPort,
                node.info.host,
                (err: Error | null) => {
                  if (err) {
                    reject(err);
                  } else {
                    resolve();
                  }
                },
              );
            });
          }),
      )
        .then(() => void 0)
        .catch((err) => {
          const error = new TCNetNetworkError(
            `Error occurred while sending unicast packet`,
            err,
          );
          logger.error(error);
          portInformation.unicast.status = 'error';
          portInformation.unicast.errors = [error.message];
          sendPortStateChanged();
        });
    }
  };

  const checkForInactiveNodes = () => {
    let updated = false;
    for (const key of Object.keys(nodes)) {
      const node = nodes[key];
      if (node) {
        if (
          Date.now() - node.lastSeen >
          OPT_IN_INTERVAL * OPT_IN_TIMEOUT_MULTIPLIER
        ) {
          const info = node.info;
          logger.info(
            `TCNet Node Disconnected due to inactivity: ${getNodeDescription(info)}`,
          );
          delete nodes[key];
          updated = true;
        }
      }
    }
    if (updated) {
      broadcastConnectedNodeUpdate();
    }
  };

  const startOptInInterval = () => {
    const sendOptInPacket = () => {
      // Before we send opt-in packets, check for inactive nodes
      checkForInactiveNodes();
      const nodeListenerPort = portInformation.unicast.port;
      if (typeof nodeListenerPort !== 'number' || !appInfo) return;
      const optInPacket = writeOptInPacket({
        header: prepareNextHeader(appInfo),
        nodeCount: nodeState.nodeCount,
        applicationName: appInfo.strings.appName,
        applicationVersion: appInfo.version,
        uptime: ((Date.now() - nodeState.startTime) / 1000) % 43200,
        vendorName: appInfo.strings.vendorName,
        nodeListenerPort,
      });
      if (iface && sockets.broadcastSend) {
        sockets.broadcastSend.send(
          optInPacket,
          PORT_BROADCAST,
          iface.broadcastAddress,
          handleBroadcastCallback,
        );
      }
      sendUnicastPacket(optInPacket);
    };
    if (optInInterval) {
      clearInterval(optInInterval);
    }
    optInInterval = setInterval(sendOptInPacket, OPT_IN_INTERVAL);
    sendOptInPacket();
  };

  const sendOptOutPacket = async () => {
    const nodeListenerPort = portInformation.unicast.port;
    if (typeof nodeListenerPort !== 'number' || !appInfo) return;
    const optOutPacket = writeOptOutPacket({
      header: prepareNextHeader(appInfo),
      nodeCount: nodeState.nodeCount,
      nodeListenerPort,
    });
    await new Promise<void>((resolve, reject) => {
      if (iface && sockets.broadcastSend) {
        sockets.broadcastSend.send(
          optOutPacket,
          PORT_BROADCAST,
          iface.broadcastAddress,
          (err) => {
            if (err) {
              const error = new TCNetNetworkError(
                `Error occurred while sending Opt-Out packet`,
                err,
              );
              logger.error(error);
              portInformation.broadcastSend.status = 'error';
              portInformation.broadcastSend.errors = [error.message];
              sendPortStateChanged();
              reject(error);
            } else {
              resolve();
            }
          },
        );
      }
    });
    await sendUnicastPacket(optOutPacket);
  };

  const handleMessageParsing =
    (handler: (packet: TCNetPacket, rinfo: RemoteInfo) => void) =>
    (msg: Buffer, rinfo: RemoteInfo) => {
      let message: TCNetPacket;
      try {
        message = parsePacket(msg);
      } catch (err) {
        const error = new TCNetProtocolError(
          `Error occurred while parsing message from ${rinfo.address}:${rinfo.port}`,
          err instanceof Error ? err : new Error(String(err)),
        );
        logger.warn(error);
        return;
      }
      try {
        handler(message, rinfo);
      } catch (err) {
        const error = new TCNetError(
          `Internal error occurred handling packet`,
          err instanceof Error ? err : new Error(String(err)),
        );
        logger.error(error);
      }
    };

  const broadcastConnectedNodeUpdate = () => {
    events.emit(
      'nodes-changed',
      Object.fromEntries(Object.entries(nodes).map(([k, v]) => [k, v.info])),
    );
  };

  const handleOptIn = (optIn: TCNetOptInPacket, rinfo: RemoteInfo) => {
    const {
      nodeId,
      protocolVersionMajor,
      protocolVersionMinor,
      nodeName,
      nodeType,
      nodeOptions,
    } = optIn.header;
    const info: TCNetNodeInfo = {
      // Key / Identity Material
      host: rinfo.address,
      nodeId,
      nodeListenerPort: optIn.nodeListenerPort,
      // Other Data
      protocolVersion: `${protocolVersionMajor}.${protocolVersionMinor}`,
      nodeName: nodeName.toString('ascii').replace(/\0/g, ''),
      nodeType: nodeType,
      nodeOptions: nodeOptions,
      vendorName: optIn.vendorName.toString('ascii').replace(/\0/g, ''),
      appName: optIn.applicationName.toString('ascii').replace(/\0/g, ''),
      appVersion: parseApplicationVersion(optIn.applicationVersion),
    };
    if (
      info.host === iface?.address &&
      info.nodeId === nodeState.nodeId &&
      info.nodeListenerPort === portInformation.unicast.port
    ) {
      // Ignore opt-in messages from self
      return;
    }
    const key = calculateUniqueNodeId(info);
    const existingNode = nodes[key];
    if (existingNode && isEqual(existingNode.info, info)) {
      existingNode.lastSeen = Date.now();
      return;
    }
    nodes[key] = {
      info,
      lastSeen: Date.now(),
    };
    if (!existingNode) {
      logger.info(`TCNet Node Connected: ${getNodeDescription(info)}`);
    }
    broadcastConnectedNodeUpdate();
  };

  const handleOptOut = (optOut: TCNetOptOutPacket, rinfo: RemoteInfo) => {
    const key = calculateUniqueNodeId({
      host: rinfo.address,
      nodeId: optOut.header.nodeId,
    });
    if (nodes[key]) {
      const info = nodes[key].info;
      logger.info(`TCNet Node Disconnected: ${getNodeDescription(info)}`);
      delete nodes[key];
      broadcastConnectedNodeUpdate();
    }
  };

  const handleStandardPackets = (
    port: TCNetPortUsage,
    packet: TCNetPacket,
    rinfo: RemoteInfo,
  ) => {
    const node: TCNetNodeIdentity = {
      host: rinfo.address,
      nodeId: packet.header.nodeId,
    };
    if (packet.type === 'OPT_IN') {
      handleOptIn(packet, rinfo);
    } else if (packet.type === 'OPT_OUT') {
      handleOptOut(packet, rinfo);
    } else if (packet.type === 'STATUS') {
      events.emit('node-status', { packet, port, node });
    } else if (packet.type === 'DATA') {
      events.emit('data', { packet, port, node });
    } else if (packet.type === 'APPLICATION_SPECIFIC_DATA_1') {
      // Ignore these packets
    } else {
      throw new TCNetProtocolError(
        `Received unsupported packet type ${packet.type} on ${port} port from ${rinfo.address}:${rinfo.port}`,
      );
    }
  };

  const handleBroadcastMessage = handleMessageParsing((packet, rinfo) =>
    handleStandardPackets('broadcastRecv', packet, rinfo),
  );

  const handleTimeMessage = handleMessageParsing((packet, rinfo) => {
    if (packet.type === 'TIME') {
      const node: TCNetNodeIdentity = {
        host: rinfo.address,
        nodeId: packet.header.nodeId,
      };
      events.emit('time', { packet, port: 'time', node });
    } else {
      throw new TCNetProtocolError(
        `Received unsupported packet type ${packet.type} on time port from ${rinfo.address}:${rinfo.port}`,
      );
    }
  });

  const handleUnicastMessage = handleMessageParsing((packet, rinfo) =>
    handleStandardPackets('unicast', packet, rinfo),
  );

  const connect = async () => {
    try {
      appInfo = {
        strings: generateProtocolStrings({
          nodeName: props.nodeName,
          vendorName: props.vendorName,
          appName: props.appName,
        }),
        version: generateApplicationVersion(props.appVersion),
      };

      // Get broadcast address for interface
      const interfaces = await getNetworkInterfaces();

      iface = interfaces[props.networkInterface] ?? null;
      if (!iface) {
        Object.values(portInformation).forEach((info) => {
          info.status = 'error';
          info.errors = [
            `Network interface ${props.networkInterface} not found`,
          ];
        });
        throw new TCNetConfigurationError(
          `Network interface ${props.networkInterface} not found`,
        );
      }

      portInformation.broadcastSend.status = 'connecting';
      const broadcastSendPort = createSocket(
        {
          type: 'udp4',
          reuseAddr: true,
          reusePort: process.platform !== 'darwin',
        },
        handleBroadcastMessage,
      );
      sockets.broadcastSend = broadcastSendPort;
      try {
        await bindSocket(broadcastSendPort, PORT_BROADCAST, iface.address);
      } catch (err) {
        const error = new TCNetInitializationError(
          `Failed to bind broadcast port ${PORT_BROADCAST} on interface ${props.networkInterface}`,
          err instanceof Error ? err : new Error(String(err)),
        );
        portInformation.broadcastSend.status = 'error';
        portInformation.broadcastSend.errors = [error.message];
        throw error;
      }
      broadcastSendPort.setBroadcast(true);
      portInformation.broadcastSend.status = 'active';

      // Send update for newly bound port
      sendPortStateChanged();

      portInformation.broadcastRecv.status = 'connecting';
      const broadcastRecvPort = createSocket(
        {
          type: 'udp4',
          reuseAddr: true,
          reusePort: process.platform !== 'darwin',
        },
        handleBroadcastMessage,
      );
      sockets.broadcastRecv = broadcastRecvPort;
      try {
        await bindSocket(
          broadcastRecvPort,
          PORT_BROADCAST,
          iface.broadcastAddress,
        );
      } catch (err) {
        const error = new TCNetInitializationError(
          `Failed to bind broadcast port ${PORT_BROADCAST} on interface ${props.networkInterface}`,
          err instanceof Error ? err : new Error(String(err)),
        );
        portInformation.broadcastRecv.status = 'error';
        portInformation.broadcastRecv.errors = [error.message];
        throw error;
      }
      broadcastRecvPort.setBroadcast(true);
      portInformation.broadcastRecv.status = 'active';

      // Send update for newly bound port
      sendPortStateChanged();

      portInformation.time.status = 'connecting';
      const timePort = createSocket(
        {
          type: 'udp4',
          reuseAddr: true,
          reusePort: process.platform !== 'darwin',
        },
        handleTimeMessage,
      );
      sockets.time = timePort;
      try {
        await bindSocket(timePort, PORT_TIME, iface.broadcastAddress);
      } catch (err) {
        const error = new TCNetInitializationError(
          `Failed to bind time port ${PORT_TIME} on interface ${props.networkInterface}`,
          err instanceof Error ? err : new Error(String(err)),
        );
        portInformation.time.status = 'error';
        portInformation.time.errors = [error.message];
        throw error;
      }
      timePort.setBroadcast(true);
      portInformation.time.status = 'active';

      // Send update for newly bound port
      sendPortStateChanged();

      let port = PORT_UNICAST_MIN;
      let unicastPort: Socket | null = null;
      while (!unicastPort) {
        try {
          const socket = createSocket(
            {
              type: 'udp4',
              reuseAddr: false,
            },
            handleUnicastMessage,
          );
          sockets.unicast = socket;
          await bindSocket(socket, port, iface.address);
          unicastPort = socket;
          portInformation.unicast.status = 'active';
          portInformation.unicast.port = port;
        } catch (err) {
          port++;
          if (port > PORT_UNICAST_MAX) {
            const error = new TCNetInitializationError(
              `No available ports for unicast communication in range ${PORT_UNICAST_MIN}-${PORT_UNICAST_MAX}`,
              err instanceof Error ? err : new Error(String(err)),
            );
            portInformation.unicast.status = 'error';
            portInformation.unicast.errors = [error.message];
            throw error;
          }
        }
      }

      if (!unicastPort) {
        throw new Error(
          'Unexpected error: failed to bind unicast port but no error thrown',
        );
      }

      // Send final update
      sendPortStateChanged();
      startOptInInterval();
      events.emit('ready');
    } catch (err) {
      const error =
        err instanceof TCNetError
          ? err
          : new TCNetInitializationError(
              'Failed to initialize TCNet node',
              err instanceof Error ? err : new Error(String(err)),
            );
      logger.error(error);
      closeActiveSockets();
      return;
    }
  };

  const requestData: TCNetNode['requestData'] = (node, dataType, layer) => {
    if (!appInfo) {
      const error = new TCNetError(
        'Cannot request data before node is connected',
      );
      logger.error(error);
      return Promise.reject(error);
    }
    const nodeKey = calculateUniqueNodeId(node);
    return sendUnicastPacket(
      writeRequestPacket({
        header: prepareNextHeader(appInfo),
        dataType,
        layer,
      }),
      (node) => nodeKey === calculateUniqueNodeId(node.info),
    );
  };

  const on = events.on.bind(events);
  const addListener = events.addListener.bind(events);
  const removeListener = events.removeListener.bind(events);

  return {
    connect,
    destroy: async () => {
      events.emit('destroy');
      if (optInInterval) {
        clearInterval(optInInterval);
      }
      await sendOptOutPacket();
      closeActiveSockets();
    },
    getPortInformation,
    on,
    addListener,
    removeListener,
    requestData,
  };
};
