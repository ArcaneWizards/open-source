export { AppRoot as SigilAppRoot } from './frontend/app-root';
export {
  BrowserContext,
  BrowserContextProvider,
  createDefaultBrowserContext,
  useBrowserContext,
} from './frontend/browser-context';
export type {
  BaseBrowserContext,
  NewWindowOptions,
  MediaMetadata,
  MediaPlayState,
  MediaSessionAction,
  MediaSessionControl,
  MediaSessionHandler,
} from './frontend/browser-context';
export { Debugger } from './frontend/debugger';
export {
  createSigilFrontendRenderer,
  startSigilFrontend,
} from './frontend/index';
export type { StartSigilFrontendOptions } from './frontend/index';
export { createBrowserMediaSession } from './frontend/media-session';
export {
  DebuggerContext,
  SystemInformationContext,
  useDebuggerContext,
  useSystemInformation,
} from './frontend/context';
export type {
  AppRootGetLogs,
  AppRootGetLogsArgs,
  AppRootGetLogsReturn,
  SigilAppRootComponent,
  SigilComponent,
  SigilComponentCalls,
} from './backend/proto';
export {
  isSigilComponent,
  isSigilComponentCall,
  SIGIL_NAMESPACE,
} from './backend/proto';
export type {
  AppRootLogEntry,
  AppRootLogEntryStackFrame,
  SystemInformation,
} from './shared/types';
