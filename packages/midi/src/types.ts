import type { MIDIError } from './errors.js';

export type MIDISupportResponse =
  | {
      supported: true;
      notifications:
        | {
            supported: true;
          }
        | {
            supported: false;
            reason: string;
          };
      virtual:
        | {
            supported: true;
          }
        | {
            supported: false;
            reason: string;
          };
    }
  | {
      supported: false;
      reason: string;
    };

export type MIDIEndpointInfo = {
  name: string;
  portId: number;
};

export type MIDIEndpoints = {
  inputs: MIDIEndpointInfo[];
  outputs: MIDIEndpointInfo[];
};

const MIDI_EVENT_TYPE = Symbol('type');

export type MIDIEvent<Type extends string = string> = {
  readonly [MIDI_EVENT_TYPE]: Type;
  type: Type;
};

export const createMIDIEvent = <Event extends MIDIEvent<string>>(
  event: Omit<Event, typeof MIDI_EVENT_TYPE>,
): Event => {
  return Object.freeze({
    [MIDI_EVENT_TYPE]: event.type,
    ...event,
  } as Event);
};

export type MIDIMessageEvent = MIDIEvent<'message'> & {
  message: number[];
};

export type MIDIEndpointClosedEvent = MIDIEvent<'closed'> & {
  endpoint: MIDIEndpointInfo;
};

export type MIDIErrorEvent = MIDIEvent<'error'> & {
  error: MIDIError;
};

export type MIDIEndpointsChangedEvent = MIDIEvent<'endpointschanged'> & {
  endpoints: MIDIEndpoints;
  added: MIDIEndpoints;
  removed: MIDIEndpoints;
};

export type MIDIEventListener<Event extends MIDIEvent> = (event: Event) => void;

export type MIDIInputEventMap = {
  message: MIDIMessageEvent;
  closed: MIDIEndpointClosedEvent;
  error: MIDIErrorEvent;
};

export type MIDIOutputEventMap = {
  closed: MIDIEndpointClosedEvent;
  error: MIDIErrorEvent;
};

export type MIDIInterfaceEventMap = {
  endpointschanged: MIDIEndpointsChangedEvent;
};

export type MIDIOutput = {
  getInfo(): MIDIEndpointInfo;
  sendMessage(message: number[]): Promise<void>;
  close(): Promise<void>;
  addEventListener<Type extends keyof MIDIOutputEventMap>(
    type: Type,
    listener: MIDIEventListener<MIDIOutputEventMap[Type]>,
  ): void;
  removeEventListener<Type extends keyof MIDIOutputEventMap>(
    type: Type,
    listener: MIDIEventListener<MIDIOutputEventMap[Type]>,
  ): void;
};

export type MIDIInput = {
  getInfo(): MIDIEndpointInfo;
  close(): Promise<void>;
  addEventListener<Type extends keyof MIDIInputEventMap>(
    type: Type,
    listener: MIDIEventListener<MIDIInputEventMap[Type]>,
  ): void;
  removeEventListener<Type extends keyof MIDIInputEventMap>(
    type: Type,
    listener: MIDIEventListener<MIDIInputEventMap[Type]>,
  ): void;
};

export type VirtualPortOptions = {
  manufacturer?: string;
  model?: string;
};

export type MIDIInterface = {
  getSupportInfo(): Promise<MIDISupportResponse>;
  getEndpoints(): Promise<MIDIEndpoints>;
  getInputs(): Promise<MIDIEndpointInfo[]>;
  getOutputs(): Promise<MIDIEndpointInfo[]>;
  openInput(endpoint: MIDIEndpointInfo): Promise<MIDIInput>;
  openOutput(endpoint: MIDIEndpointInfo): Promise<MIDIOutput>;
  createVirtualInput(
    name: string,
    options?: VirtualPortOptions,
  ): Promise<MIDIInput>;
  createVirtualOutput(
    name: string,
    options?: VirtualPortOptions,
  ): Promise<MIDIOutput>;
  addEventListener<Type extends keyof MIDIInterfaceEventMap>(
    type: Type,
    listener: MIDIEventListener<MIDIInterfaceEventMap[Type]>,
  ): void;
  removeEventListener<Type extends keyof MIDIInterfaceEventMap>(
    type: Type,
    listener: MIDIEventListener<MIDIInterfaceEventMap[Type]>,
  ): void;
};
