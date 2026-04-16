import '@arcanewizards/timecode-toolbox/frontend';
import '@arcanewizards/timecode-toolbox/entrypoint.css';

import type { ElectronAPI } from './preload';

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

if (
  !window.startTimecodeToolboxServerFrontend ||
  !window.createBrowserMediaSession
) {
  throw new Error('Timecode Toolbox frontend is not loaded properly.');
}

window.startTimecodeToolboxServerFrontend({
  openExternalLink: (url) => {
    if (!window.electronAPI) {
      // Opened in browser, use default behavior
      window.open(url, '_blank', 'noopener');
      return;
    }
    window.electronAPI.openUrl(url);
  },
  openNewWidow: (url, options) => {
    if (!window.electronAPI) {
      window.open(url, '_new', 'noopener');
      return;
    }
    window.electronAPI.openWindow(url, options);
  },
  selectDirectory: window.electronAPI?.selectDirectory ?? null,
  openDevTools: window.electronAPI?.openDevTools ?? null,
  confirmClose: (message: string) => {
    if (window.electronAPI) {
      window.electronAPI.confirmClose(message);
    }
  },
  mediaSession:
    window.electronAPI?.mediaSession ?? window.createBrowserMediaSession(),
});
