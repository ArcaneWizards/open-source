export class TCNetError extends Error {
  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'TCNetError';
    if (cause) {
      this.cause = cause;
    }
  }
}

export class TCNetInitializationError extends TCNetError {
  constructor(message: string, cause: Error) {
    super(message, cause);
    this.name = 'TCNetInitializationError';
  }
}

export class TCNetConfigurationError extends TCNetError {
  constructor(message: string) {
    super(message);
    this.name = 'TCNetConfigurationError';
  }
}

export class TCNetProtocolError extends TCNetError {
  constructor(message: string, cause?: Error) {
    super(message, cause);
    this.name = 'TCNetProtocolError';
  }
}

export class TCNetNetworkError extends TCNetError {
  constructor(message: string, cause?: Error) {
    super(message, cause);
    this.name = 'TCNetNetworkError';
  }
}
