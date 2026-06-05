import z from 'zod';
import {
  AnyComponentProto,
  BaseClientComponentCall,
  BaseClientComponentCallDownload,
  BaseClientComponentMessage,
  BaseComponentProto,
  BaseNotificationMessage,
} from '@arcanejs/protocol';
import { SIGIL_COLOR, SigilColor } from '@arcanewizards/sigil/frontend/styling';
import { Diff } from '@arcanejs/diff';
import { NetworkInterface } from '@arcanewizards/net-utils';
import { TimecodeMode } from '@arcanewizards/artnet/constants';
import { Tree } from '../tree';
import { CheckForUpdatesResponse } from '@arcanewizards/apis';
import {
  APP_LISTENER_CONFIG,
  ListenerConfig,
} from '@arcanewizards/sigil/shared/config';
import { ToolkitConnection } from '@arcanejs/toolkit';
import type {
  MidiEndpointInfo,
  MIDISupportResponse,
} from '@arcanewizards/midi';

/* Shared config & proto definitions */

const NET_UTILS_GENERAL_TARGET_DEFINITION = z
  .union([
    z.object({
      type: z.literal('host'),
      host: z.string(),
    }),
    z.object({
      type: z.literal('interface'),
      interface: z.string(),
    }),
  ])
  .and(
    z.object({
      port: z.number().optional(),
    }),
  );

// Art-Net Config

const INPUT_ARTNET_DEFINITION = z.object({
  type: z.literal('artnet'),
  iface: z.string(),
  port: z.number().optional(),
});

export type InputArtnetDefinition = z.infer<typeof INPUT_ARTNET_DEFINITION>;

export const isInputArtnetDefinition = (
  definition: InputDefinition,
): definition is InputArtnetDefinition => definition.type === 'artnet';

const OUTPUT_ARTNET_DEFINITION = z.object({
  type: z.literal('artnet'),
  target: NET_UTILS_GENERAL_TARGET_DEFINITION,
  mode: z.enum(['FILM', 'EBU', 'DF', 'SMPTE']),
});

export type OutputArtnetDefinition = z.infer<typeof OUTPUT_ARTNET_DEFINITION>;

export const isOutputArtnetDefinition = (
  definition: OutputDefinition,
): definition is OutputArtnetDefinition => definition.type === 'artnet';

// TCNet Config

const INPUT_OR_OUTPUT_TCNET_DEFINITION = z.object({
  type: z.literal('tcnet'),
  iface: z.string(),
  nodeName: z.string().optional(),
});

export type InputTcnetDefinition = z.infer<
  typeof INPUT_OR_OUTPUT_TCNET_DEFINITION
>;

export const isInputTcnetDefinition = (
  definition: InputDefinition,
): definition is InputTcnetDefinition => definition.type === 'tcnet';

// MIDI Config

const MIDI_TARGET_CONFIG = z.union([
  z.object({
    type: z.literal('port'),
    deviceName: z.string(),
  }),
  z.object({
    type: z.literal('virtual'),
  }),
]);

export type MidiTargetConfig = z.infer<typeof MIDI_TARGET_CONFIG>;

const INPUT_MIDI_DEFINITION = z.object({
  type: z.literal('midi'),
  target: MIDI_TARGET_CONFIG,
});

export type InputMidiDefinition = z.infer<typeof INPUT_MIDI_DEFINITION>;

export const isInputMidiDefinition = (
  definition: InputDefinition,
): definition is InputMidiDefinition => definition.type === 'midi';

const OUTPUT_MIDI_DEFINITION = z.object({
  type: z.literal('midi'),
  target: MIDI_TARGET_CONFIG,
  mode: z.enum(['FILM', 'EBU', 'DF', 'SMPTE']),
});

export type OutputMidiDefinition = z.infer<typeof OUTPUT_MIDI_DEFINITION>;

export const isOutputMidiDefinition = (
  definition: OutputDefinition,
): definition is OutputMidiDefinition => definition.type === 'midi';

