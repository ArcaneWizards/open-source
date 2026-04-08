# `@arcanewizards/net-utils`

[![](https://img.shields.io/npm/v/@arcanewizards/net-utils)](https://www.npmjs.com/package/@arcanewizards/net-utils)

Small Node.js networking helpers shared by the Arcane Wizards packages.

The package currently focuses on IPv4 interface discovery and common connection-status types used by higher-level transport packages such as `@arcanewizards/artnet` and `@arcanewizards/tcnet`.

## Installation

```sh
pnpm add @arcanewizards/net-utils
```

## Requirements

- Node.js `>=22.12.0 || >=23.1.0`

## Exports

- `getNetworkInterfaces()`
  Returns a map of IPv4 interfaces keyed by interface name.
- `ConnectionConfig`
  Shared target shape for host-based and interface-based network configuration.
- `NetworkInterface`
  Describes a resolved IPv4 interface, including its broadcast address.
- `NetworkPortStatus`
  Describes runtime status for a network port or range.

## Usage

```ts
import { getNetworkInterfaces } from '@arcanewizards/net-utils';

const interfaces = await getNetworkInterfaces();

for (const [name, iface] of Object.entries(interfaces)) {
  console.log(name, iface.address, iface.broadcastAddress);
}
```

## Return Shape

Each entry returned by `getNetworkInterfaces()` includes:

- `name`
- `address`
- `internal`
- `broadcastAddress`

Only IPv4 addresses are included.
