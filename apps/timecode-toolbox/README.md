<h1 align="center">
  Timecode Toolbox
</h1>

<p align="center">
  <img src="https://arcanewizards.com/static/icon-timecode-toolbox.svg" height="200" alt="App Icon"/>
</p>

Timecode Toolbox is a free & open-source app that allows you to easily monitor,
generate and convert timecode signals of different types.

<h2 align="center">
  Download latest desktop release
</h2>

<p align="center">
  <a href="https://arcanewizards.com/download/timecode-toolbox/latest/macos-arm64"><img src="https://arcanewizards.com/download/timecode-toolbox/latest/macos-arm64/button" height="50" alt="Download MacOS (Apple Silicon / ARM) Desktop App"/></a>
  &nbsp;&nbsp;
  <a href="https://arcanewizards.com/download/timecode-toolbox/latest/macos-x64"><img src="https://arcanewizards.com/download/timecode-toolbox/latest/macos-x64/button" height="50" alt="Download MacOS (Intel / x64) Desktop App"/></a>
  &nbsp;&nbsp;
  <a href="https://arcanewizards.com/download/timecode-toolbox/latest/windows-x64"><img src="https://arcanewizards.com/download/timecode-toolbox/latest/windows-x64/button" height="50" alt="Download Windows (x64) Desktop App"/></a>
</p>

## Headless / CLI Version

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

### Clock Playback with Custom Speeds

Add as many clock-based timecode generators as you like,
and specify non-standard playback speeds to simulate what would happen
when DJs adjust the temp of their tracks live.

### Custom labels & Colors

Name your inputs, outputs and generators however you like,
and customize their interface colors to easily tell them apart.

### Pop-Out Windows

Need to focus on one timecoded in-particular?
Open any timecode in it's own dedicated window that can me maximized or moved
around to your liking.

### Delay Adjustment

Adjust incoming or outgoing timecodes to account for any delay on the network or
or anywhere in your media pipeline.
