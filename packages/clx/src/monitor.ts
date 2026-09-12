import EventEmitter from 'node:events';
import { ClxClient } from '.';
import { ClxDeckPacket } from './messagepack';
import { CLX_DECK_FPS } from './constants';

/**
 * How many milliseconds need to have changed to consider a timecode update
 */
const MAX_DELTA_MS = 10;

/**
 * How much of a difference between the expected current time and actual current
 * time is required to consider the deck to be scratching.
 */
const MAX_DELTA_SCRATCHING_MS = 100;

/**
 * How long should we wait not receiving any packets for a deck / host,
 * before considering it to be disconnected.
 */
const TIMEOUT_MS = 5000;
/**
 * How often should we check for disconnected hosts / decks
 */
const INTERVAL_MS = 1000;
/**
 * How often can resync requests be sent to a host
 */
const MIN_RESYNC_REQUEST_INTERVAL_MS = 2000;
/**
 * How long can we wait between receiving deck packets before considering the
 * deck to be stopped.
 *
 * We allow a longer interval than the expected FPS,
 * to account for network latency and packet loss.
 */
const MAX_MS_INTERVAL_BETWEEN_PLAYING_DECK_PACKETS = (1000 / CLX_DECK_FPS) * 5;

export type ClxTimecodeTrackInfo = {
  title: string | null;
  artist: string | null;
};

export type ClxTimecodePlayState =
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

export type ClxTimecodeStateChangedEvent = {
  hostId: string;
  deck: number;
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
  info: ClxTimecodeTrackInfo | null;
  playState: ClxTimecodePlayState;
};

export type ClxServerDisconnectedEvent = {
  hostId: string;
};

export type ClxDeckDisconnectedEvent = {
  hostId: string;
  deck: number;
};

export type ClxTimecodeMonitorEventMap = {
  'timecode-changed': [ClxTimecodeStateChangedEvent];
  'server-disconnected': [ClxServerDisconnectedEvent];
  'deck-disconnected': [ClxDeckDisconnectedEvent];
};

export type ClxTimecodeMonitor = {
  on<K extends keyof ClxTimecodeMonitorEventMap>(
    event: K,
    callback: (...args: ClxTimecodeMonitorEventMap[K]) => void,
  ): void;
  addListener<K extends keyof ClxTimecodeMonitorEventMap>(
    event: K,
    callback: (...args: ClxTimecodeMonitorEventMap[K]) => void,
  ): void;
  removeListener<K extends keyof ClxTimecodeMonitorEventMap>(
    event: K,
    callback: (...args: ClxTimecodeMonitorEventMap[K]) => void,
  ): void;
};

type DeckState = {
  lastReceivedAt: number;
  lastPacket: ClxDeckPacket | null;
  isPlayingNormally: boolean;
  last: {
    totalTime: ClxTimecodeStateChangedEvent['totalTime'] | null;
    playState: ClxTimecodePlayState | null;
    info: ClxTimecodeTrackInfo | null;
  };
};

type HostState = {
  lastReceivedAt: number;
  resyncRequestLastSentAt?: number;
  decks: Record<number, DeckState>;
};

const hasPlayStateChanged = (
  oldState: ClxTimecodePlayState | null,
  newState: ClxTimecodePlayState,
): boolean => {
  if (!oldState) {
    return true;
  }

  if (oldState.state === 'stopped' && newState.state === 'stopped') {
    return oldState.currentTimeMillis !== newState.currentTimeMillis;
  }

  if (oldState.state === 'playing' && newState.state === 'playing') {
    const delta = Math.abs(
      oldState.effectiveStartTime - newState.effectiveStartTime,
    );
    return delta > MAX_DELTA_MS || oldState.speed !== newState.speed;
  }

  return true;
};

