import {
  createContext,
  FC,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { STRINGS } from '../../constants';
import {
  ControlDialog,
  ControlInput,
  ControlLabel,
} from '@arcanewizards/sigil/frontend/controls';
import { TimecodeInstanceId } from '../../../proto';
import z from 'zod';
import {
  BrowserPreferencesDefinition,
  createBrowserPreferencesHook,
} from '@arcanewizards/sigil/frontend/preferences';

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

export const AudioPlaybackContextProvider: FC<
  AudioPlaybackContextProviderProps
> = ({ id, children }) => {
  const prefKey = `${id[0]}:${id[1]}`;

  const { preferences, updateBrowserPrefs } = useBrowserPreferences();

  const { volume } =
    preferences.timecodes[prefKey] ?? DEFAULT_TIMECODE_PREFERENCES;

  const [currentSink] = useState<string | null>(null);

  const [dialogSettingsOpen, setDialogSettingsOpen] = useState(false);

  const [errors] = useState<string[]>([]);

  const ctx = useMemo(() => {
    const ctx = new AudioContext();
    const masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);
    return { ctx, masterGain };
  }, []);

  useEffect(() => {
    ctx.masterGain.gain.value = Math.max(0, Math.min(1, volume));
  }, [volume, ctx.masterGain]);

  const closeOutputDeviceDialog = useCallback(() => {
    setDialogSettingsOpen(false);
  }, []);

  const openOutputDeviceDialog = useCallback(() => {
    setDialogSettingsOpen(true);
  }, []);

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
      openOutputDeviceDialog,
      ctx: () => ctx,
      errors,
    }),
    [currentSink, volume, openOutputDeviceDialog, ctx, errors],
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
        </ControlDialog>
      )}
      {children}
    </AudioPlaybackContext.Provider>
  );
};
