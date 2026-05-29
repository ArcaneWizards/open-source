import type { MidiEndpointInfo } from './types.js';

export type MIDIErrorCode =
  | 'ERR_MIDI_NOT_SUPPORTED'
  | 'ERR_MIDI_NOT_IMPLEMENTED'
  | 'ERR_MIDI_ENDPOINT_CLOSED'
  | 'ERR_MIDI_INVALID_ARGUMENT'
  | 'ERR_MIDI_ENDPOINT_NOT_FOUND'
  | 'ERR_MIDI_NATIVE';

export type MIDIErrorOptions = {
  cause?: unknown;
};

export class MIDIError extends Error {
  readonly code: MIDIErrorCode;

  constructor(
    code: MIDIErrorCode,
    message: string,
    options: MIDIErrorOptions = {},
  ) {
    super(message, options);
    this.name = 'MIDIError';
    this.code = code;
  }
}

export class MIDINotSupportedError extends MIDIError {
  constructor(message: string, options?: MIDIErrorOptions) {
    super('ERR_MIDI_NOT_SUPPORTED', message, options);
    this.name = 'MIDINotSupportedError';
  }
}

export class MIDINotImplementedError extends MIDIError {
  constructor(message: string, options?: MIDIErrorOptions) {
    super('ERR_MIDI_NOT_IMPLEMENTED', message, options);
    this.name = 'MIDINotImplementedError';
  }
}

export class MIDIEndpointClosedError extends MIDIError {
  readonly endpoint: MidiEndpointInfo | undefined;

  constructor(
    message: string,
    options: MIDIErrorOptions & {
      endpoint?: MidiEndpointInfo;
    } = {},
  ) {
    super('ERR_MIDI_ENDPOINT_CLOSED', message, options);
    this.name = 'MIDIEndpointClosedError';
    this.endpoint = options.endpoint;
  }
}

export class MIDIInvalidArgumentError extends MIDIError {
  readonly argument: string | undefined;

  constructor(
    message: string,
    options: MIDIErrorOptions & {
      argument?: string;
    } = {},
  ) {
    super('ERR_MIDI_INVALID_ARGUMENT', message, options);
    this.name = 'MIDIInvalidArgumentError';
    this.argument = options.argument;
  }
}

export class MIDIEndpointNotFoundError extends MIDIError {
  readonly endpoint: MidiEndpointInfo | undefined;

  constructor(
    message: string,
    options: MIDIErrorOptions & {
      endpoint?: MidiEndpointInfo;
    } = {},
  ) {
    super('ERR_MIDI_ENDPOINT_NOT_FOUND', message, options);
    this.name = 'MIDIEndpointNotFoundError';
    this.endpoint = options.endpoint;
  }
}

export class MIDINativeError extends MIDIError {
  readonly operation: string | undefined;
  readonly status: number | string | undefined;

  constructor(
    message: string,
    options: MIDIErrorOptions & {
      operation?: string;
      status?: number | string;
    } = {},
  ) {
    super('ERR_MIDI_NATIVE', message, options);
    this.name = 'MIDINativeError';
    this.operation = options.operation;
    this.status = options.status;
  }
}

export const toMIDINativeError = (
  error: unknown,
  message: string,
  operation?: string,
) => {
  if (error instanceof MIDIError) {
    return error;
  }

  return new MIDINativeError(message, {
    cause: error,
    operation,
  });
};
