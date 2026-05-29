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

export type MidiEndpointInfo = {
  name: string;
  portId: number;
};

export type MidiEndpoints = {
  inputs: MidiEndpointInfo[];
  outputs: MidiEndpointInfo[];
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
  endpoint: MidiEndpointInfo;
};

export type MIDIErrorEvent = MIDIEvent<'error'> & {
  error: MIDIError;
};

export type MIDIEndpointsChangedEvent = MIDIEvent<'endpointschanged'> & {
  endpoints: MidiEndpoints;
  added: MidiEndpoints;
  removed: MidiEndpoints;
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
  getInfo(): MidiEndpointInfo;
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
  getInfo(): MidiEndpointInfo;
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
  getEndpoints(): Promise<MidiEndpoints>;
  getInputs(): Promise<MidiEndpointInfo[]>;
  getOutputs(): Promise<MidiEndpointInfo[]>;
  openInput(endpoint: MidiEndpointInfo): Promise<MIDIInput>;
  openOutput(endpoint: MidiEndpointInfo): Promise<MIDIOutput>;
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
