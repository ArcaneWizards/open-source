import z from 'zod';
import {
  AnyComponentProto,
  BaseClientComponentCall,
  BaseClientComponentMessage,
  BaseComponentProto,
} from '@arcanejs/protocol';
import { SIGIL_COLOR, SigilColor } from '@arcanewizards/sigil/frontend/styling';
import { Diff } from '@arcanejs/diff';
import { NetworkInterface } from '@arcanewizards/net-utils';
import { TimecodeMode } from '@arcanewizards/artnet/constants';

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

const INPUT_DEFINITION = z.union([
  INPUT_ARTNET_DEFINITION,
  INPUT_OR_OUTPUT_TCNET_DEFINITION,
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

const GENERATOR_CLOCK_DEFINITION = z.object({
  type: z.literal('clock'),
  speed: z.number(),
});

export type GeneratorClockDefinition = z.infer<
  typeof GENERATOR_CLOCK_DEFINITION
>;

const GENERATOR_DEFINITION = GENERATOR_CLOCK_DEFINITION;

export type GeneratorDefinition = z.infer<typeof GENERATOR_DEFINITION>;

const GENERATOR_CONFIG = z.object({
  name: z.string().optional(),
  color: SIGIL_COLOR.optional(),
  delayMs: z.number().optional(),
  definition: GENERATOR_DEFINITION,
});

export type GeneratorConfig = z.infer<typeof GENERATOR_CONFIG>;

const OUTPUT_DEFINITION = OUTPUT_ARTNET_DEFINITION; // todo expand to other output types in the future

export type OutputDefinition = z.infer<typeof OUTPUT_DEFINITION>;

const INPUT_OR_GENERATOR_INSTANCE_ID = z.object({
  type: z.enum(['input', 'generator']),
  id: z.string().array(),
});

/**
 * Object that can be used to uniquely identify an input or generator instance in the app,
 * including traversing through groups.
 */
export type InputOrGenInstance = z.infer<typeof INPUT_OR_GENERATOR_INSTANCE_ID>;

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
  inputs: z.record(z.string(), INPUT_CONFIG),
  generators: z.record(z.string(), GENERATOR_CONFIG),
  outputs: z.record(z.string(), OUTPUT_CONFIG),
});

export type ToolboxConfig = z.infer<typeof TOOLBOX_CONFIG>;

export const DEFAULT_CONFIG: ToolboxConfig = {
  inputs: {},
  generators: {},
  outputs: {},
};

/* App State */

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
} & (
  | {
      state: 'none';
    }
  | {
      state: 'stopped';
      positionMillis: number;
    }
  | {
      state: 'playing' | 'lagging';
      effectiveStartTimeMillis: number;
      /**
       * 1 = real-time, 2 = twice as fast, 0.5 = half as fast, etc.
       */
      speed: number;
    }
);

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
  errors?: string[];
  warnings?: string[];
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
  errors?: string[];
  warnings?: string[];
  timecode: TimecodeInstance | TimecodeGroup | null;
  /**
   * If applicable, details of any connected clients
   */
  clients?: ConnectedClient[];
};

export type GeneratorState = {
  timecode: TimecodeInstance | null;
};

export type OutputState = {
  status: 'disabled' | 'connecting' | 'error' | 'active';
  errors?: string[];
  warnings?: string[];
  /**
   * If applicable, details of any connected clients
   */
  clients?: ConnectedClient[];
};

export type ApplicationState = {
  inputs: Record<string, InputState>;
  generators: Record<string, GeneratorState>;
  outputs: Record<string, OutputState>;
};

/* Proto */

export const NAMESPACE = 'timecode-toolbox';

export type Namespace = typeof NAMESPACE;

export type ToolboxRootComponent = BaseComponentProto<
  Namespace,
  'toolbox-root'
> & {
  config: ToolboxConfig;
  state: ApplicationState;
};

export type TimecodeToolboxComponent = ToolboxRootComponent;

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

export type TimecodeToolboxComponentCalls = {
  'toolbox-root-get-network-interfaces': {
    call: ToolboxRootGetNetworkInterfaces;
    return: ToolboxRootGetNetworkInterfacesReturn;
  };
};

export type ToolboxRootConfigUpdate = BaseClientComponentMessage<Namespace> & {
  component: 'toolbox-root';
  action: 'update-config';
  diff: Diff<ToolboxConfig>;
};

export type TimecodeToolboxComponentMessage = ToolboxRootConfigUpdate;

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