// LTC Config

const OUTPUT_LTC_DEFINITION = z.object({
  type: z.literal('ltc'),
  mode: z.enum(['FILM', 'EBU', 'DF', 'SMPTE']),
});

export type OutputLtcDefinition = z.infer<typeof OUTPUT_LTC_DEFINITION>;

export const isOutputLtcDefinition = (
  definition: OutputDefinition,
): definition is OutputLtcDefinition => definition.type === 'ltc';

// Clock

const GENERATOR_CLOCK_DEFINITION_V2 = z.union([
  z.object({
    type: z.literal('clock'),
    mode: z.literal('manual'),
    speed: z.number(),
  }),
  z.object({
    type: z.literal('clock'),
    mode: z.literal('system'),
    timezone: z.string().nullable(),
  }),
]);

export type GeneratorClockDefinition = z.infer<
  typeof GENERATOR_CLOCK_DEFINITION_V2
>;

/**
 * Backwards compatibility for older definitions
 */
const GENERATOR_CLOCK_DEFINITION_V1 = z
  .object({
    type: z.literal('clock'),
    speed: z.number(),
  })
  .transform<GeneratorClockDefinition>((d) => ({
    ...d,
    mode: 'manual',
  }));

const GENERATOR_CLOCK_DEFINITION = z.union([
  GENERATOR_CLOCK_DEFINITION_V1,
  GENERATOR_CLOCK_DEFINITION_V2,
]);

// Player

const GENERATOR_PLAYER_DEFINITION = z.object({
  type: z.literal('player'),
  /**
   * The last file to be loaded into the generator
   */
  filePath: z.string().nullable(),
  speed: z.number(),
  volume: z.number(),
});

export type GeneratorPlayerDefinition = z.infer<
  typeof GENERATOR_PLAYER_DEFINITION
>;

// Inputs

const INPUT_DEFINITION = z.union([
  INPUT_ARTNET_DEFINITION,
  INPUT_OR_OUTPUT_TCNET_DEFINITION,
  INPUT_MIDI_DEFINITION,
]);

export type InputDefinition = z.infer<typeof INPUT_DEFINITION>;

const INPUT_CONFIG = z.object({
  name: z.string().optional(),
  color: SIGIL_COLOR.optional(),
  definition: INPUT_DEFINITION,
  enabled: z.boolean(),
  delayMs: z.number().optional(),
});

export type InputConfig = z.infer<typeof INPUT_CONFIG>;

// Generators

const GENERATOR_DEFINITION = z.union([
  GENERATOR_CLOCK_DEFINITION,
  GENERATOR_PLAYER_DEFINITION,
]);

export type GeneratorDefinition = z.infer<typeof GENERATOR_DEFINITION>;

const GENERATOR_CONFIG = z.object({
  name: z.string().optional(),
  color: SIGIL_COLOR.optional(),
  delayMs: z.number().optional(),
  definition: GENERATOR_DEFINITION,
});

export type GeneratorConfig = z.infer<typeof GENERATOR_CONFIG>;

// Outputs

const OUTPUT_DEFINITION = z.union([
  OUTPUT_ARTNET_DEFINITION,
  OUTPUT_MIDI_DEFINITION,
  OUTPUT_LTC_DEFINITION,
]);

export type OutputDefinition = z.infer<typeof OUTPUT_DEFINITION>;

/**
 * Config that's available for all components
 */
export type UniversalConfig = {
  delayMs?: number | null;
  definition?: InputDefinition | GeneratorDefinition | OutputDefinition;
};

export type UniversalConfigWithDefinition<
  T extends InputDefinition | GeneratorDefinition | OutputDefinition,
> = UniversalConfig & {
  definition: T;
};

export const hasDefinition = <
  T extends InputDefinition | GeneratorDefinition | OutputDefinition,
