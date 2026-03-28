import { AnyClientComponentCall } from '@arcanejs/protocol';
import {
  AnyComponent,
  BaseParent,
  EventEmitter,
} from '@arcanejs/toolkit/components/base';
import { prepareComponents } from '@arcanejs/react-toolkit';
import { ToolkitRenderContext } from '@arcanejs/toolkit';
import { IDMap } from '@arcanejs/toolkit/util';
import {
  AppRootGetLogsArgs,
  AppRootGetLogsReturn,
  isSigilComponentCall,
  SIGIL_NAMESPACE,
  SigilAppRootComponent,
  SigilComponentCalls,
  SigilNamespace,
} from './proto';

export type AppRootEvents = {
  getLogs: (args: AppRootGetLogsArgs) => Promise<AppRootGetLogsReturn>;
};

export type AppRootProps = Pick<SigilAppRootComponent, 'lastLog' | 'system'> & {
  onGetLogs?: AppRootEvents['getLogs'];
};

const DEFAULT_PROPS: AppRootProps = {
  lastLog: -1,
  system: {
    version: 'unknown',
    appPath: 'unknown',
    cwd: 'unknown',
    os: 'unknown',
    dataDirectory: 'unknown',
  },
};

type SupportedCalls = 'app-root-get-logs';

export class AppRoot extends BaseParent<
  SigilNamespace,
  SigilAppRootComponent,
  AppRootProps,
  SigilComponentCalls,
  SupportedCalls
> {
  private readonly events = new EventEmitter<AppRootEvents>();

  public constructor(props: AppRootProps) {
    super(DEFAULT_PROPS, props, {
      onPropsUpdated: (oldProps) =>
        this.events.processPropChanges(
          {
            onGetLogs: 'getLogs',
          },
          oldProps,
          this.props,
        ),
    });
    this.triggerInitialPropsUpdate();
  }

  addListener = this.events.addListener;
  removeListener = this.events.removeListener;

  public validateChildren = (children: AnyComponent[]) => {
    if (children.length > 1) {
      throw new Error('Sigil AppRoot can only have one child');
    }
  };

  public getProtoInfo(
    idMap: IDMap,
    context: ToolkitRenderContext,
  ): SigilAppRootComponent {
    return {
      namespace: SIGIL_NAMESPACE,
      component: 'app-root',
      key: idMap.getId(this),
      child:
        this.getChildren()
          .slice(0, 1)
          .map((child) => child.getProtoInfo(idMap, context))[0] ?? null,
      lastLog: this.props.lastLog,
      system: this.props.system,
    };
  }

  public handleCall = async (call: AnyClientComponentCall) => {
    if (isSigilComponentCall(call, 'app-root-get-logs')) {
      return this.events.call('getLogs', { after: call.after });
    }
    throw new Error(`Unhandled call action: ${call.action}`);
  };
}

export const SIGIL_COMPONENTS = prepareComponents(SIGIL_NAMESPACE, {
  AppRoot,
});
