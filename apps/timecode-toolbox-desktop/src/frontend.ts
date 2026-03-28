import '@arcanewizards/timecode-toolbox/frontend';
import '@arcanewizards/timecode-toolbox/entrypoint.css';

import type { ElectronAPI } from './preload';

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

if (!window.startTimecodeToolboxServerFrontend) {
  throw new Error('Timecode Toolbox frontend is not loaded properly.');
}

if (!window.electronAPI) {
  throw new Error(
    'Electron API is not available. This app is meant to be run in Electron.',
  );
}

window.startTimecodeToolboxServerFrontend({
  openExternalLink: (url: string) => {
    if (!window.electronAPI) {
      // Opened in browser, use default behavior
      window.open(url, '_blank', 'noopener');
      return;
    }
    window.electronAPI.openUrl(url);
  },
  openNewWidow: (url: string, canUseExisting?: boolean) => {
    if (!window.electronAPI) {
      window.open(url, '_new', 'noopener');
      return;
    }
    window.electronAPI.openWindow(url, canUseExisting);
  },
  selectDirectory: window.electronAPI?.selectDirectory ?? null,
  openDevTools: window.electronAPI?.openDevTools ?? null,
  confirmClose: (message: string) => {
    if (window.electronAPI) {
      window.electronAPI.confirmClose(message);
    }
  },
  mediaSession: window.electronAPI.mediaSession,
});