>(
  config: UniversalConfig | null | undefined,
  guard: (
    definition: InputDefinition | GeneratorDefinition | OutputDefinition,
  ) => definition is T,
): config is UniversalConfigWithDefinition<T> =>
  !!config?.definition && guard(config.definition);

export const isAudioPlayerGenerator = (
  config: UniversalConfig | null | undefined,
): config is UniversalConfigWithDefinition<GeneratorPlayerDefinition> =>
  hasDefinition(config, (d): d is GeneratorPlayerDefinition =>
    d.type === 'player' ? true : false,
  );

export type InputInstanceId = [
  type: 'input',
  rootId: string,
  ...path: string[],
];

export const isInputInstanceId = (value: string[]): value is InputInstanceId =>
  value.length >= 2 && value[0] === 'input';

export const INPUT_INSTANCE_ID = z
  .string()
  .array()
  // TODO: remove type coercion zod/v4
  .refine(isInputInstanceId) as unknown as z.ZodType<InputInstanceId>;

export type GeneratorInstanceId = [
  type: 'generator',
  rootId: string,
  ...path: string[],
];

export const isGeneratorInstanceId = (
  value: string[],
): value is GeneratorInstanceId =>
  value.length >= 2 && value[0] === 'generator';

export const GENERATOR_INSTANCE_ID = z
  .string()
  .array()
  // TODO: remove type coercion zod/v4
  .refine(isGeneratorInstanceId) as unknown as z.ZodType<GeneratorInstanceId>;

export type OutputInstanceId = [
  type: 'output',
  rootId: string,
  ...path: string[],
];

export const isOutputInstanceId = (
  value: string[],
): value is OutputInstanceId => value.length >= 2 && value[0] === 'output';

export const OUTPUT_INSTANCE_ID = z
  .string()
  .array()
  // TODO: remove type coercion zod/v4
  .refine(isOutputInstanceId) as unknown as z.ZodType<OutputInstanceId>;

export const INPUT_OR_GENERATOR_INSTANCE_ID = z.union([
  INPUT_INSTANCE_ID,
  GENERATOR_INSTANCE_ID,
]);

export type InputOrGenInstance = z.infer<typeof INPUT_OR_GENERATOR_INSTANCE_ID>;

export const TIMECODE_INSTANCE_ID = z.union([
  INPUT_INSTANCE_ID,
  GENERATOR_INSTANCE_ID,
  OUTPUT_INSTANCE_ID,
]);

export type TimecodeInstanceId = z.infer<typeof TIMECODE_INSTANCE_ID>;

const OUTPUT_CONFIG = z.object({
  name: z.string().optional(),
  color: SIGIL_COLOR.optional(),
  definition: OUTPUT_DEFINITION,
  enabled: z.boolean(),
  delayMs: z.number().optional(),
  link: INPUT_OR_GENERATOR_INSTANCE_ID.nullable(),
});

export type OutputConfig = z.infer<typeof OUTPUT_CONFIG>;

export const TOOLBOX_CONFIG = z.object({
  appListener: APP_LISTENER_CONFIG.partial().optional(),
  inputs: z.record(z.string(), INPUT_CONFIG),
  generators: z.record(z.string(), GENERATOR_CONFIG),
  outputs: z.record(z.string(), OUTPUT_CONFIG),
  /**
   * Hash of the license the user has agreed to.
   */
  agreedToLicense: z.string().optional(),
  checkForUpdates: z.boolean().optional().default(true),
});

export type ToolboxConfig = z.infer<typeof TOOLBOX_CONFIG>;

export const DEFAULT_CONFIG: ToolboxConfig = {
  inputs: {},
  generators: {},
  outputs: {},
  checkForUpdates: true,
};

/* App State */

export type TimecodePlayStateNone = {
  state: 'none';
};

export type TimecodePlayStateUnloaded = {
  state: 'unloaded';
};

export type TimecodePlayStateStopped = {
  state: 'stopped';
  positionMillis: number;
};

