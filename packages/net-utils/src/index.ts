import os from 'os';

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
