import { TIMECODE_FPS } from '@arcanewizards/artnet/constants';

const MS_FORMAT = new Intl.NumberFormat(undefined, {
  style: 'unit',
  unit: 'millisecond',
  maximumFractionDigits: 0,
});

export const SOURCE_CODE_URL =
  'https://github.com/ArcaneWizards/open-source/tree/main/apps/timecode-toolbox';

export const STRINGS = {
  title: 'Timecode Toolbox',
  debugger: 'Debug Tools & Log',
  connectionError: 'Disconnected from Timecode Toolbox Server',
  reconnect: 'Reconnect',
  openInNewWindow: 'Open in new window',
  toggle: (text: string) => `Toggle ${text}`,
  close: (text: string) => `Close ${text}`,
  license: 'License & About',
  acceptLicense: 'Accept License',
  licensePrompt: 'Please review and accept the license to use Timecode Toolbox',
  sourceCode: 'Source Code',
  protocols: {
    artnet: {
      short: 'ArtNet',
      long: 'ArtNet',
    },
    tcnet: {
      short: 'TCNet',
      long: 'TCNet (ShowKontrol / Pioneer)',
    },
  },
  inputs: {
    title: 'INPUTS',
    noChildren: 'No inputs yet. Please add one using the buttons below.',
    addButton: (protocol: string) => `Add ${protocol}`,
    addDialog: (protocol: string) => `Add ${protocol} Input`,
    editDialog: (protocol: string, name: string) =>
      `Edit ${protocol} Input ${name}`,
    deleteDialog: `Delete input?`,
    deleteDialogDetails: `Are you sure you want to delete this input? This action cannot be undone.`,
  },
  smtpeModes: {
    SMPTE: `SMPTE ${TIMECODE_FPS.SMPTE}FPS`,
    FILM: `FILM ${TIMECODE_FPS.FILM}FPS`,
    EBU: `EBU ${TIMECODE_FPS.EBU}FPS`,
    DF: `DF ${TIMECODE_FPS.DF}FPS`,
  },
  smtpeModeOptions: {
    SMPTE: `SMPTE (${TIMECODE_FPS.SMPTE}FPS) (Recommended)`,
    FILM: `FILM (${TIMECODE_FPS.FILM}FPS)`,
    EBU: `EBU (${TIMECODE_FPS.EBU}FPS)`,
    DF: `DF (${TIMECODE_FPS.DF}FPS)`,
  },
  accuracy: (accuracyMillis: number) =>
    `Accuracy: ${MS_FORMAT.format(accuracyMillis)}`,
  delay: (delayMs: number) => `Delay: ${MS_FORMAT.format(delayMs)}`,
  generators: {
    title: 'GENERATORS',
    noChildren: 'No generators yet. Please add one using the buttons below.',
    type: {
      clock: 'Clock',
    },
    addDialog: (protocol: string) => `Add ${protocol} Generator`,
    editDialog: (protocol: string, name: string) =>
      `Edit ${protocol} Generator ${name}`,
    deleteDialog: `Delete generator?`,
    deleteDialogDetails: `Are you sure you want to delete this generator? This action cannot be undone.`,
  },
  outputs: {
    title: 'OUTPUTS',
    noChildren: 'No outputs yet. Please add one using the buttons below.',
    addButton: (protocol: string) => `Add ${protocol}`,
    addDialog: (protocol: string) => `Add ${protocol} Output`,
    editDialog: (protocol: string, name: string) =>
      `Edit ${protocol} Output ${name}`,
    deleteDialog: `Delete output?`,
    deleteDialogDetails: `Are you sure you want to delete this output? This action cannot be undone.`,
  },
  settings: {
    title: 'Settings',
  },
  controls: {
    play: 'Play',
    pause: 'Pause',
    beginning: 'Reset timecode to start',
    back5seconds: 'Back 5 Seconds',
    forward5seconds: 'Forward 5 Seconds',
  },
  errors: {
    unknownTimecodeID: 'Unknown timecode ID, please close the window',
  },
  updates: {
    updateAvailable: (current: string, latest: string) =>
      `Version ${latest} is available! You are currently on version ${current}.`,
    download: 'Download',
    settingsLabel: 'Automatically check for updates',
    settingsDetails: `When enabled, the app will automatically check for updates periodically and display a message when a new version is available.`,
    lastChecked: (time: string) => `Last checked: ${time}`,
  },
  general: {
    enabled: 'Enabled',
    disabled: 'Disabled',
  },
} as const;
