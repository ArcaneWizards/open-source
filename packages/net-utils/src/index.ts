import Bonjour from 'bonjour-service';
import os from 'os';
import type { Logger } from '@arcanejs/protocol/logging';

export type NetworkTarget =
  | {
      type: 'host';
      host: string;
    }
  | {
      type: 'interface';
      interface: string;
    };

export type ConnectionConfig = NetworkTarget & {
  port?: number;
};

export type NetworkInterface = {
  name: string;
  address: string;
  internal: boolean;
  broadcastAddress: string;
};

export type NetworkPortStatus = {
  direction: 'input' | 'output' | 'both';
  target: NetworkTarget;
  port:
    | number
    | {
        from: number;
        to: number;
      };
  status: 'disabled' | 'connecting' | 'active' | 'error';
  errors?: string[];
  warnings?: string[];
};

const getBroadcastAddress = (ip: string, netmask: string): string => {
  const ipParts = ip.split('.').map(Number);
  const maskParts = netmask.split('.').map(Number);
  const broadcastParts = ipParts.map(
    (part, i) => part | (~(maskParts[i] ?? 0) & 0xff),
  );
  return broadcastParts.join('.');
};

export const getNetworkInterfaces = async (): Promise<
  Record<string, NetworkInterface>
> => {
  const interfaces = os.networkInterfaces();
  const results: Record<string, NetworkInterface> = {};
  for (const name of Object.keys(interfaces)) {
    const addrs = interfaces[name];
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family === 'IPv4') {
        const broadcastAddress = getBroadcastAddress(
          addr.address,
          addr.netmask,
        );
        results[name] = {
          name,
          address: addr.address,
          internal: addr.internal,
          broadcastAddress,
        };
      }
    }
  }
  return results;
};

/**
 * Ensures that local network access is available on the machine,
 * which is required for some platforms (e.g. macOS).
 */
export const ensureLocalNetworkAccess = (
  logger: Logger | null = null,
  waitForMs: number = 2000,
): Promise<void> => {
  if (process.platform !== 'darwin') {
    // Using bonjour for local network access check is only required on macOS
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    try {
      logger?.info('Ensuring local network access is available...');
      const bonjour = new Bonjour({}, (cause: unknown) => {
        const error = new Error('Failed to access local network', { cause });
        reject(error);
      });
      const browser = bonjour.find({ type: 'http' });
      // Consider ready only after a short delay,
      // to allow for the bonjour service to start,
      // and for any errors to be reported via the error callback.
      setTimeout(() => {
        browser.stop();
        bonjour.destroy();
        resolve();
      }, waitForMs);
    } catch (cause) {
      const error = new Error('Failed to access local network', { cause });
      reject(error);
    }
  });
};
