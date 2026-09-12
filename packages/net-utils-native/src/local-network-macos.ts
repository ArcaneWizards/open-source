import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { dirname } from 'node:path';

import {
  LocalNetworkNativeError,
  toLocalNetworkNativeError,
} from './errors.js';

/**
 * Raw event shape emitted by `native/local-network-macos.mm`.
 */
export type NativeBrowseEvent = {
  type: 'state' | 'result';
  state?: string;
  change?: string;
  name?: string;
  total?: number;
  errorDomain?: number;
  errorCode?: number;
};

export type NativeBrowseHandle = {
  cancel(): void;
};

export type NativeLocalNetworkModule = {
  startBrowse(
    serviceType: string,
    domain: string | null,
    callback: (event: NativeBrowseEvent) => void,
  ): NativeBrowseHandle;
};

const requireNative = createRequire(join(process.cwd(), 'package.json'));

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const assertFunction = (value: unknown, name: string) => {
  if (typeof value !== 'function') {
    throw new LocalNetworkNativeError(
      `MacOS local network native module is missing ${name}.`,
    );
  }
};

export const callNative = <Value>(
  operation: string,
  callback: () => Value,
): Value => {
  try {
    return callback();
  } catch (error) {
    throw toLocalNetworkNativeError(
      error,
      `MacOS local network native operation ${operation} failed.`,
      operation,
    );
  }
};

const getNativeModule = () => {
  const packageRootCandidates: string[] = [];

  try {
    packageRootCandidates.push(
      dirname(
        requireNative.resolve('@arcanewizards/net-utils-native/package.json'),
      ),
    );
  } catch {
    // Fall through to local path candidates.
  }

  if (typeof __dirname === 'string') {
    packageRootCandidates.push(join(__dirname, '..'));
  }

  packageRootCandidates.push(process.cwd());
  packageRootCandidates.push(
    join(process.cwd(), 'packages', 'net-utils-native'),
  );

  const resolvedPaths = new Set(
    packageRootCandidates.map((packageRoot) =>
      join(
        packageRoot,
        'native',
        'out',
        `local-network-macos.${process.arch}.node`,
      ),
    ),
  );

  for (const nativePath of resolvedPaths) {
    if (existsSync(nativePath)) {
      return callNative('loadNativeModule', () => requireNative(nativePath));
    }
  }

  throw new LocalNetworkNativeError(
    `MacOS local network native module was not found. Tried: ${[
      ...resolvedPaths,
    ].join(', ')}`,
  );
};

const assertNativeModule = (value: unknown): NativeLocalNetworkModule => {
  if (!isRecord(value)) {
    throw new LocalNetworkNativeError(
      'MacOS local network native module did not load correctly.',
    );
  }

  assertFunction(value.startBrowse, 'startBrowse');

  return value as unknown as NativeLocalNetworkModule;
};

/**
 * Ensure only a singleton instance exists, and that the native module is only
 * loaded when it is actually needed.
 */
let nativeModule: NativeLocalNetworkModule | null = null;

export const loadNativeModuleMacOS = (): NativeLocalNetworkModule => {
  if (!nativeModule) {
    nativeModule = assertNativeModule(getNativeModule());
  }
  return nativeModule;
};
