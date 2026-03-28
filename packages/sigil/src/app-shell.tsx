import React, { JSX, ReactNode, useEffect, useMemo, useState } from 'react';
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

export type AppShellProps = {
  title: string;
  version: string;
  dataDirectory: string;
  logger: Logger;
  logEventEmitter: SigilLogEventEmitter;
  shutdownContext: ShutdownContextData;
  children: ReactNode;
};

export const AppShell = ({
  title,
  version,
  dataDirectory,
  logger,
  logEventEmitter,
  shutdownContext,
  children,
}: AppShellProps): JSX.Element => {
  const [logs, setLogs] = useState<AppRootLogEntry[]>([]);

  const lastLogIndex = logs[logs.length - 1]?.index ?? -1;

  useEffect(() => {
    const listener = ({ logs }: { logs: AppRootLogEntry[] }) =>
      setImmediate(() => setLogs(logs));
    logEventEmitter.addListener('logsUpdated', listener);
    return () => {
      logEventEmitter.removeListener('logsUpdated', listener);
    };
  }, [logEventEmitter]);

  const system = useMemo(
    () => createSystemInformation({ dataDirectory, version }),
    [dataDirectory, version],
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
                logs: logs.filter((log) => log.index > after),
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
