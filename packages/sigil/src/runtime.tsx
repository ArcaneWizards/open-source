import { Logger } from '@arcanejs/protocol/logging';
import { ArcaneDataFileError } from '@arcanejs/react-toolkit/data';
import { CoreComponents, ToolkitRenderer } from '@arcanejs/react-toolkit';
import { Toolkit, ToolkitOptions } from '@arcanejs/toolkit';
import { EventEmitter } from 'node:events';
import pino from 'pino';
import { JSX } from 'react';
import { SIGIL_COMPONENTS } from './backend/app-root';
import { ShutdownContextData } from './context';
import {
  AppRootLogEntry,
  AppRootLogEntryStackFrame,
  SystemInformation,
} from './shared/types';

const MAX_LOG_ENTRIES = 1000;

export type SigilLogEventEmitter = EventEmitter<{
  logsUpdated: [{ logs: AppRootLogEntry[] }];
}>;

export type SigilRuntimeAppProps<
  TAppApi,
  TExtraAppProps extends object,
> = TExtraAppProps & {
  title: string;
  version: string;
  edition: 'desktop' | 'cli';
  toolkit: Toolkit;
  logger: Logger;
  logEventEmitter: SigilLogEventEmitter;
  setAppApi: (api: TAppApi | null) => void;
  setWindowUrl: (windowUrl: URL) => void;
  shutdownContext: ShutdownContextData;
};

export type SigilRuntimeEventMap<TAppApi> = {
  apiChange: (api: TAppApi | null) => void;
  windowUrlChange: (url: URL) => void;
};

export type SigilAppInstance<TAppApi> = {
  addEventListener<K extends keyof SigilRuntimeEventMap<TAppApi>>(
    event: K,
    listener: SigilRuntimeEventMap<TAppApi>[K],
  ): void;
  shutdown: () => Promise<void>;
};

export type SigilRuntimeOptions<TAppApi, TExtraAppProps extends object> = {
  logger: pino.Logger;
  title: string;
  version: string;
  edition: 'desktop' | 'cli';
  appProps: TExtraAppProps;
  toolkitOptions?: Omit<Partial<ToolkitOptions>, 'logger'>;
  createApp: (
    props: SigilRuntimeAppProps<TAppApi, TExtraAppProps>,
  ) => JSX.Element;
  componentNamespaces?: NonNullable<
    Parameters<typeof ToolkitRenderer.render>[3]
  >['componentNamespaces'];
};

const getStackFramesFromError = (error: unknown): AppRootLogEntryStackFrame => {
  if (typeof error === 'string') {
    return { message: error, stack: null, cause: null };
  }

  if (!(error instanceof Error)) {
    return { message: String(error), stack: null, cause: null };
  }

  const frame: AppRootLogEntryStackFrame = {
    message: error.message,
    stack: error.stack ?? null,
    cause: error.cause ? getStackFramesFromError(error.cause) : null,
  };

  if (error instanceof ArcaneDataFileError) {
    frame.filePath = error.path;
    frame.operation = error.operation;
    frame.contents = error.contents;
  }

  return frame;
};

export const createSystemInformation = ({
  dataDirectory,
  version,
}: {
  dataDirectory: string;
  version: string;
}): SystemInformation => {
  return {
    appPath: process.execPath,
    cwd: process.cwd(),
    os: process.platform,
    version,
    dataDirectory,
  };
};

export const runSigilApp = <TAppApi, TExtraAppProps extends object>({
  logger: upstreamLogger,
  title,
  version,
  edition,
  appProps,
  toolkitOptions,
  createApp,
  componentNamespaces = [CoreComponents, SIGIL_COMPONENTS],
}: SigilRuntimeOptions<TAppApi, TExtraAppProps>): SigilAppInstance<TAppApi> => {
  let logs: AppRootLogEntry[] = [];

  const logEventEmitter: SigilLogEventEmitter = new EventEmitter();

  const addLogEntry = (entry: Omit<AppRootLogEntry, 'index'>) => {
    const index = (logs[logs.length - 1]?.index ?? -1) + 1;
    const trimEntries = Math.max(0, logs.length - MAX_LOG_ENTRIES + 1);
    logs = [...logs.slice(trimEntries), { index, ...entry }];
    logEventEmitter.emit('logsUpdated', { logs });
  };

  const logError = (level: 'error' | 'warn', rootMsg: string | Error) => {
    upstreamLogger[level](rootMsg);

    let error = rootMsg instanceof Error ? rootMsg : null;
    let message = typeof rootMsg === 'string' ? rootMsg : rootMsg.message;

    while (error) {
      if (error !== rootMsg) {
        message += `: ${error.message}`;
      }
      error = error.cause instanceof Error ? error.cause : null;
    }

    addLogEntry({
      level,
      message,
      timestamp: Date.now(),
      stack: getStackFramesFromError(rootMsg),
    });
  };

  const logMessage = (level: 'info' | 'debug', message: string) => {
    upstreamLogger[level](message);
    addLogEntry({
      level,
      message,
      timestamp: Date.now(),
    });
  };

  const logger: Logger = {
    debug: (message: string) => logMessage('debug', message),
    info: (message: string) => logMessage('info', message),
    warn: (message: string | Error) => logError('warn', message),
    error: (message: string | Error) => logError('error', message),
  };

  const toolkit = new Toolkit({
    log: {
      ...logger,
      debug: upstreamLogger.debug.bind(upstreamLogger),
    },
    title,
    ...toolkitOptions,
  });

  toolkit.start({
    mode: 'manual',
    setup: () => {
      logger.info(`${title} ready to start listening`);
    },
  });

  let api: TAppApi | null = null;
  const apiListeners = new Set<(value: TAppApi | null) => void>();

  const setAppApi = (value: TAppApi | null) => {
    api = value;
    for (const listener of apiListeners) {
      listener(value);
    }
  };

  let windowUrl: URL | null = null;
  const windowUrlListeners = new Set<(value: URL) => void>();

  const setWindowUrl = (value: URL) => {
    windowUrl = value;
    for (const listener of windowUrlListeners) {
      listener(value);
    }
  };

  const shutdownListeners = new Set<() => Promise<void>>();

  const shutdownContext: ShutdownContextData = {
    addShutdownListener: (listener) => {
      shutdownListeners.add(listener);
    },
    removeShutdownListener: (listener) => {
      shutdownListeners.delete(listener);
    },
  };

  const shutdown = async () => {
    logger.info(`Shutting down ${title}...`);
    await Promise.all(
      Array.from(shutdownListeners).map((listener) => listener()),
    );
    logger.info(`${title} shutdown complete`);
  };

  ToolkitRenderer.render(
    createApp({
      title,
      version,
      edition,
      toolkit,
      logger,
      logEventEmitter,
      setAppApi,
      setWindowUrl,
      shutdownContext,
      ...appProps,
    }),
    toolkit,
    {},
    {
      componentNamespaces,
    },
  );

  return {
    addEventListener: (event, listener) => {
      if (event === 'apiChange') {
        const apiListener =
          listener as SigilRuntimeEventMap<TAppApi>['apiChange'];
        apiListeners.add(apiListener);
        if (api) {
          apiListener(api);
        }
        return;
      }

      const windowUrlListener =
        listener as SigilRuntimeEventMap<TAppApi>['windowUrlChange'];
      windowUrlListeners.add(windowUrlListener);
      if (windowUrl) {
        windowUrlListener(windowUrl);
      }
    },
    shutdown,
  };
};
