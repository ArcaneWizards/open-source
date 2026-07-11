import { IDMap } from '@arcanejs/toolkit/util';

import {
  Base,
  EventEmitter,
  Listenable,
} from '@arcanejs/toolkit/components/base';
import {
  TimecodeToolboxComponentCalls,
  Namespace,
  isTimecodeToolboxComponentMessage,
  ToolboxLicenseGateComponent,
} from '../proto';
import { AnyClientComponentMessage } from '@arcanejs/protocol';
import { prepareUserActionsState } from '@arcanewizards/sigil/frontend/user-actions';

export type Events = {
  acceptLicense: () => void;
};

export type AppRootProps = Pick<ToolboxLicenseGateComponent, 'eula'> & {
  onAcceptLicense?: Events['acceptLicense'];
};

const DEFAULT_PROPS: AppRootProps = {
  eula: prepareUserActionsState({ type: 'loading' }),
};

export class LicenseGate
  extends Base<
    Namespace,
    ToolboxLicenseGateComponent,
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
            onAcceptLicense: 'acceptLicense',
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
  public getProtoInfo(idMap: IDMap): ToolboxLicenseGateComponent {
    return {
      namespace: 'timecode-toolbox',
      component: 'license-gate',
      key: idMap.getId(this),
      eula: this.props.eula,
    };
  }

  /** @hidden */
  public handleMessage = (message: AnyClientComponentMessage) => {
    if (isTimecodeToolboxComponentMessage(message, 'license-gate')) {
      if (message.action === 'accept-license') {
        this.events.emit('acceptLicense');
      }
    }
  };
}
