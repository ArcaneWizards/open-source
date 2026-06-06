import {
  createContext,
  FC,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { STRINGS } from '../../constants';
import {
  ControlButton,
  ControlDialog,
  ControlInput,
  ControlLabel,
  ControlParagraph,
  ControlSelect,
  SelectOption,
} from '@arcanewizards/sigil/frontend/controls';
import { TimecodeInstanceId } from '../../../proto';
import z from 'zod';
import {
  BrowserPreferencesDefinition,
  createBrowserPreferencesHook,
} from '@arcanewizards/sigil/frontend/preferences';

type AudioDevices = {
  inputs: MediaDeviceInfo[];
  outputs: MediaDeviceInfo[];
};

type AudioDevicesQueryProviderData = {
  audioDevices:
    | null
    | { state: 'loading' }
    | { state: 'ready'; devices: AudioDevices }
    | { state: 'error'; error: string };
  refreshAudioDevices: () => void;
};

const AudioDevicesQueryContext = createContext<AudioDevicesQueryProviderData>({
  audioDevices: null,
  refreshAudioDevices: () => {
    throw new Error('No AudioDevicesQueryContext provider found.');
  },
});

export const AudioDevicesQueryProvider: FC<{ children: ReactNode }> = ({
  children,
}) => {
  const hasDevicePermission = useRef(false);

  const [audioDevices, setAudioDevices] =
    useState<AudioDevicesQueryProviderData['audioDevices']>(null);

  const getDevicePermission = useCallback(async () => {
    if (hasDevicePermission.current) {
      // Don't try to get permissions again if we've already done it once,
      // so we avoid requesting/ using microphone access unnecessarily.
      return;
    }
    // Devices will not be visible until the user has granted permission
    // which requires us to ask for microphone access and request a stream
    // even if we only care about audio output devices.
    const tempStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });
    tempStream.getTracks().forEach((track) => track.stop());
    hasDevicePermission.current = true;
  }, []);

  const refreshAudioDevices = useCallback(() => {
    setAudioDevices((current) => {
      if (current?.state === 'loading') {
        return current; // Don't do anything if we're already loading
      }

      getDevicePermission()
        .then(async () => {
          const devices = await navigator.mediaDevices.enumerateDevices();

          const outputs = devices.filter(
            (device) => device.kind === 'audiooutput',
          );
          const inputs = devices.filter(
            (device) => device.kind === 'audioinput',
          );
          setAudioDevices({ state: 'ready', devices: { inputs, outputs } });
        })
        .catch((cause) => {
          const errorMessage = `Error fetching audio devices: ${cause.message}`;
          setAudioDevices({ state: 'error', error: errorMessage });
        });
      return { state: 'loading' };
    });
  }, [getDevicePermission]);

  const data: AudioDevicesQueryProviderData = useMemo(
    () => ({
      audioDevices,
      refreshAudioDevices,
    }),
    [audioDevices, refreshAudioDevices],
  );

  return (
    <AudioDevicesQueryContext.Provider value={data}>
      {children}
    </AudioDevicesQueryContext.Provider>
  );
};

export type AudioPlaybackContextData = {
  /**
   * The device label of the currently selected audio output sink.
   *
   * `null` if default is being used.
   */
  currentSink: string | null;
  /**
   * The current volume level, from 0 to 1, where 0 is muted and 1 is full volume.
   */
  currentVolume: number;
  /**
   * Open a dialog box allowing the user to configure an output device
   * for this context.
   *
   * Null if there is no context provider.
   */
  openOutputDeviceDialog: (() => void) | null;
  /**
   * Selected output device, or null to indicate the default output device.
   */
  outputDevice: string | null;
  /**
   * Get the current audio context,
   *
   * if there is no context provider, this will throw an error when called.
   */
  ctx: () => {
    ctx: AudioContext;
    /**
     * Main destination node for audio to be sent,
     * volume is controlled internally by this provider.
     */
    masterGain: AudioNode;
  };
  errors: string[];
};

export const AudioPlaybackContext = createContext<AudioPlaybackContextData>({
  currentSink: null,
  currentVolume: 1,
  openOutputDeviceDialog: null,
  outputDevice: null,
  ctx: () => {
    throw new Error('No AudioPlaybackContext provider found.');
  },
  errors: [],
});

