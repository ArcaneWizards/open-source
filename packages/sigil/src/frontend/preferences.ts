import { useEffect, useState } from 'react';
import z from 'zod';

export type BrowserPreferencesDefinition<T> = {
  key: string;
  zodType: z.ZodType<T>;
  defaultValue: T;
};

export const createBrowserPreferencesHook =
  <T>(def: BrowserPreferencesDefinition<T>) =>
  () => {
    const [preferences, setPreference] = useState<T>(() => {
      const stored = window.localStorage.getItem(def.key);
      if (stored) {
        try {
          return def.zodType.parse(JSON.parse(stored));
        } catch (err) {
          // eslint-disable-next-line no-console
          console.log('Failed to parse browser settings, using defaults.', err);
        }
      }
      return def.defaultValue;
    });

    const updateBrowserPrefs = (change: (current: T) => T) => {
      const newValue = JSON.stringify(change(preferences));
      window.localStorage.setItem(def.key, newValue);
      // Broadcast event for this tab
      // We do this rather than call `setPreference` directly so that
      // all hooks stay in sync via the storage event listener
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: def.key,
          newValue,
        }),
      );
    };

    useEffect(() => {
      const onStorageChange = (event: StorageEvent) => {
        if (event.key === def.key) {
          const newValue = event.newValue;
          if (newValue) {
            try {
              setPreference(def.zodType.parse(JSON.parse(newValue)));
            } catch (err) {
              // eslint-disable-next-line no-console
              console.log(
                'Failed to parse browser settings from storage event, ignoring.',
                err,
              );
            }
          }
        }
      };
      window.addEventListener('storage', onStorageChange);

      return () => {
        window.removeEventListener('storage', onStorageChange);
      };
    }, []);

    return {
      preferences,
      updateBrowserPrefs,
      defaultPreferences: def.defaultValue,
    };
  };
