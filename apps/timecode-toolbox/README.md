<h1 align="center">
  Timecode Toolbox
</h1>

<p align="center">
  <img src="https://arcanewizards.com/static/promo-timecode-toolbox.png" alt="Timecode Toolbox Promo"/>
</p>

Timecode Toolbox is a free & open-source app that allows you to easily monitor,
generate and convert timecode signals of different types.

<h2 align="center">
  Download latest desktop release
</h2>

<p align="center">
  <a href="https://arcanewizards.com/download/timecode-toolbox/latest/macos-arm64"><img src="https://arcanewizards.com/download/timecode-toolbox/latest/macos-arm64/button?cb=1" height="50" alt="Download MacOS (Apple Silicon / ARM) Desktop App"/></a>
  &nbsp;&nbsp;
  <a href="https://arcanewizards.com/download/timecode-toolbox/latest/macos-x64"><img src="https://arcanewizards.com/download/timecode-toolbox/latest/macos-x64/button?cb=1" height="50" alt="Download MacOS (Intel / x64) Desktop App"/></a>
  &nbsp;&nbsp;
  <a href="https://arcanewizards.com/download/timecode-toolbox/latest/windows-x64"><img src="https://arcanewizards.com/download/timecode-toolbox/latest/windows-x64/button?cb=1" height="50" alt="Download Windows (x64) Desktop App"/></a>
</p>

## Headless / CLI Version

[![](https://img.shields.io/npm/v/@arcanewizards/timecode-toolbox)](https://www.npmjs.com/package/@arcanewizards/timecode-toolbox)

This application can be installed and run via NPM, allowing the application UI to be accessed via a browser on any device on the same network.

For example, you can have Timecode Toolbox running on a server in a rack, on a Mac Mini, or even a Raspberry PI.

Make sure you have Node v22 or higher installed, and then use `npx` to download and install the desired version:

```sh
npx @arcanewizards/timecode-toolbox@latest
```

Or use `pnpm`, `npm`, or `yarn` to install the package `@arcanewizards/timecode-toolbox` globally,
and then run the app:

```sh
npm install -g @arcanewizards/timecode-toolbox@latest
timecode-toolbox
```

## Features

### Supported Protocols

The following protocols are currently supported:

- ArtNet Timecode (Input & Output)
- TCNet / Pioneer Pro DJ Link via ShowKontrol / Bridge (Input Only)

We plan to also soon implement the following:

- MIDI Timecode
- Local Audio Player (not LTC)

### All the timecodes you want!

There's no limit to how many timecodes, protocols or interfaces you can add.
Each timecode can be given a custom name and color,
allowing you to easily tell different timecodes apart.

### Easily Pause / Resume Inputs & Outputs

Need another application to take over timing control,
or keep network traffic down? No problem!

Any input or output can be paused at any time,
freeing up the used network ports for any other app to take over.
When you want to resume, it's just one click!

### Clock Playback with Custom Speeds

Add as many clock-based timecode generators as you like,
and specify non-standard playback speeds to simulate what would happen
when DJs adjust the tempo of their tracks live.

### Rich Timecode Metadata (when available)

When a timecode source provides information such as track name, artist,
and total play-time,
this information will be visible in the UI,
including a progress bar for total play time.

### Pop-Out Windows

Need to focus on one timecoded in-particular?
Open any timecode in it's own dedicated window that can me maximized or moved
around to your liking.

<p align="center">
  <img src="https://arcanewizards.com/static/promo-timecode-toolbox-single-window.png" alt="Screenshot of a single Timecode Window"/>
</p>

### Delay Adjustment

Adjust the delay offset for incoming or outgoing timecodes to account for any
delay on the network or or anywhere in your media pipeline.

### Real-Time Multi-Device Control

The Timecode Toolbox UI can be accessed via a web browser on any device on the same network.
This allows everyone in Front-of-House or involved in production to be in-sync.

All UIs update in real-time, and take into account differences in device clock time,
to ensure that timing information is always displayed accurately.

This also means that you can install Timecode Toolbox onto a headless machine,
such as a media server in a rack,
rather than relying on a laptop device to be usable and accessible.

<p align="center">
  <img src="https://arcanewizards.com/static/promo-timecode-toolbox-network.svg" alt="Screenshot of a single Timecode Window"/>
</p>

## Contributing

We're not currently looking for active maintainers for our repository,
but we welcome bug reports or feature ideas!

Please feel to [open an issue](https://github.com/ArcaneWizards/open-source/issues)
with any feedback that you have.

## Community & Support

We have a [discussion board open](https://github.com/ArcaneWizards/open-source/discussions),
where you can share ideas, or showcase how you've been using the app.

If you need any help using the app,
please feel free to ask [on the dedicated Help & Support board](https://github.com/ArcaneWizards/open-source/discussions/categories/help-support).

## License

MIT License

Copyright (c) 2026 Arcane Wizards Ltd

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
