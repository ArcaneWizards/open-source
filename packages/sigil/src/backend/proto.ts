import {
  AnyComponentProto,
  BaseClientComponentCall,
  BaseComponentProto,
} from '@arcanejs/protocol';
import { AppRootLogEntry, SystemInformation } from '../shared/types';

export const SIGIL_NAMESPACE = 'sigil';

export type SigilNamespace = typeof SIGIL_NAMESPACE;

export type SigilAppRootComponent = BaseComponentProto<
  SigilNamespace,
  'app-root'
> & {
  child: AnyComponentProto | null;
  /**
   * Timestamp of last log entry.
   * Used to trigger log polling when the frontend debugger is active.
   */
  lastLog: number;
  system: SystemInformation;
};

export type SigilComponent = SigilAppRootComponent;

export const isSigilComponent = (
  component: AnyComponentProto,
): component is SigilComponent => component.namespace === SIGIL_NAMESPACE;

export type AppRootGetLogsArgs = {
  after: number;
};

export type AppRootGetLogsReturn = {
  logs: AppRootLogEntry[];
};

export type AppRootGetLogs = BaseClientComponentCall<
  SigilNamespace,
  'app-root-get-logs'
> &
  AppRootGetLogsArgs;

export type SigilComponentCalls = {
  'app-root-get-logs': {
    call: AppRootGetLogs;
    return: AppRootGetLogsReturn;
  };
};

export type SigilComponentMessage = never;

export const isSigilComponentCall = <A extends keyof SigilComponentCalls>(
  call: BaseClientComponentCall<string, string>,
  action: A,
): call is SigilComponentCalls[A]['call'] =>
  call.namespace === SIGIL_NAMESPACE && call.action === action;