type AudioPlaybackContextProviderProps = {
  id: TimecodeInstanceId;
  children: ReactNode;
};

const TIMECODE_PREFERENCES = z.object({
  volume: z.number(),
  device: z
    .object({
      deviceId: z.string(),
      label: z.string(),
    })
    .nullable(),
});

type TimecodePreferences = z.infer<typeof TIMECODE_PREFERENCES>;

const AUDIO_PLAYBACK_PREFERENCES_TYPE = z.object({
  timecodes: z.record(TIMECODE_PREFERENCES),
});

type AudioPlaybackPreferences = z.infer<typeof AUDIO_PLAYBACK_PREFERENCES_TYPE>;

const DEFAULT_TIMECODE_PREFERENCES: TimecodePreferences = {
  volume: 1,
  device: null,
};

const AUDIO_PLAYBACK_PREFERENCES: BrowserPreferencesDefinition<AudioPlaybackPreferences> =
  {
    key: 'timecode-toolbox-audio-playback-preferences',
    zodType: AUDIO_PLAYBACK_PREFERENCES_TYPE,
    defaultValue: {
      timecodes: {},
    },
  };

export const useBrowserPreferences = createBrowserPreferencesHook(
  AUDIO_PLAYBACK_PREFERENCES,
);

type SelectedDevice = MediaDeviceInfo | 'default' | 'loading' | 'not-found';

export const AudioPlaybackContextProvider: FC<
  AudioPlaybackContextProviderProps
