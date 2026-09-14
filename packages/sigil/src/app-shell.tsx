import React, {
  JSX,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { SIGIL_COMPONENTS } from './backend/app-root';
import {
  AppInformationContext,
  AppInformationContextData,
  LoggerContext,
  ShutdownContext,
  ShutdownContextData,
} from './context';
import { AppRootLogEntry } from './shared/types';
import { createSystemInformation, SigilLogEventEmitter } from './runtime';
import { Logger } from '@arcanejs/protocol/logging';
import { FiFo } from './util';

export type AppShellProps = {
  title: string;
  version: string;
  dataDirectory: string;
  logger: Logger;
  logEventEmitter: SigilLogEventEmitter;
  shutdownContext: ShutdownContextData;
  children: ReactNode;
  extraSystemInformation?: Record<string, string>;
};

export const AppShell = ({
  title,
  version,
  dataDirectory,
  logger,
  logEventEmitter,
  shutdownContext,
  children,
  extraSystemInformation,
}: AppShellProps): JSX.Element => {
  const logsRef = useRef<FiFo<AppRootLogEntry>>(null);
  const [lastLogIndex, setLastLogIndex] = useState<number>(-1);

  useEffect(() => {
    const listener = ({
      lastLogIndex,
      logs,
    }: {
      lastLogIndex: number;
      logs: FiFo<AppRootLogEntry>;
    }) =>
      setImmediate(() => {
        setLastLogIndex(lastLogIndex);
        logsRef.current = logs;
      });
    logEventEmitter.addListener('logsUpdated', listener);
    return () => {
      logEventEmitter.removeListener('logsUpdated', listener);
    };
  }, [logEventEmitter]);

  const system = useMemo(
    () =>
      createSystemInformation({
        dataDirectory,
        version,
        extra: extraSystemInformation,
      }),
    [dataDirectory, version, extraSystemInformation],
  );

  const appInformation: AppInformationContextData = useMemo(
    () => ({ version, title }),
    [version, title],
  );

  return (
    <ShutdownContext.Provider value={shutdownContext}>
      <AppInformationContext.Provider value={appInformation}>
        <LoggerContext.Provider value={{ logger }}>
          <SIGIL_COMPONENTS.AppRoot
            lastLog={lastLogIndex}
            system={system}
            onGetLogs={async ({ after }) => {
              return {
                logs: [
                  ...(logsRef.current?.filterIterator(
                    (log) => log.index > after,
                  ) ?? []),
                ],
              };
            }}
          >
            {children}
          </SIGIL_COMPONENTS.AppRoot>
        </LoggerContext.Provider>
      </AppInformationContext.Provider>
    </ShutdownContext.Provider>
  );
};
