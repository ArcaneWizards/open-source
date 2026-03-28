import { contextBridge, ipcRenderer } from 'electron';
import type {
  MediaSessionControl,
  MediaSessionHandler,
} from '@arcanewizards/sigil/frontend' with { 'resolution-mode': 'require' };

let handler: MediaSessionHandler | null = null;

const mediaSession: MediaSessionControl = {
  setMetaData: (metadata) => {
    ipcRenderer.send('media-update', metadata);
  },
  setHandler: (h) => {
    handler = h;
  },
};

ipcRenderer.on('media-action', (event, action) => {
  if (handler) {
    handler(action);
  }
});

const ELECTRON_API = {
  openUrl: (url: string) => ipcRenderer.send('open-url', url),
  openWindow: (url: string, canUseExisting: boolean = false) =>
    ipcRenderer.send('open-window', url, canUseExisting),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  openDevTools: () => ipcRenderer.invoke('open-dev-tools'),
  confirmClose: (message: string) => {
    ipcRenderer.send('confirm-close', message);
  },
  mediaSession,
};

export type ElectronAPI = typeof ELECTRON_API;

contextBridge.exposeInMainWorld('electronAPI', ELECTRON_API);
