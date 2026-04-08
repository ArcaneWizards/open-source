# `@arcanewizards/tcnet`

[![](https://img.shields.io/npm/v/@arcanewizards/tcnet)](https://www.npmjs.com/package/@arcanewizards/tcnet)

TCNet node and monitoring utilities for Node.js applications.

This package can join a TCNet network, maintain node presence, emit packet and node lifecycle events, and derive higher-level timecode state from the underlying protocol traffic.

## Installation

```sh
pnpm add @arcanewizards/tcnet
```

## Exports

- `@arcanewizards/tcnet`
  Exposes `createTCNetNode(...)`.
- `@arcanewizards/tcnet/monitor`
  Exposes `createTCNetTimecodeMonitor(...)` and monitor event types.
- `@arcanewizards/tcnet/types`
  Exposes `TCNetNode`, `TCNetNodeInfo`, `TCNetConnectedNodes`, `TCNetPortInformation`, `TCNetPortUsage`, `TCNetLogger`, and related runtime types.

## Usage

```ts
import pino from 'pino';
import { createTCNetNode } from '@arcanewizards/tcnet';
import { createTCNetTimecodeMonitor } from '@arcanewizards/tcnet/monitor';

const logger = pino();

const node = createTCNetNode({
  logger,
  networkInterface: 'en0',
  nodeName: 'TCNODE01',
  vendorName: 'Arcane Wizards',
  appName: 'Example App',
  appVersion: '0.1.0',
});

node.on('ready', () => {
  logger.info('TCNet node ready');
});

node.on('nodes-changed', (nodes) => {
  logger.info(`Connected nodes: ${Object.keys(nodes).length}`);
});

const monitor = createTCNetTimecodeMonitor(node, logger);

monitor.addListener('timecode-changed', (timecode) => {
  logger.info(
    `${timecode.layerName}: ${timecode.playState.state} ${timecode.layerId}`,
  );
});

node.connect();
```

## Lifecycle

- Call `connect()` to bind sockets and start TCNet presence announcements.
- Listen for `ready`, `port-state-changed`, `nodes-changed`, `time`, `data`, and `node-status` events on the node.
- Call `destroy()` during shutdown so the node can opt out cleanly and release sockets.

## Logger Contract

`createTCNetNode(...)` expects a logger with `error`, `warn`, `info`, and `debug` methods. `pino` works directly, and the package keeps `pino` as an optional peer dependency.
