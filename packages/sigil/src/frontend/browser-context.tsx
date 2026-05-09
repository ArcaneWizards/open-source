import { PropsWithChildren, createContext, useContext } from 'react';
import { createBrowserMediaSession } from './media-session';

export type MediaSessionAction =
  | {
      action: 'play' | 'pause' | 'playpause';
    }
  | {
      action: 'seekto';
      seekTimeMillis: number;
    }
  | {
      action: 'seekbackward' | 'seekforward';
      seekOffsetMillis?: number;
    };

export type MediaSessionHandler = (action: MediaSessionAction) => void;

export type MediaPlayState =
  | {
      state: 'playing';
      effectiveStartTime: number;
      speed: number;
    }
  | {
      state: 'stopped';
      speed: number;
      currentTimeMillis: number;
    };

export type MediaMetadata = {
  title?: string;
  artist?: string;
  durationMillis: number;
  state: MediaPlayState;
};

export type MediaSessionControl = {
  setMetaData: (metadata: MediaMetadata | null) => void;
  setHandler: (handler: MediaSessionHandler | null) => void;
};

export type NewWindowOptions = {
  /**
   * If true, try and find an existing window with the same URL,
   * and just bring it into focus instead of opening a new one.
   */
  canUseExisting?: boolean;
  /**
   * If supported by the the electron environment,
   * specify a string mode identifier to configure the window behavior.
   */
  mode?: string;
};

export type BrowserCloseListenerAction =
  | {
      action: 'allow';
    }
  | {
      action: 'confirm';
      confirmation: string;
    };

/**
 * A listener that can be registered to listen for close events,
 * and prevent them if needed.
 *
 * Note that in browser environments,
 * preventing close will always display the same confirmation message that a user
 * can then choose to proceed with or not.
 */
export type BrowserCloseListener = () => BrowserCloseListenerAction;

export type BaseBrowserContext = {
  appListenerChangesHandledExternally?: boolean;
  openExternalLink: (url: string) => void;
  openNewWidow: (url: string, options?: NewWindowOptions) => void;
  selectDirectory: (() => Promise<string | null>) | null;
  openDevTools: (() => Promise<null>) | null;
  addCloseListener: (listener: BrowserCloseListener) => void;
  removeCloseListener: (listener: BrowserCloseListener) => void;
  mediaSession: MediaSessionControl;
};

export const createDefaultBrowserContext = <
  TBrowserContext extends BaseBrowserContext = BaseBrowserContext,
>(
  browser?: Partial<TBrowserContext> | null,
): TBrowserContext => {
  const closeListeners = new Set<BrowserCloseListener>();

  window.addEventListener('beforeunload', (e) => {
    let confirm = false;
    for (const listener of closeListeners) {
      // In browsers, the message is fixed and cannot be customized,
      // so we just check if any listener wants to prevent the close action.
      if (listener().action === 'confirm') {
        confirm = true;
      }
    }

    if (confirm) {
      // Give message to show confirmation dialog
      e.preventDefault();
      e.returnValue = '';
      return;
    }
  });

  const defaults: BaseBrowserContext = {
    appListenerChangesHandledExternally: false,
    openExternalLink: (url: string) => {
      window.open(url, '_blank', 'noopener,noreferrer');
    },
    openNewWidow: (url: string) => {
      window.open(url, '_blank', 'noopener,noreferrer');
    },
    selectDirectory: null,
    openDevTools: null,
    addCloseListener: (listener: BrowserCloseListener) =>
      closeListeners.add(listener),
    removeCloseListener: (listener: BrowserCloseListener) =>
      closeListeners.delete(listener),
    mediaSession: createBrowserMediaSession(),
  };

  return {
    ...defaults,
    ...browser,
  } as TBrowserContext;
};

export const BrowserContext = createContext<BaseBrowserContext>(
  new Proxy({} as BaseBrowserContext, {
    get: () => {
      throw new Error('BrowserContext not provided.');
    },
  }),
);

export const BrowserContextProvider = <
  TBrowserContext extends BaseBrowserContext,
>({
  browser,
  children,
}: PropsWithChildren<{ browser: TBrowserContext }>) => {
  return (
    <BrowserContext.Provider value={browser}>
      {children}
    </BrowserContext.Provider>
  );
};

export const useBrowserContext = <
  TBrowserContext extends BaseBrowserContext = BaseBrowserContext,
>() => useContext(BrowserContext) as TBrowserContext;
