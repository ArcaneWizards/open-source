import { Logger } from '@arcanejs/protocol/logging';
import { createContext, useContext, useEffect } from 'react';

export type AppInformationContextData = {
  version: string;
  title: string;
};

export const AppInformationContext = createContext<AppInformationContextData>({
  version: '',
  title: '',
});

export type ShutdownContextData = {
  addShutdownListener: (listener: () => Promise<void>) => void;
  removeShutdownListener: (listener: () => Promise<void>) => void;
};

export const ShutdownContext = createContext<ShutdownContextData>(
  new Proxy({} as ShutdownContextData, {
    get() {
      throw new Error(
        'ShutdownContext is not available outside of the Sigil application environment',
      );
    },
  }),
);

export const useShutdownHandler = (handler: () => Promise<void>) => {
  const { addShutdownListener, removeShutdownListener } =
    useContext(ShutdownContext);

  useEffect(() => {
    addShutdownListener(handler);
    return () => {
      removeShutdownListener(handler);
    };
  }, [addShutdownListener, removeShutdownListener, handler]);
};

export const LoggerContext = createContext<{ logger: Logger }>({
  get logger(): Logger {
    throw new Error('Logger not initialized');
  },
});

export const useLogger = () => {
  return useContext(LoggerContext).logger;
};
