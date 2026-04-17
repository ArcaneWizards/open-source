<h1 align="center">
  Arcane Wizards Open-Source Monorepo
</h1>

<p align="center">
  <img src="https://arcanewizards.com/static/icon-arcane.svg" height="200" alt="Timecode Toolbox Icon"/>
</p>

This repository is home to most of the open-source code produced by
[Arcane Wizards Ltd](https://arcanewizards.com/),
and is the foundation for our flagship application
[Arcane](https://arcanewizards.com/arcane).

We use a monorepo architecture as we author many libraries,
and want to be able to easily test them during development with our
full-featured applications.

If you've found yourself on this page,
you're most likely after information on one of the applications or
libraries below.

## Applications

<h3 align="center">
  <a href="./apps/timecode-toolbox/">Timecode Toolbox</a>
</h3>

<p align="center">
  <a href="./apps/timecode-toolbox/"><img src="https://arcanewizards.com/static/icon-timecode-toolbox.svg" height="200" alt="Timecode Toolbox Icon"/></a>
</p>

[Timecode Toolbox](./apps/timecode-toolbox/) is a free and open software
application that allows you to monitor, generate and convert timecode signals
with ease.

<p align="center">
  <a href="https://arcanewizards.com/download/timecode-toolbox/latest/macos-arm64"><img src="https://arcanewizards.com/download/timecode-toolbox/latest/macos-arm64/button?cb=1" height="50" alt="Download MacOS (Apple Silicon / ARM) Desktop App"/></a>
  &nbsp;&nbsp;
  <a href="https://arcanewizards.com/download/timecode-toolbox/latest/macos-x64"><img src="https://arcanewizards.com/download/timecode-toolbox/latest/macos-x64/button?cb=1" height="50" alt="Download MacOS (Intel / x64) Desktop App"/></a>
  &nbsp;&nbsp;
  <a href="https://arcanewizards.com/download/timecode-toolbox/latest/windows-x64"><img src="https://arcanewizards.com/download/timecode-toolbox/latest/windows-x64/button?cb=1" height="50" alt="Download Windows (x64) Desktop App"/></a>
</p>

## Libraries

### [net-utils](./packages/net-utils/)

Small Node.js networking helpers shared by the Arcane Wizards packages.

### [artnet](./packages/artnet/)

Protocol implementation for Art-Net timecode.

### [tcnet](./packages/tcnet/)

Protocol implementation for TCNet.

### [sigil](./packages/sigil/)

Application framework & design system built on-top of `@arcanejs` (see below).

This library handles much of the logic and design requirements that are common
across the apps that we develop.

## Other Repositories

### [ArcaneJS](https://github.com/ArcaneWizards/arcanejs)

The library at the heart of all our real-time applications,
published as its own dedicated monorepo as it encompasses
a number of different packages, and test applications.

It uses a custom server-side react-renderer and websockets
to maintain state across numerous devices simultaneously.

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