export type TimecodePlayStatePlayingOrLagging = {
  state: 'playing' | 'lagging';
  effectiveStartTimeMillis: number;
  /**
   * 1 = real-time, 2 = twice as fast, 0.5 = half as fast, etc.
   */
  speed: number;
};

export type TimecodePlayState =
  | TimecodePlayStateNone
  | TimecodePlayStateUnloaded
  | TimecodePlayStateStopped
  | TimecodePlayStatePlayingOrLagging;

export const isPlaying = (
  state: TimecodePlayState,
): state is TimecodePlayStatePlayingOrLagging =>
  state.state === 'playing' || state.state === 'lagging';

export const isStopped = (
  state: TimecodePlayState,
): state is TimecodePlayStateStopped => state.state === 'stopped';

export type TimecodeState = {
  /**
   * Approximate accuracy of the timecode, if available
   */
  accuracyMillis: number | null;
  /**
   * SMPTE mode if known and applicable, otherwise null
   */
  smpteMode: TimecodeMode | null;
  /**
   * If supported, whether the source is currently on air
   * (e.g. have a mixer value high enough)
   */
  onAir: boolean | null;
  /**
   * How much delay is currently applied to the timecode, in milliseconds.
   *
   * This is used to account for differences when needing to display relative
   * track time (such as in the timeline for a timecode display).
   */
  appliedDelayMillis: number;
} & TimecodePlayState;

export type TimecodeTotalTime = {
  timeMillis: number;
  /**
   * How accurate is the totalTimeMillis value,
   * some sources (such as ShowKontrol) are not completely accurate.
   */
  precisionMillis: number;
};

export type TimecodeMetadata = {
  /**
   * If available, the total time of the track loaded in this timecode.
   *
   * Some timecode sources will not have this information.
   */
  totalTime: TimecodeTotalTime | null;
  title: string | null;
  artist: string | null;
};

export type TimecodeInstance = {
  name: string | null;
  state: TimecodeState;
  metadata: TimecodeMetadata | null;
};

export const isTimecodeInstance = (
  instance: TimecodeInstance | TimecodeGroup | null,
): instance is TimecodeInstance =>
  instance !== null && 'state' in instance && 'metadata' in instance;

export type TimecodeGroup = {
  name: string | null;
  color: SigilColor | null;
  timecodes: Record<string, TimecodeInstance | TimecodeGroup>;
};

export const isTimecodeGroup = (
  instance: TimecodeInstance | TimecodeGroup | null,
): instance is TimecodeGroup => instance !== null && 'timecodes' in instance;

export type ConnectedClient = {
  name: string;
  host: string;
  port: number;
  protocolVersion: string;
  details: string[];
};

export type InputState = {
  status: 'disabled' | 'connecting' | 'error' | 'active';
  controlledBy: Pick<ToolkitConnection, 'uuid'> | null;
  errors?: string[];
  warnings?: string[];
  timecode: TimecodeInstance | TimecodeGroup | null;
  /**
   * If applicable, details of any connected clients
   */
  clients?: ConnectedClient[];
};

export type GeneratorState = {
  controlledBy: Pick<ToolkitConnection, 'uuid'> | null;
  timecode: TimecodeInstance | null;
  errors?: string[];
  warnings?: string[];
};

export type OutputState = {
  status: 'disabled' | 'connecting' | 'error' | 'active';
  /** Only relevant for LTC outputs */
  controlledBy: Pick<ToolkitConnection, 'uuid'> | null;
  errors?: string[];
  warnings?: string[];
  /**
   * If applicable, details of any connected clients
   */
  clients?: ConnectedClient[];
};

export type UpdateCheckResult =
  | {
      type: 'loading';
    }
  | {
      type: 'updates-available';
      response: CheckForUpdatesResponse;
      lastCheckedMillis: number;
    }
  | {
      type: 'up-to-date';
      lastCheckedMillis: number;
    }
  | {
      type: 'error';
      error: string;
      lastCheckedMillis: number;
    };

