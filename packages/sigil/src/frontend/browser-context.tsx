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

export type BaseBrowserContext = {
  openExternalLink: (url: string) => void;
  openNewWidow: (url: string, canUseExisting?: boolean) => void;
  selectDirectory: (() => Promise<string | null>) | null;
  openDevTools: (() => Promise<null>) | null;
  confirmClose: (message: string) => void;
  mediaSession: MediaSessionControl;
};

export const createDefaultBrowserContext = <
  TBrowserContext extends BaseBrowserContext = BaseBrowserContext,
>(
  browser?: Partial<TBrowserContext> | null,
): TBrowserContext => {
  const defaults: BaseBrowserContext = {
    openExternalLink: (url: string) => {
      window.open(url, '_blank', 'noopener,noreferrer');
    },
    openNewWidow: (url: string) => {
      window.open(url, '_blank', 'noopener,noreferrer');
    },
    selectDirectory: null,
    openDevTools: null,
    confirmClose: () => {
      // Browsers do not allow custom close confirmation text.
    },
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
