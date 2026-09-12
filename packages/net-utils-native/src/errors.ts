import type { LocalNetworkBrowseError } from './types.js';

export type LocalNetworkErrorCode =
  | 'ERR_LOCAL_NETWORK_NOT_SUPPORTED'
  | 'ERR_LOCAL_NETWORK_DENIED'
  | 'ERR_LOCAL_NETWORK_INVALID_ARGUMENT'
  | 'ERR_LOCAL_NETWORK_NATIVE';

export type LocalNetworkErrorOptions = {
  cause?: unknown;
};

export class LocalNetworkError extends Error {
  readonly code: LocalNetworkErrorCode;

  constructor(
    code: LocalNetworkErrorCode,
    message: string,
    options: LocalNetworkErrorOptions = {},
  ) {
    super(message, options);
    this.name = 'LocalNetworkError';
    this.code = code;
  }
}

export class LocalNetworkNotSupportedError extends LocalNetworkError {
  constructor(message: string, options?: LocalNetworkErrorOptions) {
    super('ERR_LOCAL_NETWORK_NOT_SUPPORTED', message, options);
    this.name = 'LocalNetworkNotSupportedError';
  }
}

export class LocalNetworkDeniedError extends LocalNetworkError {
  readonly errors: LocalNetworkBrowseError[];

  constructor(
    message: string,
    options: LocalNetworkErrorOptions & {
      errors?: LocalNetworkBrowseError[];
    } = {},
  ) {
    super('ERR_LOCAL_NETWORK_DENIED', message, options);
    this.name = 'LocalNetworkDeniedError';
    this.errors = options.errors ?? [];
  }
}

export class LocalNetworkInvalidArgumentError extends LocalNetworkError {
  readonly argument: string | undefined;

  constructor(
    message: string,
    options: LocalNetworkErrorOptions & {
      argument?: string;
    } = {},
  ) {
    super('ERR_LOCAL_NETWORK_INVALID_ARGUMENT', message, options);
    this.name = 'LocalNetworkInvalidArgumentError';
    this.argument = options.argument;
  }
}

export class LocalNetworkNativeError extends LocalNetworkError {
  readonly operation: string | undefined;

  constructor(
    message: string,
    options: LocalNetworkErrorOptions & {
      operation?: string;
    } = {},
  ) {
    super('ERR_LOCAL_NETWORK_NATIVE', message, options);
    this.name = 'LocalNetworkNativeError';
    this.operation = options.operation;
  }
}

export const toLocalNetworkNativeError = (
  error: unknown,
  message: string,
  operation?: string,
) => {
  if (error instanceof LocalNetworkError) {
    return error;
  }

  return new LocalNetworkNativeError(message, {
    cause: error,
    operation,
  });
};
