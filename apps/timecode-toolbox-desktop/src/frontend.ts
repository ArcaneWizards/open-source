import '@arcanewizards/timecode-toolbox/frontend';
import '@arcanewizards/timecode-toolbox/entrypoint.css';

import type { ElectronAPI } from './preload';
import { BrowserCloseListener } from '@arcanewizards/sigil/frontend';

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

const closeListeners = new Set<BrowserCloseListener>();

window.electronAPI?.onCloseRequested(() => {
  for (const listener of closeListeners) {
    const result = listener();
    if (result.action === 'confirm') {
      window.electronAPI?.confirmClose(result.confirmation);
      return;
    }
  }
  // If no listener returned a 'confirm' action, directly close the window
  window.close();
});

window.startTimecodeToolboxServerFrontend({
  appListenerChangesHandledExternally: !!window.electronAPI,
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
  getPathForFile: window.electronAPI?.getPathForFile ?? null,
  selectDirectory: window.electronAPI?.selectDirectory ?? null,
  openDevTools: window.electronAPI?.openDevTools ?? null,
  addCloseListener: (listener: BrowserCloseListener) =>
    closeListeners.add(listener),
  removeCloseListener: (listener: BrowserCloseListener) =>
    closeListeners.delete(listener),
  mediaSession:
    window.electronAPI?.mediaSession ?? window.createBrowserMediaSession(),
});
