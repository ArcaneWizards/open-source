import { TIMECODE_FPS } from '@arcanewizards/artnet/constants';
import {
  UpdateBannerStrings,
  UpdateDetailsStrings,
} from '@arcanewizards/sigil/frontend/updates';

const MS_FORMAT = new Intl.NumberFormat(undefined, {
  style: 'unit',
  unit: 'millisecond',
  maximumFractionDigits: 0,
});

export const SOURCE_CODE_URL =
  'https://github.com/ArcaneWizards/open-source/tree/main/apps/timecode-toolbox';

export const HELP_AND_SUPPORT_URL = 'https://arcanewizards.com/discord';

export const STRINGS = {
  title: 'Timecode Toolbox',
  debugger: 'Debug Tools & Log',
  connectionError: 'Disconnected from Timecode Toolbox Server',
  reconnect: 'Reconnect',
  openInNewWindow: 'Open in new window',
  toggle: (text: string) => `Toggle ${text}`,
  close: (text: string) => `Close ${text}`,
  clearFile: 'Clear loaded file',
  license: 'License & About',
  acceptLicense: 'Accept License',
  licensePrompt: (title: string) =>
    `Please review and accept the ${title} to use Timecode Toolbox`,
  licenseLastUpdated: (date: string) => `Last updated: ${date}`,
  sourceCode: 'Source Code',
  helpAndSupport: 'Get Help & Support',
  protocols: {
    artnet: {
      short: 'ArtNet',
      long: 'ArtNet',
    },
    tcnet: {
      short: 'TCNet',
      long: 'TCNet (ShowKontrol / Pioneer)',
    },
    midi: {
      short: 'MTC',
      long: 'MIDI Timecode (MTC)',
    },
    ltc: {
      short: 'LTC (BETA)',
      long: 'Linear Timecode (LTC)',
    },
  },
  inputs: {
    title: 'INPUTS',
    unnamed: 'Unnamed Input',
    enable: 'Enable Input',
    disable: 'Disable Input',
    edit: 'Edit Input',
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
  delay: {
    delayLabel: 'Delay',
    offsetLabel: 'Offset',
    delayDescription:
      'Enter a positive number for an offset, or a negative number for a delay.',
  },
  generators: {
    title: 'GENERATORS',
    unnamed: 'Unnamed Generator',
    edit: 'Edit Generator',
    noChildren: 'No generators yet. Please add one using the buttons below.',
    type: {
      clock: 'Clock',
      player: 'Audio Player',
    },
    addDialog: (protocol: string) => `Add ${protocol} Generator`,
    editDialog: (protocol: string, name: string) =>
      `Edit ${protocol} Generator ${name}`,
    deleteDialog: `Delete generator?`,
    deleteDialogDetails: `Are you sure you want to delete this generator? This action cannot be undone.`,
    clock: {
      systemTimezone: (tz: string) => `Timezone: ${tz}`,
    },
  },
  outputs: {
    title: 'OUTPUTS',
    unnamed: 'Unnamed Output',
    enable: 'Enable Output',
    disable: 'Disable Output',
    link: 'Link Output',
    edit: 'Edit Output',
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
    network: {
      appPortLabel: 'Application Port',
      appInterfaceLabel: 'Application Interface',
      anyInterface: 'Any Interface',
      internalInterfaceUsed: (iface: string) =>
        `Note: The interface ${iface} is only accessible from this device, which means that other devices will not be able to connect to Timecode Toolbox.`,
      appPortEnvOverride: (envPort: number) =>
        `Note: The application port is currently set to ${envPort} via the PORT environment variable, and cannot be configured here.`,
      defaultPort: (port: string) => `Default: (${port})`,
      saveChanges: 'Save Changes',
      saveWarning: {
        external: 'When you hit Save, the UI will reload',
        internal:
          'When you hit Save, the app will attempt to reconnect using the new network settings, but may require you to adjust the URL manually.',
      },
      invalidPortSingle: 'Port numbers must be an integer between 1 and 65535',
      invalidPort:
        'Please enter a valid port number or range (e.g. "1234" or "8000-8100")',
      invalidPortRange:
        'The first port in a range must be less than or equal to the second port (e.g. "8000-8100")',
    },
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
  ltc: {
    autoDetectWarning:
      'Note: when auto-detecting framerate, there will be a delay of several seconds before playback starts while the framerate is being detected. If you know the framerate of your LTC source, it is recommended to set it manually for more responsive playback.',
    linkPlayer: 'Play LTC from this window',
    disconnectPlayer: 'Disconnect LTC Player',
  },
  audio: {
    outputSettings: 'Audio Output Settings',
    inputSettings: 'Audio Input Settings',
    channel: (channel: number) => `CH ${channel + 1}`,
    device: (device: string) => `Device: ${device}`,
  },
  midi: {
    deviceLabelForPort: (device: string) => `Device: ${device}`,
    deviceLabelForVirtual: `VIRTUAL`,
    deviceTypePort: 'Connected Device',
    deviceTypeVirtual: 'Arcane Virtual MIDI Device',
  },
  updates: {
    banner: {
      updateAvailable: (current: string, latest: string) =>
        `Version ${latest} is available! You are currently on version ${current}.`,
      download: 'Download',
      details: 'Details',
    } satisfies UpdateBannerStrings,
    details: {
      title: 'Update Details',
      close: 'Close',
    } satisfies UpdateDetailsStrings,
    settingsLabel: 'Automatically check for updates',
    settingsDetails: `When enabled, the app will automatically check for updates periodically and display a message when a new version is available.`,
    lastChecked: (time: string) => `Last checked: ${time}`,
  },
  general: {
    enabled: 'Enabled',
    disabled: 'Disabled',
    networkTargetHost: (host: string) => `Host: ${host}`,
  },
} as const;
