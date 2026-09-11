/**
 * States reported by `NWBrowser`, mirroring `nw_browser_state_t`.
 *
 * `failed` and `cancelled` are terminal.
 */
export type LocalNetworkBrowserState =
  | 'invalid'
  | 'ready'
  | 'failed'
  | 'cancelled'
  | 'waiting';

/**
 * Error domains reported by `NWBrowser`, mirroring `nw_error_domain_t`.
 */
export type LocalNetworkErrorDomain =
  | 'invalid'
  | 'posix'
  | 'dns'
  | 'tls'
  | 'wifi-aware'
  | 'unknown';

export type LocalNetworkBrowseError = {
  serviceType: string;
  domain: LocalNetworkErrorDomain;
  /**
   * Meaning depends on `domain`: a POSIX errno for `posix`, and a
   * `DNSServiceErrorType` (as defined in `dns_sd.h`) for `dns`.
   */
  code: number;
};

export type LocalNetworkBrowseEvent =
  | {
      type: 'state';
      serviceType: string;
      state: LocalNetworkBrowserState;
      error?: LocalNetworkBrowseError;
    }
  | {
      type: 'result';
      serviceType: string;
      change: 'added' | 'removed' | 'changed';
      name?: string;
      total: number;
    };

/**
 * Whether the operating system allows this process to reach the local network.
 *
 * `unknown` means the probe completed without being denied, but also without
 * discovering anything, so access could not be positively confirmed. This is
 * expected on a network with no discoverable Bonjour services.
 */
export type LocalNetworkAccess = 'granted' | 'denied' | 'unknown';

export type LocalNetworkProbeOptions = {
  /**
   * Bonjour service types to browse for. Every type declared here should also
   * appear in the application's `NSBonjourServices` Info.plist entry.
   */
  serviceTypes?: string[];
  /**
   * Bonjour domain to browse, or `null` for the default domains.
   */
  domain?: string | null;
  /**
   * How long to browse before deciding. Discovery is not instant, so this needs
   * to be long enough for responses to arrive.
   */
  timeoutMs?: number;
};

export type LocalNetworkProbeResult = {
  access: LocalNetworkAccess;
  /**
   * Human readable explanation of how `access` was decided, for logging.
   */
  reason: string;
  /**
   * Number of distinct services discovered across all browsed service types.
   */
  resultCount: number;
  errors: LocalNetworkBrowseError[];
  /**
   * Every event observed during the probe, in order. Retained so that the
   * decision rule can be reviewed against real-world behaviour.
   */
  events: LocalNetworkBrowseEvent[];
};
