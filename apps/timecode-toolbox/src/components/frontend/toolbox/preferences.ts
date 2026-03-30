import {
  BrowserPreferencesDefinition,
  createBrowserPreferencesHook,
} from '@arcanewizards/sigil/frontend/preferences';
import { SIGIL_COLOR } from '@arcanewizards/sigil/frontend/styling';
import z from 'zod';

const BROWSER_PREFERENCES_KEY = 'timecode-toolbox-preferences';

const BROWSER_PREFERENCES = z.object({
  color: SIGIL_COLOR,
});

type BrowserPreferences = z.infer<typeof BROWSER_PREFERENCES>;

const TOOLBOX_PREFERENCES: BrowserPreferencesDefinition<BrowserPreferences> = {
  key: BROWSER_PREFERENCES_KEY,
  zodType: BROWSER_PREFERENCES,
  defaultValue: {
    color: 'orange',
  },
};

export const useBrowserPreferences =
  createBrowserPreferencesHook(TOOLBOX_PREFERENCES);
