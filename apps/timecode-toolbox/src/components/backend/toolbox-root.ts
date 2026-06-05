import { IDMap } from '@arcanejs/toolkit/util';
import { Diff } from '@arcanejs/diff';

import {
  Base,
  CallDownloadResponse,
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
  TimecodeToolboxComponentCallDownload,
  isTimecodeToolboxComponentCallDownload,
  ToolboxRootUpdatePlayerState,
  ToolboxRootGetTimezoneInfoReturn,
  TimecodeInstanceId,
  ToolboxRootUpdateOutputState,
} from '../proto';
import {
  AnyClientComponentCall,
  AnyClientComponentCallDownload,
  AnyClientComponentMessage,
} from '@arcanejs/protocol';
import { getNetworkInterfaces } from '@arcanewizards/net-utils';
import { ToolkitConnection } from '@arcanejs/toolkit';
import { midi } from '@arcanewizards/midi';

export type Events = {
  updateConfig: (diff: Diff<ToolboxConfig>) => void;
  callHandler: (call: ToolboxRootCallHandler) => Promise<void>;
  downloadAudioFile: (
    call: TimecodeToolboxComponentCallDownload,
  ) => Promise<ReturnType<CallDownloadResponse>>;
  updatePlayerState: (
    call: ToolboxRootUpdatePlayerState,
    connection: ToolkitConnection,
  ) => void;
  updateOutputState: (
    call: ToolboxRootUpdateOutputState,
    connection: ToolkitConnection,
  ) => void;
  releaseControl: (
    id: TimecodeInstanceId,
    connection: ToolkitConnection,
  ) => void;
};

export type AppRootProps = Pick<
  ToolboxRootComponent,
  'config' | 'state' | 'handlers' | 'license' | 'network'
> & {
  onUpdateConfig?: Events['updateConfig'];
  onCallHandler?: Events['callHandler'];
  onDownloadAudioFile?: Events['downloadAudioFile'];
  onUpdatePlayerState?: Events['updatePlayerState'];
  onUpdateOutputState?: Events['updateOutputState'];
  onReleaseControl?: Events['releaseControl'];
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
  network: {
    envPort: null,
    defaultPort: -1,
  },
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
            onDownloadAudioFile: 'downloadAudioFile',
            onUpdatePlayerState: 'updatePlayerState',
            onUpdateOutputState: 'updateOutputState',
            onReleaseControl: 'releaseControl',
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
      network: this.props.network,
    };
  }

  /** @hidden */
  public handleMessage = (
    message: AnyClientComponentMessage,
    connection: ToolkitConnection,
  ) => {
    if (isTimecodeToolboxComponentMessage(message, 'toolbox-root')) {
      if (message.action === 'update-config') {
        this.events.emit('updateConfig', message.diff);
      } else if (message.action === 'update-player-state') {
        this.events.emit('updatePlayerState', message, connection);
      } else if (message.action === 'update-output-state') {
        this.events.emit('updateOutputState', message, connection);
      } else if (message.action === 'release-control') {
        this.events.emit('releaseControl', message.id, connection);
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
      isTimecodeToolboxComponentCall(call, 'toolbox-root-get-midi-devices')
    ) {
      const m = midi();

      const [outputs, inputs] = await Promise.all([
        m.getOutputs(),
        m.getInputs(),
      ]);

      return {
        inputs,
        outputs,
      };
    } else if (
      isTimecodeToolboxComponentCall(call, 'toolbox-root-get-midi-support-info')
    ) {
      return midi().getSupportInfo();
    } else if (
      isTimecodeToolboxComponentCall(call, 'toolbox-root-get-timezone-info')
    ) {
      const systemTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return {
        systemTimezone,
        timezones: Intl.supportedValuesOf('timeZone').map((name) => ({ name })),
      } satisfies ToolboxRootGetTimezoneInfoReturn;
    } else if (
      isTimecodeToolboxComponentCall(call, 'toolbox-root-call-handler')
    ) {
      const result = await this.events.emit('callHandler', call);
      if (result.length === 1) {
        return result[0];
      }
      throw new Error(`No handler for callHandler`);
    }
    throw new Error(`Unhandled call action: ${call.action}`);
  };

  /** @hidden */
  public async handleCallDownload(
    call: AnyClientComponentCallDownload,
  ): Promise<CallDownloadResponse> {
    if (
      isTimecodeToolboxComponentCallDownload(
        call,
        'toolbox-root-download-audio-file',
      )
    ) {
      return async () => await this.events.call('downloadAudioFile', call);
    }
    throw new Error(`Unhandled call action: ${call.action}`);
  }
}
