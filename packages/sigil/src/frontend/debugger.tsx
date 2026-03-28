import { FC, ReactNode, useCallback, useEffect, useRef } from 'react';
import { useBrowserContext } from './browser-context';
import { useDebuggerContext, useSystemInformation } from './context';
import { AppRootLogEntryStackFrame } from '../shared/types';
import { ToolbarDivider, ToolbarRow, ToolbarWrapper } from './toolbars';
import { ControlButton } from './controls';
import { cn } from '@arcanejs/toolkit-frontend/util';
import { cnd } from './styling';

const TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  fractionalSecondDigits: 3,
});

const unwrapErrorStack = (error: AppRootLogEntryStackFrame): string => {
  let stack = `${error.message}\n${error.stack ?? ''}`;
  if (error.cause) {
    stack += `\nCaused by: ${unwrapErrorStack(error.cause)}`;
  }
  return stack;
};

export type DebuggerProps = {
  title: ReactNode;
  className?: string;
};

export const Debugger: FC<DebuggerProps> = ({ title, className }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldScrollToBottom = useRef(true);
  const { openDevTools } = useBrowserContext();
  const { setDebugMode, logs } = useDebuggerContext();
  const system = useSystemInformation();

  useEffect(() => {
    setDebugMode(true);
    return () => {
      setDebugMode(false);
    };
  }, [setDebugMode]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    shouldScrollToBottom.current =
      scrollTop + clientHeight >= scrollHeight - 10;
  };

  const scrollToBottomIfRequired = useCallback(() => {
    if (shouldScrollToBottom.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(scrollToBottomIfRequired, [logs, scrollToBottomIfRequired]);

  useEffect(() => {
    window.addEventListener('resize', scrollToBottomIfRequired);
    return () => {
      window.removeEventListener('resize', scrollToBottomIfRequired);
    };
  }, [scrollToBottomIfRequired]);

  const exportLogs = useCallback(() => {
    const logText = JSON.stringify({ system, logs }, null, 2);
    const blob = new Blob([logText], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sigil-logs-${new Date().toISOString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [system, logs]);

  const handleRequestScrollToBottom = useCallback(() => {
    shouldScrollToBottom.current = true;
    scrollToBottomIfRequired();
  }, [scrollToBottomIfRequired]);

  return (
    <div className={cn('flex flex-col', className)}>
      <ToolbarWrapper>
        <ToolbarRow>
          <span className="grow px-1">{title}</span>
          <ToolbarDivider />
          {openDevTools && (
            <ControlButton
              onClick={openDevTools}
              variant="toolbar"
              icon="build"
            >
              Open Dev Tools
            </ControlButton>
          )}
          <ControlButton
            onClick={handleRequestScrollToBottom}
            variant="toolbar"
            icon="south"
          >
            Scroll to Bottom
          </ControlButton>
          <ControlButton onClick={exportLogs} variant="toolbar" icon="publish">
            Export Logs
          </ControlButton>
        </ToolbarRow>
      </ToolbarWrapper>
      <pre
        className="
          m-0 overflow-x-auto border-b border-sigil-border bg-sigil-bg-dark p-2
          scrollbar-sigil
        "
      >
        {`OS: ${system.os}\nVersion: ${system.version}\nApp Path: ${system.appPath}\nCWD: ${system.cwd}\nData Directory: ${system.dataDirectory}`}
      </pre>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto scrollbar-sigil"
      >
        {logs.map((log) => (
          <div key={log.index} className="px-arcane whitespace-pre-wrap">
            <p>
              {TIME_FORMATTER.format(log.timestamp)}
              {' - '}
              <span
                className={cn(
                  cnd(log.level === 'error', 'text-sigil-usage-red-foreground'),
                  cnd(
                    log.level === 'warn',
                    'text-sigil-usage-yellow-foreground',
                  ),
                  cnd(log.level === 'info', 'text-sigil-usage-blue-foreground'),
                )}
              >
                {log.level}
              </span>
              {' - '}
              {log.message}
            </p>
            {log.stack && (
              <pre className="m-0 ml-2">{unwrapErrorStack(log.stack)}</pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
