# `@arcanewizards/artnet`

[![](https://img.shields.io/npm/v/@arcanewizards/artnet)](https://www.npmjs.com/package/@arcanewizards/artnet)

Art-Net timecode transport for Node.js applications.

This package exposes a small UDP-based API for sending and receiving Art-Net timecode packets and shares network-target configuration with `@arcanewizards/net-utils`.

## Installation

```sh
pnpm add @arcanewizards/artnet
```

## API

`createArtnet(config)` returns an `ArtNet` instance with the following contract:

- `connect(): Promise<void>`
  Opens the underlying UDP sockets for the configured mode.
- `sendTimecode(mode, timeMillis): Promise<void>`
  Sends one Art-Net timecode packet. Calling this before `connect()` rejects. Negative `timeMillis` values are ignored because Art-Net timecode does not support negative positions.
- `on(event, listener)`
- `addListener(event, listener)`
- `removeListener(event, listener)`
  Standard event-emitter style listeners.
- `destroy(): void`
  Closes open sockets and emits the `destroy` event.

Supported events:

- `timecode`
  Fired when a valid inbound Art-Net timecode packet is received.
- `error`
  Fired when the instance encounters a socket or send error.
- `destroy`
  Fired when `destroy()` is called.

## Usage

```ts
import { createArtnet } from '@arcanewizards/artnet';

const artnet = createArtnet({
  type: 'interface',
  interface: 'en0',
  mode: 'both',
});

artnet.on('timecode', (event) => {
  console.log(
    `Received ${event.mode} ${event.hours}:${event.minutes}:${event.seconds}:${event.frame} from ${event.host}:${event.port}`,
  );
  console.log(`Position in milliseconds: ${event.timeMillis}`);
});

artnet.on('error', (error) => {
  console.error('Art-Net error', error);
});

await artnet.connect();

const positionMillis = 12_345;

await artnet.sendTimecode('EBU', positionMillis);

artnet.destroy();
```

In the example above, `sendTimecode('EBU', 12_345)` encodes the position as 25 fps timecode. A receiving listener will not receive the timecode in the same precision,
as it will be decomposed into hours, minutes, seconds and frames.

## Timecode Types

### `ArtNetTimecode`

Represents a single Art-Net timecode value:

- `hours: number`
- `minutes: number`
- `seconds: number`
- `frame: number`
- `mode: TimecodeMode`
  One of `FILM`, `EBU`, `DF`, or `SMPTE`.
- `timeMillis: number`
  The same position converted to milliseconds by this package. For non-drop-frame modes this is a direct fps-based conversion. For `DF`, the package applies drop-frame math when converting between frame fields and milliseconds.

### `ArtNetTimecodeEvent`

Extends `ArtNetTimecode` with source-network metadata for inbound packets:

- `host: string`
  Source IP address of the packet.
- `port: number`
  Source UDP port of the packet.

That means a `timecode` listener receives both the interpreted timecode and where it came from on the network, which is useful when monitoring multiple Art-Net sources.

## Connection Modes

- `send`
  Broadcasts Art-Net timecode packets.
- `receive`
  Listens for inbound Art-Net timecode packets.
- `both`
  Opens both paths on the same instance.

Targets follow the shared `ConnectionConfig` shape:

- `{ type: 'host', host: '192.168.1.50', port?: number }`
- `{ type: 'interface', interface: 'en0', port?: number }`

When sending through an interface target, the package resolves the interface broadcast address automatically.
