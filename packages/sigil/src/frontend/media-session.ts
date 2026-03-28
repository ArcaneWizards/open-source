import type {
  MediaSessionControl,
  MediaSessionHandler,
} from './browser-context';

const NOOP_MEDIA_SESSION: MediaSessionControl = {
  setMetaData: () => {},
  setHandler: () => {},
};

export const createBrowserMediaSession = (): MediaSessionControl => {
  if (
    typeof navigator === 'undefined' ||
    !('mediaSession' in navigator) ||
    !navigator.mediaSession
  ) {
    return NOOP_MEDIA_SESSION;
  }

  let handler: MediaSessionHandler | null = null;

  const setMetaData: MediaSessionControl['setMetaData'] = (data) => {
    if (!data) {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = 'none';
      return;
    }

    const { title, artist, durationMillis, state } = data;
    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist,
    });

    if (state.state === 'playing') {
      navigator.mediaSession.playbackState = 'playing';
      navigator.mediaSession.setPositionState({
        duration: durationMillis / 1000,
        position:
          Math.max(0, (Date.now() - state.effectiveStartTime) * state.speed) /
          1000,
        playbackRate: state.speed,
      });
      return;
    }

    navigator.mediaSession.playbackState = 'paused';
    navigator.mediaSession.setPositionState({
      duration: durationMillis / 1000,
      position: state.currentTimeMillis / 1000,
    });
  };

  const setHandler: MediaSessionControl['setHandler'] = (value) => {
    handler = value;
  };

  navigator.mediaSession.setActionHandler('play', () => {
    handler?.({ action: 'play' });
  });
  navigator.mediaSession.setActionHandler('pause', () => {
    handler?.({ action: 'pause' });
  });

  const handleSeekAction = (action: MediaSessionActionDetails) => {
    if (action.action === 'seekto') {
      handler?.({
        action: 'seekto',
        seekTimeMillis: (action.seekTime ?? 0) * 1000,
      });
      return;
    }

    if (action.action === 'seekbackward' || action.action === 'seekforward') {
      handler?.({
        action: action.action,
        seekOffsetMillis: (action.seekOffset ?? 0) * 1000,
      });
    }
  };

  navigator.mediaSession.setActionHandler('seekto', handleSeekAction);
  navigator.mediaSession.setActionHandler('seekbackward', handleSeekAction);
  navigator.mediaSession.setActionHandler('seekforward', handleSeekAction);

  return {
    setMetaData,
    setHandler,
  };
};