export type ApplicationState = {
  inputs: Record<string, InputState>;
  generators: Record<string, GeneratorState>;
  outputs: Record<string, OutputState>;
  updates: UpdateCheckResult | null;
};

export type TimecodeHandlerMethods = {
  play?: () => void;
  pause?: () => void;
  seekRelative?: (deltaMillis: number) => void;
  seekAbsolute?: (positionMillis: number) => void;
  beginning?: () => void;
  clear?: () => void;
};

export type AvailableHandlers = Partial<
  Record<keyof TimecodeHandlerMethods, true>
>;

/* Proto */

export const NAMESPACE = 'timecode-toolbox';

export type Namespace = typeof NAMESPACE;

export type ToolboxRootComponent = BaseComponentProto<
  Namespace,
  'toolbox-root'
> & {
  license: string;
  config: ToolboxConfig;
  state: ApplicationState;
  handlers: Tree<AvailableHandlers>;
  network: {
    /**
     * If the PORT environment variable is set,
     * this will be set to that value.
     */
    envPort: number | null;
    defaultPort: ListenerConfig['port'];
  };
};

export type ToolboxLicenseGateComponent = BaseComponentProto<
  Namespace,
  'license-gate'
> & {
  license: string;
  hash: string;
};

export type TimecodeToolboxComponent =
  | ToolboxRootComponent
  | ToolboxLicenseGateComponent;

export const isTimecodeToolboxComponent = (
  component: AnyComponentProto,
): component is TimecodeToolboxComponent => component.namespace === NAMESPACE;

export type ToolboxRootGetNetworkInterfaces = BaseClientComponentCall<
  Namespace,
  'toolbox-root-get-network-interfaces'
>;

export type ToolboxRootGetNetworkInterfacesReturn = Record<
  string,
  NetworkInterface
>;

export type ToolboxRootGetMidiDevices = BaseClientComponentCall<
  Namespace,
  'toolbox-root-get-midi-devices'
>;

export type ToolboxRootGetMidiDevicesReturn = {
  inputs: MidiEndpointInfo[];
  outputs: MidiEndpointInfo[];
};

export type ToolboxRootGetMidiSupportInfo = BaseClientComponentCall<
  Namespace,
  'toolbox-root-get-midi-support-info'
>;

export type ToolboxRootGetMidiSupportInfoReturn = MIDISupportResponse;

export type ToolboxRootGetTimezoneInfo = BaseClientComponentCall<
  Namespace,
  'toolbox-root-get-timezone-info'
>;

export type ToolboxRootGetTimezoneInfoReturn = {
  systemTimezone: string;
  timezones: Array<{
    name: string;
  }>;
};

export type ToolboxRootCallHandler<
  H extends keyof AvailableHandlers = keyof AvailableHandlers,
> = BaseClientComponentCall<Namespace, 'toolbox-root-call-handler'> & {
  path: string[];
  handler: H;
  args: Parameters<NonNullable<TimecodeHandlerMethods[H]>>;
};

export type ToolboxRootCallHandlerReturn = void;

export type TimecodeToolboxComponentCalls = {
  'toolbox-root-get-network-interfaces': {
    call: ToolboxRootGetNetworkInterfaces;
    return: ToolboxRootGetNetworkInterfacesReturn;
  };
  'toolbox-root-get-midi-devices': {
    call: ToolboxRootGetMidiDevices;
    return: ToolboxRootGetMidiDevicesReturn;
  };
  'toolbox-root-get-midi-support-info': {
    call: ToolboxRootGetMidiSupportInfo;
    return: ToolboxRootGetMidiSupportInfoReturn;
  };
  'toolbox-root-get-timezone-info': {
    call: ToolboxRootGetTimezoneInfo;
    return: ToolboxRootGetTimezoneInfoReturn;
  };
  'toolbox-root-call-handler': {
    call: ToolboxRootCallHandler;
    return: ToolboxRootCallHandlerReturn;
  };
};

