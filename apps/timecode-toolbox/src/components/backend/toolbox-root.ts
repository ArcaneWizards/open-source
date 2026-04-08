import { IDMap } from '@arcanejs/toolkit/util';
import { Diff } from '@arcanejs/diff';

import {
  Base,
  EventEmitter,
  Listenable,
} from '@arcanejs/toolkit/components/base';
import {
  TimecodeToolboxComponentCalls,
  Namespace,
  ToolboxRootComponent,
  ToolboxConfig,
  isTimecodeToolboxComponentMessage,
  DEFAULT_CONFIG,
  isTimecodeToolboxComponentCall,
  ToolboxRootCallHandler,
} from '../proto';
import {
  AnyClientComponentCall,
  AnyClientComponentMessage,
} from '@arcanejs/protocol';
import { getNetworkInterfaces } from '@arcanewizards/net-utils';

export type Events = {
  updateConfig: (diff: Diff<ToolboxConfig>) => void;
  callHandler: (call: ToolboxRootCallHandler) => Promise<void>;
};

export type AppRootProps = Pick<
  ToolboxRootComponent,
  'config' | 'state' | 'handlers' | 'license'
> & {
  onUpdateConfig?: Events['updateConfig'];
  onCallHandler?: Events['callHandler'];
};

const DEFAULT_PROPS: AppRootProps = {
  config: DEFAULT_CONFIG,
  state: {
    inputs: {},
    outputs: {},
    generators: {},
    updates: null,
  },
  handlers: { children: {} },
  license: '',
};

export class ToolboxRoot
  extends Base<
    Namespace,
    ToolboxRootComponent,
    AppRootProps,
    TimecodeToolboxComponentCalls
  >
  implements Listenable<Events>
{
  /** @hidden */
  private readonly events = new EventEmitter<Events>();

  public constructor(props: AppRootProps) {
    super(DEFAULT_PROPS, props, {
      onPropsUpdated: (oldProps) =>
        this.events.processPropChanges(
          {
            onUpdateConfig: 'updateConfig',
            onCallHandler: 'callHandler',
          },
          oldProps,
          this.props,
        ),
    });
    this.triggerInitialPropsUpdate();
  }

  addListener = this.events.addListener;
  removeListener = this.events.removeListener;

  /** @hidden */
  public getProtoInfo(idMap: IDMap): ToolboxRootComponent {
    return {
      namespace: 'timecode-toolbox',
      component: 'toolbox-root',
      key: idMap.getId(this),
      config: this.props.config,
      state: this.props.state,
      handlers: this.props.handlers,
      license: this.props.license,
    };
  }

  /** @hidden */
  public handleMessage = (message: AnyClientComponentMessage) => {
    if (isTimecodeToolboxComponentMessage(message, 'toolbox-root')) {
      if (message.action === 'update-config') {
        this.events.emit('updateConfig', message.diff);
      }
    }
  };

  /** @hidden */
  public handleCall = async (call: AnyClientComponentCall) => {
    if (
      isTimecodeToolboxComponentCall(
        call,
        'toolbox-root-get-network-interfaces',
      )
    ) {
      return getNetworkInterfaces();
    } else if (
      isTimecodeToolboxComponentCall(call, 'toolbox-root-call-handler')
    ) {
      const result = await this.events.emit('callHandler', call);
      if (result[0]) {
        return result[0];
      }
      throw new Error(`No handler for callHandler`);
    }
    throw new Error(`Unhandled call action: ${call.action}`);
  };
}
