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
import {
  GeneratorState,
  InputState,
  OutputState,
  TimecodeInstanceId,
} from '../../../proto';
import {
  DEFAULT_TIMECODE_PREFERENCES,
  TimecodePreferences,
  useBrowserPlaybackPreferences,
  useBrowserRecordingPreferences,
} from './audio-context/preferences';

export type RootAudioContextData = {
  downloadAudioFile: (
    generatorUuid: string,
  ) => Promise<ReadableStream<Uint8Array<ArrayBuffer>>>;
  updateInputState: (
    inputUuid: string,
    claim: boolean,
    state: Omit<InputState, 'controlledBy'>,
  ) => void;
  updatePlayerState: (
    generatorUuid: string,
    claim: boolean,
    state: Omit<GeneratorState, 'controlledBy'>,
  ) => void;
  updateOutputState: (
    outputUuid: string,
    claim: boolean,
    state: Omit<OutputState, 'controlledBy'>,
  ) => void;
  releaseControl: (id: TimecodeInstanceId, force?: boolean) => void;
};

export const RootAudioContext = createContext<RootAudioContextData>({
  downloadAudioFile: async () => {
    throw new Error('RootAudioContext not initialized');
  },
  updateInputState: () => {
    throw new Error('RootAudioContext not initialized');
  },
  updatePlayerState: () => {
    throw new Error('RootAudioContext not initialized');
  },
  updateOutputState: () => {
    throw new Error('RootAudioContext not initialized');
  },
  releaseControl: () => {
    throw new Error('RootAudioContext not initialized');
  },
});

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

export type GeneralAudioContext = {
  /**
   * The current volume level, from 0 to 1, where 0 is muted and 1 is full volume.
   */
  currentVolume: number;
  errors: string[];
  ctx: () => {
    ctx: AudioContext;
    /**
     * Main destination node for audio to be sent,
     * or source node for recorded audio to be received from.
     * Volume is controlled internally by this provider.
     */
    masterGain: AudioNode;
  };
};

const useContextAndGain = (volume: number) => {
  const ctx = useMemo(() => {
    const ctx = new AudioContext();
    const masterGain = ctx.createGain();
    return { ctx, masterGain };
  }, []);

  useEffect(() => {
    ctx.masterGain.gain.value = Math.max(0, Math.min(1, volume));
  }, [volume, ctx.masterGain]);

  return ctx;
};

const useDeviceDialog = () => {
  const [dialogSettingsOpen, setDialogSettingsOpen] = useState(false);

  const closeDeviceDialog = useCallback(() => {
    setDialogSettingsOpen(false);
  }, []);

  const openDeviceDialog = useCallback(() => {
    setDialogSettingsOpen(true);
  }, []);

  return {
    dialogSettingsOpen,
    closeDeviceDialog,
    openDeviceDialog,
  };
};

const useDeviceSelectionAndOptions = (
  type: 'inputs' | 'outputs',
  wantedDevice: TimecodePreferences['device'],
  dialogSettingsOpen: boolean,
  onDeviceSelected: (device: TimecodePreferences['device']) => void,
) => {
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

    const deviceById = audioDevices.devices[type].find(
      (device) => device.deviceId === wantedDevice.deviceId,
    );

    if (deviceById) {
      return deviceById;
    }

    const deviceByLabel = audioDevices.devices[type].find(
      (device) => device.label === wantedDevice.label,
    );

    if (deviceByLabel) {
      return deviceByLabel;
    }

    return 'not-found' as const;
  }, [type, wantedDevice, audioDevices]);

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
        ...audioDevices.devices[type].map((device) => ({
          label: device.label || `Device ${device.deviceId}`,
          value: device.deviceId,
        })),
      );
    }

    return options;
  }, [type, audioDevices, selectedDevice]);

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

  const onSelectedDeviceChange = useCallback(
    (dev: string) => {
      if (
        audioDevices?.state !== 'ready' ||
        dev === 'loading' ||
        dev === 'not-found'
      ) {
        return;
      }
      if (dev === 'default') {
        onDeviceSelected(null);
        return;
      }
      const selected = audioDevices.devices[type].find(
        (device) => device.deviceId === dev,
      );
      if (selected) {
        onDeviceSelected({
          label: selected.label,
          deviceId: selected.deviceId,
        });
      }
    },
    [type, audioDevices, onDeviceSelected],
  );

  return {
    selectedDevice,
    deviceSelectionOptions,
    refreshAudioDevices,
    onSelectedDeviceChange,
  };
};