export type ToolboxRootConfigUpdate = BaseClientComponentMessage<Namespace> & {
  component: 'toolbox-root';
  action: 'update-config';
  diff: Diff<ToolboxConfig>;
};

export type ToolboxLicenseGateAcceptLicense =
  BaseClientComponentMessage<Namespace> & {
    component: 'license-gate';
    action: 'accept-license';
    hash: string;
  };

export type ToolboxRootUpdatePlayerState =
  BaseClientComponentMessage<Namespace> & {
    component: 'toolbox-root';
    action: 'update-player-state';
    generatorUuid: string;
    /**
     * True if this connection should claim control of the player if it
     * is not already controlled by this connection.
     */
    claim: boolean;
    state: Omit<GeneratorState, 'controlledBy'>;
  };

export type ToolboxRootUpdateOutputState =
  BaseClientComponentMessage<Namespace> & {
    component: 'toolbox-root';
    action: 'update-output-state';
    outputUuid: string;
    /**
     * True if this connection should claim control of the output if it
     * is not already controlled by this connection.
     */
    claim: boolean;
    state: Omit<OutputState, 'controlledBy'>;
  };

export type ToolboxRootReleaseControl =
  BaseClientComponentMessage<Namespace> & {
    component: 'toolbox-root';
    action: 'release-control';
    id: TimecodeInstanceId;
  };

export type TimecodeToolboxComponentMessage =
  | ToolboxRootConfigUpdate
  | ToolboxLicenseGateAcceptLicense
  | ToolboxRootUpdatePlayerState
  | ToolboxRootUpdateOutputState
  | ToolboxRootReleaseControl;

export type TimecodeToolboxDownloadAudioFile = BaseClientComponentCallDownload<
  Namespace,
  'toolbox-root-download-audio-file'
> & {
  generatorUuid: string;
};

export type TimecodeToolboxComponentCallDownload =
  TimecodeToolboxDownloadAudioFile;

export type TimecodeToolboxControlPlaybackRequest = BaseNotificationMessage<
  Namespace,
  'control-playback'
> & {
  generatorUuid: string;
  action:
    | {
        type: 'play' | 'pause' | 'beginning';
      }
    | {
        type: 'seekRelative';
        deltaMillis: number;
      }
    | {
        type: 'seekAbsolute';
        positionMillis: number;
      };
};

export type TimecodeToolboxNotification = TimecodeToolboxControlPlaybackRequest;

export const isTimecodeToolboxComponentMessage = <
  C extends TimecodeToolboxComponentMessage['component'],
>(
  message: BaseClientComponentMessage<string>,
  component: C,
): message is TimecodeToolboxComponentMessage & { component: C } =>
  message.namespace === NAMESPACE &&
  (message as TimecodeToolboxComponentMessage).component === component;

export const isTimecodeToolboxComponentCall = <
  A extends keyof TimecodeToolboxComponentCalls,
>(
  call: BaseClientComponentCall<string, string>,
  action: A,
): call is TimecodeToolboxComponentCalls[A]['call'] =>
  call.namespace === NAMESPACE && call.action === action;

export const isTimecodeToolboxComponentCallDownload = <
  A extends TimecodeToolboxComponentCallDownload['action'],
>(
  call: BaseClientComponentCallDownload<string, string>,
  action: A,
): call is TimecodeToolboxComponentCallDownload =>
  call.namespace === NAMESPACE && call.action === action;

export const isTimecodeToolboxNotification = (
  message: BaseNotificationMessage<string, string>,
  notification: TimecodeToolboxNotification['notification'],
): message is TimecodeToolboxNotification =>
  message.namespace === NAMESPACE &&
  (message as TimecodeToolboxNotification).notification === notification;

export const isTimecodeToolboxControlPlaybackRequest = (
  message: BaseNotificationMessage<string, string>,
) => isTimecodeToolboxNotification(message, 'control-playback');
