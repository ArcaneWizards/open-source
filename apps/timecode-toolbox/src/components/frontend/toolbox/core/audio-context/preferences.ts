import {
  BrowserPreferencesDefinition,
  createBrowserPreferencesHook,
} from '@arcanewizards/sigil/frontend/preferences';
import z from 'zod';

// General

const TIMECODE_PREFERENCES = z.object({
  volume: z.number(),
  device: z
    .object({
      deviceId: z.string(),
      label: z.string(),
    })
    .nullable(),
  /**
   * Only used in singleChannel mode / recording context */
  channel: z.number(),
});

export type TimecodePreferences = z.infer<typeof TIMECODE_PREFERENCES>;

export const DEFAULT_TIMECODE_PREFERENCES: TimecodePreferences = {
  volume: 1,
  device: null,
  channel: 0,
};

// Recording

const AUDIO_RECORDING_PREFERENCES_TYPE = z.object({
  timecodes: z.record(TIMECODE_PREFERENCES),
});

type AudioRecordingPreferences = z.infer<
  typeof AUDIO_RECORDING_PREFERENCES_TYPE
>;

export const AUDIO_RECORDING_PREFERENCES: BrowserPreferencesDefinition<AudioRecordingPreferences> =
  {
    key: 'timecode-toolbox-audio-recording-preferences',
    zodType: AUDIO_RECORDING_PREFERENCES_TYPE,
    defaultValue: {
      timecodes: {},
    },
  };

export const useBrowserRecordingPreferences = createBrowserPreferencesHook(
  AUDIO_RECORDING_PREFERENCES,
);

// Playback

const AUDIO_PLAYBACK_PREFERENCES_TYPE = z.object({
  timecodes: z.record(TIMECODE_PREFERENCES),
});

type AudioPlaybackPreferences = z.infer<typeof AUDIO_PLAYBACK_PREFERENCES_TYPE>;

const AUDIO_PLAYBACK_PREFERENCES: BrowserPreferencesDefinition<AudioPlaybackPreferences> =
  {
    key: 'timecode-toolbox-audio-playback-preferences',
    zodType: AUDIO_PLAYBACK_PREFERENCES_TYPE,
    defaultValue: {
      timecodes: {},
    },
  };

export const useBrowserPlaybackPreferences = createBrowserPreferencesHook(
  AUDIO_PLAYBACK_PREFERENCES,
);
