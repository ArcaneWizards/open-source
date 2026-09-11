import type { Logger } from '@arcanejs/protocol/logging';

import { loadNativeModuleMacOS, callNative } from './local-network-macos.js';
import type { NativeBrowseEvent } from './local-network-macos.js';
import { LocalNetworkDeniedError } from './errors.js';
import type {
  LocalNetworkAccess,
  LocalNetworkBrowseError,
  LocalNetworkBrowseEvent,
  LocalNetworkBrowserState,
  LocalNetworkErrorDomain,
  LocalNetworkProbeOptions,
  LocalNetworkProbeResult,
} from './types.js';

export {
  LocalNetworkDeniedError,
  LocalNetworkError,
  LocalNetworkInvalidArgumentError,
  LocalNetworkNativeError,
  LocalNetworkNotSupportedError,
} from './errors.js';

export type {
  LocalNetworkErrorCode,
  LocalNetworkErrorOptions,
} from './errors.js';

export type {
  LocalNetworkAccess,
  LocalNetworkBrowseError,
  LocalNetworkBrowseEvent,
  LocalNetworkBrowserState,
  LocalNetworkErrorDomain,
  LocalNetworkProbeOptions,
  LocalNetworkProbeResult,
} from './types.js';

/**
 * `kDNSServiceErr_PolicyDenied` from `<dns_sd.h>`.
 *
 * This is what macOS reports when local network access has been denied, as
 * opposed to a transient discovery failure.
 */
const DNS_ERROR_POLICY_DENIED = -65570;

/**
 * Service types browsed by default.
 *
 * Browsing any type is enough to make macOS evaluate local network access, but
 * discovering something is the only positive confirmation that access was
 * actually granted, so the defaults favour types that are commonly present.
 *
 * Every type listed here must also appear in the application's
 * `NSBonjourServices` Info.plist entry.
 */
export const DEFAULT_SERVICE_TYPES = [
  '_airplay._tcp',
  '_raop._tcp',
  '_companion-link._tcp',
  '_googlecast._tcp',
  '_http._tcp',
];

const DEFAULT_TIMEOUT_MS = 2500;

const BROWSER_STATES: LocalNetworkBrowserState[] = [
  'invalid',
  'ready',
  'failed',
  'cancelled',
  'waiting',
];

const ERROR_DOMAINS: LocalNetworkErrorDomain[] = [
  'invalid',
  'posix',
  'dns',
  'tls',
  'wifi-aware',
];

const toBrowserState = (
  value: string | undefined,
): LocalNetworkBrowserState => {
  const state = BROWSER_STATES.find((candidate) => candidate === value);
  return state ?? 'invalid';
};

const toErrorDomain = (value: number | undefined): LocalNetworkErrorDomain => {
  if (value === undefined) {
    return 'unknown';
  }
  return ERROR_DOMAINS[value] ?? 'unknown';
};

const toChange = (value: string | undefined) => {
  return value === 'added' || value === 'removed' ? value : 'changed';
};

const isPolicyDenial = (error: LocalNetworkBrowseError) => {
  return error.domain === 'dns' && error.code === DNS_ERROR_POLICY_DENIED;
};

const describeError = (error: LocalNetworkBrowseError) => {
  return `${error.serviceType} (${error.domain} ${error.code})`;
};

/**
 * Browses for Bonjour services using Apple's `NWBrowser` API.
 *
 * Browsing is the operation macOS uses to evaluate local network access, so
 * this both raises the permission prompt (attributed to the containing
 * application bundle) and reports back what the system decided.
 *
 * Unlike a pure-JavaScript mDNS implementation sending multicast over `dgram`,
 * a denial here is visible rather than silent.
 */
export const probeLocalNetworkAccess = async (
  options: LocalNetworkProbeOptions = {},
): Promise<LocalNetworkProbeResult> => {
  const {
    serviceTypes = DEFAULT_SERVICE_TYPES,
    domain = null,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  const native = loadNativeModuleMacOS();

  const events: LocalNetworkBrowseEvent[] = [];
  const errors: LocalNetworkBrowseError[] = [];
  const totals = new Map<string, number>();

  const handles = serviceTypes.map((serviceType) => {
    const onEvent = (event: NativeBrowseEvent) => {
      if (event.type === 'state') {
        const state = toBrowserState(event.state);
        const error =
          event.errorCode === undefined
            ? undefined
            : {
                serviceType,
                domain: toErrorDomain(event.errorDomain),
                code: event.errorCode,
              };

        if (error) {
          errors.push(error);
        }

        events.push({ type: 'state', serviceType, state, error });
        return;
      }

      const total = event.total ?? 0;
      totals.set(serviceType, total);
      events.push({
        type: 'result',
        serviceType,
        change: toChange(event.change),
        name: event.name,
        total,
      });
    };

    return callNative('startBrowse', () =>
      native.startBrowse(serviceType, domain, onEvent),
    );
  });

  await new Promise<void>((resolve) => {
    setTimeout(resolve, timeoutMs);
  });

  for (const handle of handles) {
    // Cancelling is best effort: a browser that already failed is gone, and
    // there is nothing useful to do about a failure to tear one down.
    try {
      handle.cancel();
    } catch {
      // Ignore.
    }
  }

  const resultCount = [...totals.values()].reduce(
    (sum, total) => sum + total,
    0,
  );

  const denials = errors.filter(isPolicyDenial);

  let access: LocalNetworkAccess;
  let reason: string;

  if (denials.length > 0) {
    access = 'denied';
    reason = `Local network access was denied by the operating system: ${denials
      .map(describeError)
      .join(', ')}`;
  } else if (resultCount > 0) {
    access = 'granted';
    reason = `Discovered ${resultCount} local network service(s).`;
  } else if (errors.length > 0) {
    access = 'unknown';
    reason = `Discovered no local network services, and browsing failed: ${errors
      .map(describeError)
      .join(', ')}`;
  } else {
    access = 'unknown';
    // Observed on macOS 26: when access is denied, browsing still reaches
    // `ready` and reports no error at all, it simply never discovers anything.
    // That is indistinguishable from a network with nothing to discover, so
    // this stays inconclusive rather than being treated as a denial.
    reason =
      'Discovered no local network services. This is expected on a network with nothing to discover, but is also how a denial presents itself.';
  }

  return { access, reason, resultCount, errors, events };
};

/**
 * Ensures that local network access is available on the machine,
 * which is required for some platforms (e.g. macOS).
 *
 * Rejects when access was explicitly denied. An inconclusive probe resolves, so
 * that a network with nothing to discover does not prevent a connection from
 * being attempted.
 */
export const ensureLocalNetworkAccess = async (
  logger: Logger | null = null,
  options: LocalNetworkProbeOptions = {},
): Promise<void> => {
  if (process.platform !== 'darwin') {
    // Local network access only needs to be requested on macOS.
    return;
  }

  logger?.info('Ensuring local network access is available...');

  const result = await probeLocalNetworkAccess(options);

  logger?.debug(
    `Local network probe: ${result.access} - ${result.reason}`,
    result.events,
  );

  if (result.access === 'denied') {
    throw new LocalNetworkDeniedError(result.reason, { errors: result.errors });
  }

  if (result.access === 'unknown') {
    logger?.warn(
      `Local network access could not be confirmed. ${result.reason}`,
    );
    return;
  }

  logger?.info(`Local network access is available. ${result.reason}`);
};