> = ({ id, children }) => {
  const prefKey = `${id[0]}:${id[1]}`;

  const { preferences, updateBrowserPrefs } = useBrowserPreferences();

  const { volume, device: wantedDevice } =
    preferences.timecodes[prefKey] ?? DEFAULT_TIMECODE_PREFERENCES;

  const [currentSink] = useState<string | null>(null);

  const [dialogSettingsOpen, setDialogSettingsOpen] = useState(false);

  const [errors, setErrors] = useState<string[]>([]);

  const ctx = useMemo(() => {
    const ctx = new AudioContext();
    const masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);
    return { ctx, masterGain };
  }, []);

  const { audioDevices, refreshAudioDevices } = useContext(
    AudioDevicesQueryContext,
  );

  const selectedDevice: SelectedDevice = useMemo(() => {
    if (!wantedDevice) {
      return 'default' as const;
    }

    if (audioDevices?.state !== 'ready') {
      return 'loading' as const;
    }

    const deviceById = audioDevices.devices.outputs.find(
      (device) => device.deviceId === wantedDevice.deviceId,
    );

    if (deviceById) {
      return deviceById;
    }

    const deviceByLabel = audioDevices.devices.outputs.find(
      (device) => device.label === wantedDevice.label,
    );

    if (deviceByLabel) {
      return deviceByLabel;
    }

    return 'not-found' as const;
  }, [wantedDevice, audioDevices]);

  const deviceSelectionOptions: SelectOption<string>[] = useMemo(() => {
    const options: SelectOption<string>[] = [
      {
        label: 'Default Device',
        value: 'default',
      },
    ];

    if (selectedDevice === 'loading') {
      options.push({
        label: 'Loading devices...',
        value: 'loading',
      });
    } else if (selectedDevice === 'not-found') {
      options.push({
        label: 'Previous device not found',
        value: 'not-found',
      });
    }

    if (audioDevices?.state === 'ready') {
      options.push(
        ...audioDevices.devices.outputs.map((device) => ({
          label: device.label || `Device ${device.deviceId}`,
          value: device.deviceId,
        })),
      );
    }

    return options;
  }, [audioDevices, selectedDevice]);

  useEffect(() => {
    ctx.masterGain.gain.value = Math.max(0, Math.min(1, volume));
  }, [volume, ctx.masterGain]);

  useEffect(() => {
    if (selectedDevice === 'loading' || selectedDevice === 'not-found') {
      return;
    }
    if (!('setSinkId' in AudioContext.prototype)) {
      setErrors(['Output device selection is not supported in this browser.']);
      return;
    }
    const c = ctx.ctx as AudioContext & {
      setSinkId: (id: string | { type: 'none' }) => Promise<void>;
    };

    c.setSinkId(
      selectedDevice === 'default' ? '' : selectedDevice.deviceId,
    ).catch((cause) => {
      const errorMessage = `Error setting audio output device: ${cause.message}`;
      // eslint-disable-next-line no-console
      console.error(new Error(errorMessage, { cause }));
      setErrors([errorMessage]);
    });
  }, [selectedDevice, ctx.ctx]);

  const closeOutputDeviceDialog = useCallback(() => {
    setDialogSettingsOpen(false);
  }, []);

  const openOutputDeviceDialog = useCallback(() => {
    setDialogSettingsOpen(true);
  }, []);

  useEffect(() => {
    // Effect for automatically loading audio devices
    if (audioDevices) {
      return;
    }
    if (dialogSettingsOpen) {
      // Automatically refresh / load audio devices
      // when the dialog is opened
      refreshAudioDevices();
    }
    if (wantedDevice) {
      // If a specific device is wanted
      // we should try to load the devices immediately
      // so we can correctly configure the context
      refreshAudioDevices();
    }
  }, [audioDevices, dialogSettingsOpen, wantedDevice, refreshAudioDevices]);

  const updateTimecodePreferences = useCallback(
    (updater: (current: TimecodePreferences) => TimecodePreferences) => {
      updateBrowserPrefs((prev) => ({
        ...prev,
        timecodes: {
          ...prev.timecodes,
          [prefKey]: updater(
            preferences.timecodes[prefKey] ?? DEFAULT_TIMECODE_PREFERENCES,
          ),
        },
      }));
    },
    [preferences.timecodes, prefKey, updateBrowserPrefs],
  );

  const data: AudioPlaybackContextData = useMemo(
    () => ({
      currentSink,
      currentVolume: volume,
      outputDevice:
        typeof selectedDevice === 'object' ? selectedDevice.label : null,
      openOutputDeviceDialog,
      ctx: () => ctx,
      errors,
    }),
    [currentSink, volume, selectedDevice, openOutputDeviceDialog, ctx, errors],
  );

  return (
    <AudioPlaybackContext.Provider value={data}>
      {dialogSettingsOpen && (
        <ControlDialog
          dialogClosed={closeOutputDeviceDialog}
          title={STRINGS.audioOutputSettings}
        >
          <ControlLabel>Volume</ControlLabel>
          {/* TODO: replace this with a slider */}
          <ControlInput
            position="both"
            type="number"
            min="0"
            max="100"
            step="5"
            value={Math.round(volume * 100).toString()}
            placeholder={`Default (100)`}
            onChange={(value, enterPressed) => {
              const volume = Math.max(
                0,
                Math.min(1, (value ? parseInt(value) : 100) / 100),
              );
              if (isNaN(volume)) {
                return;
              }
              updateTimecodePreferences((current) => ({ ...current, volume }));
              if (enterPressed) {
                closeOutputDeviceDialog();
              }
            }}
          />
          <ControlLabel>Output Device</ControlLabel>
          <ControlButton
            onClick={refreshAudioDevices}
            title="Refresh Audio Devices"
            position="first"
            variant="large"
            icon="refresh"
          />
          <ControlSelect
            value={
              typeof selectedDevice === 'string'
                ? selectedDevice
                : selectedDevice.deviceId
            }
            options={deviceSelectionOptions}
            onChange={(dev) => {
              if (
                audioDevices?.state !== 'ready' ||
                dev === 'loading' ||
                dev === 'not-found'
              ) {
                return;
              }
              if (dev === 'default') {
                updateTimecodePreferences((current) => ({
                  ...current,
                  device: null,
                }));
                return;
              }
              const selected = audioDevices.devices.outputs.find(
                (device) => device.deviceId === dev,
              );
              if (selected) {
                updateTimecodePreferences((current) => ({
                  ...current,
                  device: {
                    label: selected.label,
                    deviceId: selected.deviceId,
                  },
                }));
              } else {
                setErrors([`Selected audio device not found: ${dev}`]);
              }
            }}
            position="second"
            variant="large"
          />
          <ControlParagraph position="row">
            The options here only affect this device, and not other remotely
            connected devices.
          </ControlParagraph>
          <ControlParagraph position="row">
            If you are currently using another device to play audio, the volume
            and audio output will need to be changed directly on that device.
          </ControlParagraph>
        </ControlDialog>
      )}
      {children}
    </AudioPlaybackContext.Provider>
  );
};
