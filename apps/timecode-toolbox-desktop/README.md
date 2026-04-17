<h1 align="center">
  Timecode Toolbox Desktop
</h1>

<p align="center">
  <img src="https://arcanewizards.com/static/icon-timecode-toolbox.svg" height="200" alt="Timecode Toolbox Icon"/>
</p>

The contents of this directory build the electron application wrapper for
[timecode-toolbox](../timecode-toolbox/).

This app is versioned and deployed in conjunction with the main app code.

## Development

A development build of the electron app can be run locally by cloning the
repository, and running the following from the repository root:

```
pnpm install
pnpm build
pnpm --dir apps/timecode-toolbox-desktop start
```

## Build Artifacts

The latest signed & published desktop apps can be found in the repository
releases,
or downloaded below:

<p align="center">
  <a href="https://arcanewizards.com/download/timecode-toolbox/latest/macos-arm64"><img src="https://arcanewizards.com/download/timecode-toolbox/latest/macos-arm64/button?cb=1" height="50" alt="Download MacOS (Apple Silicon / ARM) Desktop App"/></a>
  &nbsp;&nbsp;
  <a href="https://arcanewizards.com/download/timecode-toolbox/latest/macos-x64"><img src="https://arcanewizards.com/download/timecode-toolbox/latest/macos-x64/button?cb=1" height="50" alt="Download MacOS (Intel / x64) Desktop App"/></a>
  &nbsp;&nbsp;
  <a href="https://arcanewizards.com/download/timecode-toolbox/latest/windows-x64"><img src="https://arcanewizards.com/download/timecode-toolbox/latest/windows-x64/button?cb=1" height="50" alt="Download Windows (x64) Desktop App"/></a>
</p>

### Note on Windows Releases

We don't currently sign our windows releases with a code-signing certificate,
this means you will be faced with a warning when you open it for the first time,
and anti-virus apps may interfere with its operation.
