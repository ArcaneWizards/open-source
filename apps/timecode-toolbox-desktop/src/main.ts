import path from 'path';
import {
  app,
  BrowserWindow,
  dialog,
  Menu,
  nativeImage,
  Tray,
  ipcMain,
  shell,
  BrowserWindowConstructorOptions,
} from 'electron';
import pino from 'pino';
import pinoPretty from 'pino-pretty';
import MediaService from '@arcanewizards/electron-media-service';
import type {
  MediaMetadata,
  MediaSessionAction,
  NewWindowOptions,
} from '@arcanewizards/sigil/frontend' with { 'resolution-mode': 'require' };
import type { SigilAppInstance } from '@arcanewizards/sigil' with {
  'resolution-mode': 'require',
};
import {
  runTimecodeToolboxServer,
  type AppApi,
  urls,
} from '@arcanewizards/timecode-toolbox';

let mediaService: MediaService | null = null;

type ActiveMediaWindow = {
  window: BrowserWindow;
  media: MediaMetadata;
};

const activeMediaSessions: ActiveMediaWindow[] = [];

const startMediaService = () => {
  if (!mediaService) {
    mediaService = new MediaService();
  }

  const handleAction = (action: MediaSessionAction) => {
    activeMediaSessions[0]?.window.webContents.send('media-action', action);
  };

  mediaService.startService();
  mediaService.on('play', () => {
    handleAction({ action: 'play' });
  });
  mediaService.on('pause', () => {
    handleAction({ action: 'pause' });
  });
  mediaService.on('next', () => {
    handleAction({ action: 'seekforward' });
  });
  mediaService.on('previous', () => {
    handleAction({ action: 'seekbackward' });
  });
  mediaService.on('seek', (seekTimeMillis: number) => {
    handleAction({ action: 'seekto', seekTimeMillis });
  });
  mediaService.on('playPause', () => {
    handleAction({ action: 'playpause' });
  });
};

const updateMediaState = () => {
  if (!mediaService) return;
  const activeMedia =
    activeMediaSessions.filter((m) => m.media.state.state === 'playing')[0] ||
    activeMediaSessions[0];
  if (!activeMedia) {
    mediaService.setMetaData({
      title: 'No Track Loaded',
      artist: '',
      duration: 0,
      state: 'stopped',
    });
    return;
  }
  mediaService.setMetaData({
    title: activeMedia.media.title,
    artist: activeMedia.media.artist,
    duration: activeMedia.media.durationMillis,
    state: activeMedia.media.state.state === 'playing' ? 'playing' : 'paused',
    currentTime: Math.max(
      0,
      activeMedia.media.state.state === 'playing'
        ? Date.now() - activeMedia.media.state.effectiveStartTime
        : activeMedia.media.state.currentTimeMillis,
    ),
  });
};

const registerMediaSession = (window: BrowserWindow, media: MediaMetadata) => {
  const existingIndex = activeMediaSessions.findIndex(
    (m) => m.window === window,
  );
  if (existingIndex !== -1) {
    activeMediaSessions.splice(existingIndex, 1);
  }
  activeMediaSessions.push({ window, media });
  updateMediaState();
};

