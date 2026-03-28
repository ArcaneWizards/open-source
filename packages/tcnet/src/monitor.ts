import EventEmitter from 'node:events';
import { TCNetLogger, TCNetNode, TCNetNodeIdentity } from './types.js';
import {
  LayerDataId,
  TCNET_LAYER_COUNT,
  TCNetLayerState,
  TCNetTimePacketLayer,
} from './protocol.js';
import { calculateUniqueNodeId, differsByMoreThan } from './utils.js';
import { TCNetProtocolError } from './errors.js';

/**
 * How many milliseconds need to have changed to consider a timecode update
 */
const MAX_DELTA_MS = 10;

export type TCNetTimecodeTrackInfo = {
  title: string | null;
  artist: string | null;
};

export type TCNetTimecodePlayState =
  | {
      state: 'playing';
      effectiveStartTime: number;
      /**
       * 1.0 means normal speed, 2.0 means double speed, etc.
       * Can be negative for reverse playback,
       *
       * in which case effectiveStartTime represents the time when the track will reach 0:00.
       */
      speed: number;
      onAir: boolean;
    }
  | {
      state: 'stopped';
      currentTimeMillis: number;
      /**
       * Speed still exists when stopped,
       * to indicate what speed the track will play at when started.
       */
      speed: number;
      onAir: boolean;
    };

export type TCNetTimecodeState = {
  layerId: string;
  layerName: string;
  /**
   * If available, the total time of the track loaded in this layer.
   *
   * Some timecode sources will not have this information.
   */
  totalTime: {
    timeMillis: number;
    /**
     * How accurate is the totalTimeMillis value,
     * some sources (such as ShowKontrol) are not completely accurate.
     */
    precisionMillis: number;
  } | null;
  /**
   * If available, the metadata info of the track loaded in this layer.
   */
  info: TCNetTimecodeTrackInfo | null;
  playState: TCNetTimecodePlayState;
};

export type TCNetTimecodeMonitorEventMap = {
  'timecode-changed': [TCNetTimecodeState];
  'layer-removed': [Pick<TCNetTimecodeState, 'layerId'>];
};

export type TCNetTimecodeMonitor = {
  on<K extends keyof TCNetTimecodeMonitorEventMap>(
    event: K,
    callback: (...args: TCNetTimecodeMonitorEventMap[K]) => void,
  ): void;
  addListener<K extends keyof TCNetTimecodeMonitorEventMap>(
    event: K,
    callback: (...args: TCNetTimecodeMonitorEventMap[K]) => void,
  ): void;
  removeListener<K extends keyof TCNetTimecodeMonitorEventMap>(
    event: K,
    callback: (...args: TCNetTimecodeMonitorEventMap[K]) => void,
  ): void;
};

/**
 * 0-based layer index (for use with arrays, etc...)
 */
type LayerIndex = number & {
  __brand: 'LayerIndex';
};

/**
 * Convert the layer ID provided by data packets,
 * (which isn't neccesarily 0-index based)
 * to a 0-based index
 */
const layerDataIdToIndex = (dataLayerId: LayerDataId): LayerIndex => {
  return (dataLayerId - 1) as LayerIndex;
};

/**
 * Convert a 0-based layer index to the layer ID used in data packets
 */
const layerIndexToDataId = (index: LayerIndex): LayerDataId => {
  return (index + 1) as LayerDataId;
};

const asLayerIndex = (rawNumber: number): LayerIndex => {
  return rawNumber as LayerIndex;
};

const getLayerId = (node: TCNetNodeIdentity, layer: LayerIndex) => {
  return `${calculateUniqueNodeId(node)}:${layer}`;
};

const TCNET_LAYER_INDEXES: LayerIndex[] = Array.from(
  { length: TCNET_LAYER_COUNT },
  (_, i) => asLayerIndex(i),
);

/**
 * Create a monitor that listens to TCNet messages to keep track of the current
 * timecodes,
 * accounts for differences in implementation details for different products,
 * and produces a unified and simplified interface for monitoring timecodes
 * with respect the internal clock.
 */
