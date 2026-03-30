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
} from '../proto';
import {
  AnyClientComponentCall,
  AnyClientComponentMessage,
} from '@arcanejs/protocol';
import { getNetworkInterfaces } from '@arcanewizards/net-utils';

export type Events = {
  updateConfig: (diff: Diff<ToolboxConfig>) => void;
};

export type AppRootProps = Pick<
  ToolboxRootComponent,
  'config' | 'state' | 'handlers'
> & {
  onUpdateConfig?: Events['updateConfig'];
};

const DEFAULT_PROPS: AppRootProps = {
  config: DEFAULT_CONFIG,
  state: {
    inputs: {},
    outputs: {},
    generators: {},
  },
  handlers: { children: {} },
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
    }
    throw new Error(`Unhandled call action: ${call.action}`);
  };
}