export const createClxTimecodeMonitor = (
  clx: ClxClient,
): ClxTimecodeMonitor => {
  const events = new EventEmitter<ClxTimecodeMonitorEventMap>();

  const on = events.on.bind(events);
  const addListener = events.addListener.bind(events);
  const removeListener = events.removeListener.bind(events);

  const stateByHost: Record<string, HostState> = {};

  const getOrCreateDeckState = (
    now: number,
    hostId: string,
    deck: number,
  ): { hostState: HostState; deckState: DeckState } => {
    let existingHost = stateByHost[hostId];
    if (!existingHost) {
      existingHost = {
        lastReceivedAt: now,
        decks: {},
      };
      stateByHost[hostId] = existingHost;
    }
    existingHost.lastReceivedAt = now;

    let existingDeck = existingHost.decks[deck];
    if (!existingDeck) {
      existingDeck = {
        lastReceivedAt: now,
        lastPacket: null,
        isPlayingNormally: false,
        last: {
          info: null,
          totalTime: null,
          playState: null,
        },
      };
      existingHost.decks[deck] = existingDeck;
    }
    existingDeck.lastReceivedAt = now;
    return { hostState: existingHost, deckState: existingDeck };
  };

  clx.on('eventPacket', ({ host, port, packet }) => {
    const now = Date.now();
    const hostId = `${host}:${port}`;
    console.log('eventPacket', now, hostId, packet);
  });

  clx.on('deckPacket', ({ host, port, packet }) => {
    const now = Date.now();
    const hostId = `${host}:${port}`;
    const { hostState, deckState } = getOrCreateDeckState(
      now,
      hostId,
      packet.Deck,
    );

    const currentTimeMillis = packet.Position * 1000;
    const totalTimeMillis = packet.Length * 1000;

    let playState: ClxTimecodePlayState | null = null;

    /**
     * TODO: Use fader values for this
     */
    const onAir = packet.EQHigh > 0 || packet.EQLow > 0 || packet.EQMid > 0;

    const positionUnchanged =
      deckState.lastPacket?.Position === packet.Position;
    const expectedCurrentTimeMillis =
      deckState.lastPacket && deckState.last.playState?.state === 'playing'
        ? (now - deckState.last.playState.effectiveStartTime) *
          deckState.last.playState.speed
        : currentTimeMillis;

    const expectationDelta = Math.abs(
      expectedCurrentTimeMillis - currentTimeMillis,
    );
    const isPlayingNormally = expectationDelta <= MAX_DELTA_SCRATCHING_MS;

    if (
      positionUnchanged ||
      !isPlayingNormally ||
      !deckState.isPlayingNormally
    ) {
      // Duplicate position for 2 frames, deck is paused
      playState = {
        state: 'stopped',
        currentTimeMillis,
        onAir,
        /** TODO: check this */
        speed: packet.Pitch,
      };
    } else {
      // Deck is playing
      playState = {
        state: 'playing',
        effectiveStartTime: now - currentTimeMillis / packet.Pitch,
        onAir,
        speed: packet.Pitch,
      };
    }

    let emit = false;
    if (hasPlayStateChanged(deckState.last.playState, playState)) {
      deckState.last.playState = playState;
      emit = true;
    }

    if (deckState.last.totalTime?.timeMillis !== totalTimeMillis) {
      deckState.last.totalTime = {
        timeMillis: totalTimeMillis,
        precisionMillis: 0,
      };
      emit = true;
    }

    if (
      !deckState.last.info &&
      (!hostState.resyncRequestLastSentAt ||
        now - hostState.resyncRequestLastSentAt >
          MIN_RESYNC_REQUEST_INTERVAL_MS)
    ) {
      clx.resync(host);
      hostState.resyncRequestLastSentAt = now;
    }

    if (emit && deckState.last.playState) {
      events.emit('timecode-changed', {
        hostId,
        deck: packet.Deck,
        totalTime: deckState.last.totalTime,
        playState: deckState.last.playState,
        info: deckState.last.info,
      });
    }

    deckState.lastPacket = packet;
    deckState.isPlayingNormally = isPlayingNormally;
  });

  clx.on('metadataPacket', ({ host, port, packet }) => {
    const now = Date.now();
    const hostId = `${host}:${port}`;
    const { deckState } = getOrCreateDeckState(now, hostId, packet.Deck);

    const info: ClxTimecodeTrackInfo = {
      title: packet.Title || null,
      artist: packet.Artist || null,
    };

    let emit = false;
    if (
      deckState.last.info?.title !== info.title ||
      deckState.last.info?.artist !== info.artist
    ) {
      deckState.last.info = info;
      emit = true;
    }

    if (emit && deckState.last.playState) {
      events.emit('timecode-changed', {
        hostId,
        deck: packet.Deck,
        totalTime: deckState.last.totalTime,
        playState: deckState.last.playState,
        info: deckState.last.info,
      });
    }
  });

  const cleanupInterval = setInterval(() => {
    const now = Date.now();

    for (const [hostId, hostState] of Object.entries(stateByHost)) {
      if (now - hostState.lastReceivedAt > TIMEOUT_MS) {
        delete stateByHost[hostId];
        events.emit('server-disconnected', { hostId });
        continue;
      }

      for (const [deck, deckState] of Object.entries(hostState.decks)) {
        if (now - deckState.lastReceivedAt > TIMEOUT_MS) {
          delete hostState.decks[Number(deck)];
          events.emit('deck-disconnected', {
            hostId,
            deck: Number(deck),
          });
        }
      }
    }
  }, INTERVAL_MS);

  clx.on('destroy', () => {
    clearInterval(cleanupInterval);
  });

  return {
    on: on as ClxTimecodeMonitor['on'],
    addListener: addListener as ClxTimecodeMonitor['addListener'],
    removeListener: removeListener as ClxTimecodeMonitor['removeListener'],
  };
};