export const createTCNetTimecodeMonitor = (
  tcNetNode: TCNetNode,
  logger: TCNetLogger,
): TCNetTimecodeMonitor => {
  const events = new EventEmitter<TCNetTimecodeMonitorEventMap>();

  const on = events.on.bind(events);
  const addListener = events.addListener.bind(events);
  const removeListener = events.removeListener.bind(events);

  interface WeightedTrackInfo {
    /**
     * How many times have we received this info for this track?
     * We use this to weight the results,
     * as the first result is often incorrect.
     */
    matchCount: number;
    lastMatchTime: number;
    info: TCNetTimecodeTrackInfo;
  }

  type LayerInfo = {
    name: string | null;
    status: TCNetLayerState;
    trackId: number | null;
    pitchBend: number;
    speed: number;
    layerState: TCNetTimecodeState;
  };

  /**
   * TODO: clear up nodeStates for nodes that have been disconnected
   */
  const nodeStates = new Map<
    string,
    {
      node: TCNetNodeIdentity;
      trackInfo: Map<number, Map<string, WeightedTrackInfo>>;
      getLayerInfo: (layer: LayerIndex) => LayerInfo | undefined;
    }
  >();

  const getNodeState = (node: TCNetNodeIdentity) => {
    const nodeKey = calculateUniqueNodeId(node);
    let nodeState = nodeStates.get(nodeKey);
    if (nodeState) {
      return nodeState;
    }
    const layerInfoArray: LayerInfo[] = new Array(TCNET_LAYER_COUNT);
    nodeState = {
      node,
      trackInfo: new Map(),
      getLayerInfo: (i) => layerInfoArray[i],
    };
    nodeStates.set(nodeKey, nodeState);
    for (const i of TCNET_LAYER_INDEXES) {
      layerInfoArray[i] = {
        name: null,
        status: 'IDLE',
        trackId: null,
        pitchBend: 0,
        speed: 0,
        layerState: {
          layerId: `${i}`,
          layerName: `Layer ${i + 1}`,
          totalTime: null,
          info: null,
          playState: {
            state: 'stopped',
            currentTimeMillis: 0,
            speed: 1,
            onAir: false,
          },
        },
      };
    }
    return nodeState;
  };

  const updateMetadataForLayer = (
    node: TCNetNodeIdentity,
    layer: LayerIndex,
  ) => {
    const trackID = getNodeState(node).getLayerInfo(layer)?.trackId;
    if (typeof trackID !== 'number') {
      return;
    }
    tcNetNode.requestData(node, 'METADATA', layerIndexToDataId(layer));
  };

  const updateMetricsForLayer = (
    node: TCNetNodeIdentity,
    layer: LayerIndex,
  ) => {
    const trackID = getNodeState(node).getLayerInfo(layer)?.trackId;
    if (typeof trackID !== 'number') {
      return;
    }
    tcNetNode.requestData(node, 'METRICS_DATA', layerIndexToDataId(layer));
  };

  const getProbableTrackInfo = (
    node: TCNetNodeIdentity,
    trackID: number | null,
  ): TCNetTimecodeTrackInfo | null => {
    if (trackID === null) {
      return null;
    }

    const trackInfoForTrack = getNodeState(node).trackInfo.get(trackID);
    if (!trackInfoForTrack) {
      return null;
    }

    let bestMatch: WeightedTrackInfo | null = null;
    for (const info of trackInfoForTrack.values()) {
      const bestMatchCount = bestMatch?.matchCount ?? 0;
      if (
        // Best match if we've seen this track the most times
        info.matchCount > bestMatchCount ||
        // Or if we've seen it aa similar same amount of times,
        // but more recently
        (info.matchCount > bestMatchCount - 4 &&
          info.lastMatchTime > (bestMatch?.lastMatchTime ?? 0))
      ) {
        bestMatch = info;
      }
    }

    // TODO: it would be nice to receive a metadata packet more than once,
    // however some implementations (looking at you, ShowKontrol)
    // seem to mostly respond with blank metadata packets.
    return bestMatch?.info ?? null;
  };

  const updatePlayingTimecode = (
    node: TCNetNodeIdentity,
    i: LayerIndex,
    info: LayerInfo,
    layer: TCNetTimePacketLayer | undefined,
  ) => {
    if (!layer) {
      return;
    }
    const now = Date.now();
    const effectiveStartTime = now - layer.currentTimeMillis / info.speed;
    // TODO: update this so we don't indiscriminately call this function
    // to check weights every update
    const trackInfo = getProbableTrackInfo(node, info.trackId);
    if (
      !info.layerState ||
      info.layerState.playState.state !== 'playing' ||
      (info.layerState.playState.state === 'playing' &&
        (differsByMoreThan(
          info.layerState.playState.effectiveStartTime,
          effectiveStartTime,
          MAX_DELTA_MS,
        ) ||
          differsByMoreThan(
            info.layerState.totalTime?.timeMillis ?? 0,
            layer.totalTimeMillis,
            MAX_DELTA_MS,
          ))) ||
      info.layerState.info !== trackInfo ||
      info.layerState.playState.speed !== info.speed ||
      info.layerState.playState.onAir !== info.layerState.playState.onAir
    ) {
      info.layerState = {
        layerId: getLayerId(node, i),
        layerName: info.name ?? `Layer ${layerIndexToDataId(i)}`,
        totalTime:
          layer.totalTimeMillis > 0
            ? {
                timeMillis: layer.totalTimeMillis,
                precisionMillis: 1000,
              }
            : null,
        info: trackInfo,
        playState: {
          state: 'playing',
          effectiveStartTime,
          speed: info.speed,
          onAir: info.layerState?.playState.onAir,
        },
      };
      events.emit('timecode-changed', info.layerState);
    }
  };

  const updatePausedTimecode = (
    node: TCNetNodeIdentity,
    i: LayerIndex,
    info: LayerInfo,
    layer: TCNetTimePacketLayer | undefined,
  ) => {
    if (!layer) {
      return;
    }
    // TODO: update this so we don't indiscriminately call this function
    // to check weights every update
    const trackInfo = getProbableTrackInfo(node, info.trackId);
    if (
      !info.layerState ||
      info.layerState.playState.state !== 'stopped' ||
      (info.layerState.playState.state === 'stopped' &&
        (differsByMoreThan(
          info.layerState.playState.currentTimeMillis,
          layer.currentTimeMillis,
          MAX_DELTA_MS,
        ) ||
          differsByMoreThan(
            info.layerState.totalTime?.timeMillis ?? 0,
            layer.totalTimeMillis,
            MAX_DELTA_MS,
          ))) ||
      info.layerState.info !== trackInfo ||
      info.layerState.playState.speed !== info.speed ||
      info.layerState.playState.onAir !== info.layerState.playState.onAir
    ) {
      info.layerState = {
        layerId: getLayerId(node, i),
        layerName: info.name ?? `Layer ${layerIndexToDataId(i)}`,
        totalTime:
          layer.totalTimeMillis > 0
            ? {
                timeMillis: layer.totalTimeMillis,
                precisionMillis: 1000,
              }
            : null,
        info: trackInfo,
        playState: {
          state: 'stopped',
          currentTimeMillis: layer.currentTimeMillis,
          speed: info.speed,
          onAir: info.layerState?.playState.onAir,
        },
      };
      events.emit('timecode-changed', info.layerState);
    }
  };

  tcNetNode.on('data', ({ packet, node }) => {
    const nodeState = getNodeState(node);
    if (packet.dataType === 'METADATA') {
      if (packet.trackId) {
        logger.warn(
          new TCNetProtocolError(
            `Received unexpected trackId in METADATA packet, implementation needs to be updated to handle this!`,
          ),
        );
      }
      const info = {
        title: packet.trackTitle || null,
        artist: packet.trackArtist || null,
      };
      if (!info.title && !info.artist) {
        // Ignore empty metadata packets,
        // quite common with ShowKontrol
        return;
      }
      const trackID = nodeState.getLayerInfo(
        layerDataIdToIndex(packet.layer),
      )?.trackId;
      if (typeof trackID !== 'number') {
        return;
      }
      let trackInfoForTrack = nodeState.trackInfo.get(trackID);
      if (!trackInfoForTrack) {
        trackInfoForTrack = new Map();
        nodeState.trackInfo.set(trackID, trackInfoForTrack);
      }
      const key = `${info.artist} - ${info.title}`;
      const weightedInfo: WeightedTrackInfo = trackInfoForTrack.get(key) || {
        matchCount: 0,
        lastMatchTime: Date.now(),
        info,
      };
      weightedInfo.matchCount++;
      weightedInfo.lastMatchTime = Date.now();
      trackInfoForTrack.set(key, weightedInfo);
    } else if (packet.dataType === 'METRICS_DATA') {
      const info = nodeState.getLayerInfo(layerDataIdToIndex(packet.layer));
      if (info) {
        info.pitchBend = packet.pitchBend ?? 0;
        info.speed = 1 + info.pitchBend / 10000;
      }
    }
  });

  tcNetNode.on('time', ({ packet, node }) => {
    const nodeState = getNodeState(node);
    for (const i of TCNET_LAYER_INDEXES) {
      const info = nodeState.getLayerInfo(i);
      switch (info?.status) {
        case 'PLAYING':
        case 'LOOPING':
        case 'CUEDOWN':
          updatePlayingTimecode(node, i, info, packet.layers[i]);
          break;
        case 'PAUSED':
        case 'STOPPED':
        case 'LOADING':
        case 'PLATTERDOWN':
        case 'HOLD':
        case 'FFWD':
        case 'FFRV':
          updatePausedTimecode(node, i, info, packet.layers[i]);
          break;
        case 'UNKNOWN':
        case 'IDLE':
        // Often not actually idle
      }
    }
  });

  tcNetNode.on('node-status', ({ packet, node }) => {
    for (const i of TCNET_LAYER_INDEXES) {
      // Update trackIDs from status packet,
      // as this is the only packet where SHowKontrol reliably provides trackIDs
      const layer = packet.layers[i];
      const info = getNodeState(node).getLayerInfo(i);
      if (!info || !layer) {
        throw new Error('Inconsistent layer indexes');
      }
      info.status = layer.status;
      info.name = layer.name;
      if (info.trackId !== layer.trackId && layer.trackId > 0) {
        logger.info(
          `Updated trackID for layer ${i}: ${info.trackId} -> ${layer.trackId}`,
        );
        info.trackId = layer.trackId;
        updateMetadataForLayer(node, i);
      }
    }
  });

  tcNetNode.on('nodes-changed', (nodes) => {
    const knownNodeIds = new Set(
      Object.values(nodes).map((node) => calculateUniqueNodeId(node)),
    );
    for (const [nodeId, nodeState] of nodeStates.entries()) {
      if (!knownNodeIds.has(nodeId)) {
        for (const i of TCNET_LAYER_INDEXES) {
          const layerState = nodeState.getLayerInfo(i)?.layerState;
          if (layerState) {
            events.emit('layer-removed', { layerId: layerState.layerId });
          }
        }
        nodeStates.delete(nodeId);
      }
    }
  });

  const updateLoadedTracks = () => {
    for (const nodeState of nodeStates.values()) {
      for (const i of TCNET_LAYER_INDEXES) {
        const info = nodeState.getLayerInfo(i);
        if (info?.trackId) {
          updateMetadataForLayer(nodeState.node, i);
          updateMetricsForLayer(nodeState.node, i);
        }
      }
    }
  };

  let autoUpdater: NodeJS.Timeout | null = null;

  tcNetNode.on('ready', () => {
    autoUpdater = setInterval(updateLoadedTracks, 1000);
    updateLoadedTracks();
  });

  tcNetNode.on('destroy', () => {
    if (autoUpdater) {
      clearInterval(autoUpdater);
    }
  });

  return {
    on,
    addListener,
    removeListener,
  };
};
