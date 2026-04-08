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

export type Events = {
  acceptLicense: (hash: string) => void;
};

export type AppRootProps = Pick<
  ToolboxLicenseGateComponent,
  'license' | 'hash'
> & {
  onAcceptLicense?: Events['acceptLicense'];
};

const DEFAULT_PROPS: AppRootProps = {
  license: '',
  hash: '',
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
      license: this.props.license,
      hash: this.props.hash,
    };
  }

  /** @hidden */
  public handleMessage = (message: AnyClientComponentMessage) => {
    if (isTimecodeToolboxComponentMessage(message, 'license-gate')) {
      if (message.action === 'accept-license') {
        this.events.emit('acceptLicense', message.hash);
      }
    }
  };
}
