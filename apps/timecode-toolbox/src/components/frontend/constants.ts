import { TIMECODE_FPS } from '@arcanewizards/artnet/constants';

const MS_FORMAT = new Intl.NumberFormat(undefined, {
  style: 'unit',
  unit: 'millisecond',
  maximumFractionDigits: 0,
});

export const STRINGS = {
  title: 'Timecode Toolbox',
  debugger: 'Debug Tools & Log',
  toggle: (text: string) => `Toggle ${text}`,
  close: (text: string) => `Close ${text}`,
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
  },
  outputs: {
    title: 'OUTPUTS',
    noChildren: 'No outputs yet. Please add one using the buttons below.',
    addButton: (protocol: string) => `Add ${protocol}`,
    addDialog: (protocol: string) => `Add ${protocol} Output`,
    editDialog: (protocol: string, name: string) =>
      `Edit ${protocol} Output ${name}`,
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
} as const;
