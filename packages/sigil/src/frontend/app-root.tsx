import { StageContext } from '@arcanejs/toolkit-frontend';
import { Tooltip } from 'radix-ui';
import { useContext, useEffect, useMemo, useState } from 'react';
import { SigilAppRootComponent, SigilComponentCalls } from '../backend/proto';
import { AppRootLogEntry } from '../shared/types';
import { BaseBrowserContext, BrowserContextProvider } from './browser-context';
import {
  DebuggerContext,
  DebuggerContextData,
  SystemInformationContext,
} from './context';

type Props<TBrowserContext extends BaseBrowserContext> = {
  info: SigilAppRootComponent;
  browser: TBrowserContext;
};

type LoadedLogs = {
  lastLog: number;
  logs: AppRootLogEntry[];
};

export const AppRoot = <TBrowserContext extends BaseBrowserContext>({
  info,
  browser,
}: Props<TBrowserContext>) => {
  const { child, lastLog } = info;
  const { renderComponent, call } = useContext(StageContext);
  const [logs, setLogs] = useState<LoadedLogs>({ lastLog: -1, logs: [] });
  const [debugMode, setDebugMode] = useState(false);

  useEffect(() => {
    if (!debugMode || !call) return;

    const lastLogId = logs.logs[logs.logs.length - 1]?.index ?? -1;

    call<'sigil', SigilComponentCalls, 'app-root-get-logs'>({
      namespace: 'sigil',
      type: 'component-call',
      componentKey: info.key,
      action: 'app-root-get-logs',
      after: lastLogId,
    }).then(({ logs: newLogs }) => {
      if (newLogs.length === 0) return;

      setLogs({
        lastLog,
        logs: [...logs.logs, ...newLogs],
      });
    });
  }, [call, debugMode, info.key, lastLog, logs]);

  const debuggerContext: DebuggerContextData = useMemo(
    () => ({
      logs: logs.logs,
      setDebugMode,
    }),
    [logs.logs],
  );

  return (
    <SystemInformationContext.Provider value={info.system}>
      <BrowserContextProvider browser={browser}>
        <DebuggerContext.Provider value={debuggerContext}>
          <Tooltip.Provider>{child && renderComponent(child)}</Tooltip.Provider>
        </DebuggerContext.Provider>
      </BrowserContextProvider>
    </SystemInformationContext.Provider>
  );
};
