# `@arcanewizards/net-utils-native`

[![](https://img.shields.io/npm/v/@arcanewizards/net-utils-native)](https://www.npmjs.com/package/@arcanewizards/net-utils-native)

Native networking utilities that need platform APIs, currently macOS local
network access.

## Installation

```sh
pnpm add @arcanewizards/net-utils-native
```

## Requirements

- Node.js `>=22.12.0 || >=23.1.0`
- On macOS, Xcode Command Line Tools (the native module is compiled on install)

On every other platform there is nothing to build, and the API resolves without
doing any work.

## Why this exists

Since macOS 15, an application must be granted Local Network access before it
can reach hosts on the LAN. Without it, sending a UDP packet to a local address
fails with `EHOSTUNREACH`, which is indistinguishable from a genuine routing
failure.

The permission is only evaluated, and the prompt only raised, when the
application uses one of Apple's own networking APIs. A pure-JavaScript mDNS
implementation sending multicast over `dgram` does not qualify: the traffic is
simply dropped, no prompt appears, and the failure is silent.

This package calls `NWBrowser` from Network.framework through a small N-API
module, so the request is correctly attributed to the containing application
bundle and the system's answer is actually observable.

## Usage

```ts
import { ensureLocalNetworkAccess } from '@arcanewizards/net-utils-native';

await ensureLocalNetworkAccess(logger);
```

Rejects with a `LocalNetworkDeniedError` when access was explicitly denied.
Resolves when access was confirmed, and also when the probe was inconclusive —
a network with nothing to discover should not stop a connection being attempted.

For the raw observations, use `probeLocalNetworkAccess`:

```ts
import { probeLocalNetworkAccess } from '@arcanewizards/net-utils-native';

const result = await probeLocalNetworkAccess();
// result.access: 'granted' | 'denied' | 'unknown'
// result.events: every state change and discovered service, in order
```

## Info.plist

An application using this package should declare, in addition to
`NSLocalNetworkUsageDescription`, every browsed service type under
`NSBonjourServices`. The defaults are exported as `DEFAULT_SERVICE_TYPES`.