// Recording

export type AudioRecordingContextData = GeneralAudioContext & {
  openInputDeviceDialog: (() => void) | null;
  /** Set to true to start recording data and sending it to the masterGain */
  setRecordInput: (record: boolean) => void;
  inputDevice: string | null;
  inputChannel: number | null;
};

export const AudioRecordingContext = createContext<AudioRecordingContextData>({
  currentVolume: 1,
  openInputDeviceDialog: null,
  setRecordInput: () => {
    throw new Error('AudioRecordingContext not initialized');
  },
  ctx: () => {
    throw new Error('No AudioPlaybackContext provider found.');
  },
  inputDevice: null,
  inputChannel: null,
  errors: [],
});

type AudioRecordingContextProviderProps = {
  id: TimecodeInstanceId;
  children: ReactNode;
};

export const AudioRecordingContextProvider: FC<
  AudioRecordingContextProviderProps
> = ({ id, children }) => {
  const prefKey = `${id[0]}:${id[1]}`;

  const { preferences, updateBrowserPrefs } = useBrowserRecordingPreferences();

  const {
    volume,
    device: wantedDevice,
    channel,
  } = preferences.timecodes[prefKey] ?? DEFAULT_TIMECODE_PREFERENCES;

  const [recordInput, setRecordInput] = useState(false);

  const { dialogSettingsOpen, openDeviceDialog, closeDeviceDialog } =
    useDeviceDialog();

  const [deviceChannelCount, setDeviceChannelCount] = useState<{
    device: SelectedDevice;
    channelCount: number;
  } | null>(null);

  const ctx = useContextAndGain(volume);

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

  const onDeviceSelected = useCallback(
    (device: TimecodePreferences['device']) =>
      updateTimecodePreferences((current) => ({
        ...current,
        device,
      })),
    [updateTimecodePreferences],
  );

  const {
    selectedDevice,
    deviceSelectionOptions,
    refreshAudioDevices,
    onSelectedDeviceChange,
  } = useDeviceSelectionAndOptions(
    'inputs',
    wantedDevice,
    dialogSettingsOpen,
    onDeviceSelected,
  );

  const [inputNode, setInputNode] = useState<AudioNode | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [channelError, setChannelError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedDevice === 'loading' || selectedDevice === 'not-found') {
      return;
    }

    let track: MediaStreamTrack | null = null;
    let mounted = true;

    navigator.mediaDevices
      .getUserMedia({
        audio: {
          deviceId:
            selectedDevice === 'default'
              ? undefined
              : { exact: selectedDevice.deviceId },
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          // Capture all channels
          channelCount: 0,
        },
      })
      .then((mediaStream) => {
        if (!mounted) {
          // No longer relevant
          return;
        }

        const tracks = mediaStream.getAudioTracks();
        track = tracks[0] ?? null;
        if (tracks.length !== 1 || !track) {
          mediaStream.getTracks().forEach((track) => track.stop());
          throw new Error(
            `Expected exactly 1 audio track, but got ${tracks.length}`,
          );
        }

        // Get channel count for the selected device
        const channelCount =
          track.getCapabilities().channelCount?.max ??
          track.getSettings().channelCount;
        if (typeof channelCount !== 'number') {
          throw new Error(
            'Could not get channel count from audio track settings',
          );
        }
        setDeviceChannelCount({ device: selectedDevice, channelCount });

        if (recordInput) {
          const sourceNode = ctx.ctx.createMediaStreamSource(mediaStream);
          // Set to maximum available channel count
          sourceNode.channelCount = channelCount;
          setInputNode(sourceNode);
        } else {
          track.stop();
        }
      })
      .catch((cause) => {
        const errorMessage = `Error accessing audio input device: ${cause.message}`;
        const error = new Error(errorMessage, { cause });
        // eslint-disable-next-line no-console
        console.error(error);
        setStreamError(errorMessage);
      });

    return () => {
      mounted = false;
      if (track) {
        track.stop();
      }
    };
  }, [ctx, selectedDevice, recordInput]);

  useEffect(() => {
    if (!inputNode) {
      setChannelError(null);
      return;
    }

    if (channel >= inputNode.channelCount) {
      setChannelError(
        `Selected channel ${channel + 1} exceeds maximum channel count of output device (${inputNode.channelCount})`,
      );
    }

    // Connect the specific channel from the input node to the master gain
    const channelSplitter = ctx.ctx.createChannelSplitter(
      inputNode.channelCount,
    );
    inputNode.connect(channelSplitter);
    channelSplitter.connect(ctx.masterGain, channel);

    return () => {
      inputNode.disconnect();
    };
  }, [inputNode, channel, ctx.ctx, ctx.masterGain]);

  const channelSelectionOptions: SelectOption<string>[] = useMemo(
    () =>
      deviceChannelCount
        ? Array.from({ length: deviceChannelCount.channelCount }, (_, i) => ({
            label: `Channel ${i + 1}`,
            value: i.toString(),
          }))
        : [
            {
              label: 'Loading channels...',
              value: 'loading',
            },
          ],
    [deviceChannelCount],
  );

  const errors = useMemo(
    () => [
      ...(channelError ? [channelError] : []),
      ...(streamError ? [streamError] : []),
    ],
    [channelError, streamError],
  );

  const data: AudioRecordingContextData = useMemo(
    () => ({
      currentVolume: 1,
      openInputDeviceDialog: openDeviceDialog,
      setRecordInput,
      inputDevice:
        typeof selectedDevice === 'object' ? selectedDevice.label : null,
      inputChannel: channel,
      ctx: () => ctx,
      errors,
    }),
    [ctx, setRecordInput, openDeviceDialog, errors, selectedDevice, channel],
  );

  return (
    <AudioRecordingContext.Provider value={data}>
      {dialogSettingsOpen && (
        <ControlDialog
          dialogClosed={closeDeviceDialog}
          title={STRINGS.audio.inputSettings}
        >
          <ControlLabel>Input Device</ControlLabel>
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
            onChange={onSelectedDeviceChange}
            position="second"
            variant="large"
          />
          <ControlLabel>Input Channel</ControlLabel>
          <ControlSelect
            value={deviceChannelCount ? channel.toString() : 'loading'}
            options={channelSelectionOptions}
            onChange={(value) => {
              const channel = parseInt(value);
              if (isNaN(channel)) {
                return;
              }
              updateTimecodePreferences((current) => ({
                ...current,
                channel,
              }));
            }}
            position="both"
            variant="large"
          />
          <ControlParagraph position="row" mode="warning">
            Note, only 2 input channels are supported at this time.
          </ControlParagraph>
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
    </AudioRecordingContext.Provider>
  );
};

// Playback

export type AudioPlaybackContextData = GeneralAudioContext & {
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
  outputChannel: number | null;
};

export const AudioPlaybackContext = createContext<AudioPlaybackContextData>({
  currentVolume: 1,
  openOutputDeviceDialog: null,
  outputDevice: null,
  outputChannel: null,
  ctx: () => {
    throw new Error('No AudioPlaybackContext provider found.');
  },
  errors: [],
});

type AudioPlaybackContextProviderProps = {
  id: TimecodeInstanceId;
  children: ReactNode;
  singleChannel?: boolean;
};

type SelectedDevice = MediaDeviceInfo | 'default' | 'loading' | 'not-found';

export const AudioPlaybackContextProvider: FC<
  AudioPlaybackContextProviderProps
> = ({ id, children, singleChannel }) => {
  const prefKey = `${id[0]}:${id[1]}`;

  const { preferences, updateBrowserPrefs } = useBrowserPlaybackPreferences();

  const {
    volume,
    device: wantedDevice,
    channel,
  } = preferences.timecodes[prefKey] ?? DEFAULT_TIMECODE_PREFERENCES;

  const { dialogSettingsOpen, openDeviceDialog, closeDeviceDialog } =
    useDeviceDialog();

  const [channelCount, setChannelCount] = useState<number | null>(null);

  const [channelError, setChannelError] = useState<string | null>(null);
  const [outputDeviceError, setOutputDeviceError] = useState<string | null>(
    null,
  );

  const ctx = useContextAndGain(volume);

  useEffect(() => {
    const { ctx: context, masterGain } = ctx;

    const { maxChannelCount } = context.destination;

    if (channelCount === null) {
      // Not yet initialized, return
      return;
    }

    // We need to use channelCount on destination,
    // so that we reconfigure masterGain and destination when user changes to an
    // output device with a different number of channels.
    if (channelCount !== maxChannelCount) {
      setChannelError('Internal error with channel count sync');
      return () => {
        masterGain.disconnect();
      };
    }

    //  Disconnect master gain from any previous connections
    masterGain.disconnect();

    if (!singleChannel) {
      // We can just connect the master gain directly to the destination
      // Switch to stereo/mono mode
      const outputChannels = Math.max(2, maxChannelCount);
      context.destination.channelCount = outputChannels;
      masterGain.channelCount = outputChannels;
      masterGain.connect(context.destination);
      setChannelError(null);
      return;
    }

    if (channel >= maxChannelCount) {
      setChannelError(
        `Selected channel ${channel + 1} exceeds maximum channel count of output device (${maxChannelCount})`,
      );
      return;
    }

    context.destination.channelCount = maxChannelCount;
    masterGain.channelCount = maxChannelCount;
    const channelMerger = context.createChannelMerger(maxChannelCount);
    masterGain.connect(channelMerger, 0, channel);
    channelMerger.connect(context.destination);
    setChannelError(null);

    return () => {
      masterGain.disconnect();
      channelMerger.disconnect();
    };
  }, [ctx, singleChannel, channelCount, channel]);

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

  const onDeviceSelected = useCallback(
    (device: TimecodePreferences['device']) =>
      updateTimecodePreferences((current) => ({
        ...current,
        device,
      })),
    [updateTimecodePreferences],
  );

  const {
    selectedDevice,
    deviceSelectionOptions,
    refreshAudioDevices,
    onSelectedDeviceChange,
  } = useDeviceSelectionAndOptions(
    'outputs',
    wantedDevice,
    dialogSettingsOpen,
    onDeviceSelected,
  );

  useEffect(() => {
    if (selectedDevice === 'loading' || selectedDevice === 'not-found') {
      return;
    }
    if (!('setSinkId' in AudioContext.prototype)) {
      setOutputDeviceError(
        'Output device selection is not supported in this browser.',
      );
      return;
    }
    const c = ctx.ctx as AudioContext & {
      setSinkId: (id: string | { type: 'none' }) => Promise<void>;
    };

    c.setSinkId(selectedDevice === 'default' ? '' : selectedDevice.deviceId)
      .then(() => {
        // Configure
        setChannelCount(c.destination.maxChannelCount);
        setOutputDeviceError(null);
      })
      .catch((cause) => {
        const errorMessage = `Error setting audio output device: ${cause.message}`;
        // eslint-disable-next-line no-console
        console.error(new Error(errorMessage, { cause }));
        setOutputDeviceError(errorMessage);
      });
  }, [selectedDevice, ctx.ctx]);

  const errors = useMemo(
    () => [
      ...(channelError ? [channelError] : []),
      ...(outputDeviceError ? [outputDeviceError] : []),
    ],
    [channelError, outputDeviceError],
  );

  const outputChannel = singleChannel ? channel : null;

  const channelSelectionOptions: SelectOption<string>[] = useMemo(
    () =>
      Array.from({ length: channelCount ?? 0 }, (_, i) => ({
        label: `Channel ${i + 1}`,
        value: i.toString(),
      })),
    [channelCount],
  );

  const data: AudioPlaybackContextData = useMemo(
    () => ({
      currentVolume: volume,
      outputDevice:
        typeof selectedDevice === 'object' ? selectedDevice.label : null,
      outputChannel,
      openOutputDeviceDialog: openDeviceDialog,
      ctx: () => ctx,
      errors,
    }),
    [volume, selectedDevice, outputChannel, openDeviceDialog, ctx, errors],
  );

  return (
    <AudioPlaybackContext.Provider value={data}>
      {dialogSettingsOpen && (
        <ControlDialog
          dialogClosed={closeDeviceDialog}
          title={STRINGS.audio.outputSettings}
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
                closeDeviceDialog();
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
            onChange={onSelectedDeviceChange}
            position="second"
            variant="large"
          />
          {singleChannel && (
            <>
              <ControlLabel>Output Channel</ControlLabel>
              <ControlSelect
                value={channel.toString()}
                options={channelSelectionOptions}
                onChange={(value) => {
                  const channel = parseInt(value);
                  if (isNaN(channel)) {
                    return;
                  }
                  updateTimecodePreferences((current) => ({
                    ...current,
                    channel,
                  }));
                }}
                position="both"
                variant="large"
              />
            </>
          )}
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
