import { JSONValue } from '@arcanejs/diff';

export type AppRootLogEntryStackFrame = {
  message: string;
  stack: string | null;
  cause: AppRootLogEntryStackFrame | null;
} & Record<string, JSONValue>;

export type AppRootLogEntry = {
  index: number;
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  stack?: AppRootLogEntryStackFrame;
};

export type SystemInformation = {
  os: string;
  version: string;
  appPath: string;
  cwd: string;
  dataDirectory: string;
};