const unregesterMediaSession = (window: BrowserWindow) => {
  const existingIndex = activeMediaSessions.findIndex(
    (m) => m.window === window,
  );
  if (existingIndex !== -1) {
    activeMediaSessions.splice(existingIndex, 1);
  }
  updateMediaState();
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
if (require('electron-squirrel-startup')) app.quit();

app.setAppUserModelId('com.arcanewizards.timecode-toolbox-desktop');

const logger = pino(
  {
    level: 'info',
  },
  pino.multistream([
    // Use multistream to prevent errors when logging during shutdown
    { stream: pinoPretty() },
  ]),
);

const assetsPath = path.join(__dirname, '..', 'assets');

const activeWindows = new Map<BrowserWindow, URL>();

type WindowModes = 'default' | typeof urls.WINDOW_MODE_TIMECODE;

const WINDOW_MODES: Record<WindowModes, BrowserWindowConstructorOptions> = {
  default: {
    width: 1200,
    height: 600,
    minHeight: 500,
    minWidth: 400,
  },
  [urls.WINDOW_MODE_TIMECODE]: {
    width: 400,
    height: 200,
    minWidth: 300,
    minHeight: 150,
  },
};

const isWindowMode = (mode: string | undefined): mode is WindowModes => {
  return !!mode && mode in WINDOW_MODES;
};

const createWindow = (
  url: string | URL,
  windowOptions: Partial<BrowserWindowConstructorOptions> = WINDOW_MODES.default,
) => {
  const win = new BrowserWindow({
    ...windowOptions,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
    ...(process.platform === 'darwin'
      ? {
          titleBarStyle: 'hidden',
          trafficLightPosition: { x: 15, y: 15 },
        }
      : {}),
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    createWindow(url);
    return {
      action: 'deny',
    };
  });

  win.loadURL(url.toString());
  activeWindows.set(win, new URL(url));
  win.on('closed', () => {
    activeWindows.delete(win);
    unregesterMediaSession(win);
  });
  return win;
};

let server: SigilAppInstance<AppApi> | null = null;
let windowUrl: URL | null = null;

const confirmIfUserWantsToQuit = async () => {
  if (!server) {
    app.quit();
    return;
  }
  // Show a dialog to confirm if the user wants to quit
  // Return true if the user wants to quit
  // Return false if the user wants to cancel
  const response = await dialog.showMessageBox({
    type: 'question',
    buttons: ['Quit', 'Cancel'],
    title: 'Quit Timecode Toolbox',
    message:
      'Are you sure you want to quit Timecode Toolbox? Doing so will stop any connected timecodes.',
  });
  if (response.response === 0) {
    await mediaService?.stopService();
    await server.shutdown();
    app.quit();
  }
};

app.whenReady().then(async () => {
  startMediaService();

  ipcMain.on('media-update', (event, media: MediaMetadata) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    if (!media) {
      unregesterMediaSession(win);
    } else {
      registerMediaSession(win, media);
    }
  });

  ipcMain.on('open-url', (event, url: string) => {
    shell.openExternal(url);
  });
  ipcMain.on('open-window', (event, url: string, options: NewWindowOptions) => {
    if (options?.canUseExisting) {
      for (const [win, winUrl] of activeWindows.entries()) {
        if (winUrl.toString() === url) {
          win.focus();
          return;
        }
      }
    }
    createWindow(
      url,
      isWindowMode(options.mode) ? WINDOW_MODES[options.mode] : undefined,
    );
  });
  ipcMain.on('confirm-close', (event, message: string) => {
    dialog
      .showMessageBox({
        type: 'warning',
        buttons: ['Close', 'Cancel'],
        title: 'Confirm Close',
        message,
      })
      .then((response) => {
        if (response.response === 0) {
          const win = BrowserWindow.fromWebContents(event.sender);
          if (win) {
            win.destroy();
          }
        }
      });
  });

  ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  ipcMain.handle('open-dev-tools', async () => {
    // Open dev tools for every window
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.openDevTools({ mode: 'bottom' });
    });
  });

  // Create a tray icon
  // TODO: Add color icons for windows and linux
  let icon: Electron.NativeImage;
  if (process.platform === 'darwin') {
    icon = nativeImage.createFromPath(
      path.join(assetsPath, 'TrayIconTemplate.png'),
    );
    icon.setTemplateImage(true);
  } else {
    icon = nativeImage.createFromPath(path.join(assetsPath, 'TrayIcon.png'));
  }
  const tray = new Tray(icon);

  const url = () => {
    if (!windowUrl) {
      throw new Error('Window URL not set yet');
    }
    return windowUrl;
  };

  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: 'New Window',
        accelerator: 'CmdOrCtrl+N',
        click: () => void createWindow(url()),
      },
      {
        label: 'Quit',
        accelerator: 'CmdOrCtrl+Q',
        click: confirmIfUserWantsToQuit,
      },
    ]),
  );

  const APP_MENU = Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        {
          label: 'About',
          role: 'about',
        },
        {
          label: 'New Window',
          accelerator: 'CmdOrCtrl+N',
          click: () => void createWindow(url()),
        },
        {
          label: 'Quit',
          accelerator: 'CmdOrCtrl+Q',
          click: confirmIfUserWantsToQuit,
        },
      ],
    },
    {
      role: 'editMenu',
    },
    {
      label: 'Window',
      submenu: [
        {
          role: 'resetZoom',
        },
        {
          role: 'zoomIn',
        },
        {
          role: 'zoomOut',
        },
      ],
    },
  ]);

  Menu.setApplicationMenu(APP_MENU);

  const dataDir = app.getPath('userData');

  const arcane = runTimecodeToolboxServer({
    logger,
    appProps: {
      dataDirectory: dataDir,
    },
    toolkitOptions: {
      entrypointJsFile: path.resolve(__dirname, './frontend.js'),
    },
    title: 'Timecode Toolbox Desktop',
    edition: 'desktop',
  });
  server = arcane;

  let hasOpenedFirstWindow = false;

  arcane.addEventListener('windowUrlChange', (u) => {
    windowUrl = u;
    if (!hasOpenedFirstWindow) {
      hasOpenedFirstWindow = true;
      createWindow(url());
    }
    for (const [win, winUrl] of activeWindows.entries()) {
      if (winUrl.hostname !== u.hostname || winUrl.port !== u.port) {
        const newUrl = new URL(winUrl);
        newUrl.port = u.port;
        newUrl.hostname = u.hostname;
        logger.info(`Updating URL for window: ${winUrl} -> ${newUrl}`);
        win.loadURL(newUrl.toString());
        activeWindows.set(win, newUrl);
      }
    }
  });
});

app.on('activate', () => {
  if (windowUrl === null) {
    return;
  }
  for (const [win, url] of activeWindows.entries()) {
    if (url === windowUrl) {
      // Window is full window, just focus it
      win.focus();
      return;
    }
  }

  createWindow(windowUrl);
});

app.on('window-all-closed', () => {
  // Subscribing to this event prevents the app from quitting
  // when all windows are closed
  // which is the behavior we want for a tray app
});

// Catch uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error(err);
});
