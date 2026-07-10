import { FC, useCallback, useEffect, useState } from 'react';
import { Icon } from '@arcanejs/toolkit-frontend/components/core';
import { useSystemInformation } from './context';
import { useBrowserContext } from './browser-context';
import type { CheckForUpdatesResponse } from '@arcanewizards/apis';

type Strings = {
  download: string;
  updateAvailable: (currentVersion: string, latestVersion: string) => string;
};

export type UpdateCheckResult =
  | {
      type: 'loading';
    }
  | {
      type: 'updates-available';
      response: CheckForUpdatesResponse;
      lastCheckedMillis: number;
    }
  | {
      type: 'up-to-date';
      lastCheckedMillis: number;
    }
  | {
      type: 'error';
      error: string;
      lastCheckedMillis: number;
    };

type UpdateBannerProps = {
  strings: Strings;
  updates: UpdateCheckResult | null;
};

export const UpdateBanner: FC<UpdateBannerProps> = ({ strings, updates }) => {
  const { version } = useSystemInformation();
  const { openExternalLink } = useBrowserContext();

  /**
   * Avoid changes to the displayed update state due to refreshing the updates,
   * to avoid layout shifts in the banner. Only update this component when the
   * state has been settled.
   */
  const [displayState, setDisplayState] = useState<null | Exclude<
    UpdateCheckResult,
    { type: 'loading' }
  >>();

  useEffect(() => {
    if (updates?.type !== 'loading') {
      setDisplayState(updates);
    }
  }, [updates]);

  const openDownloadLink = useCallback(() => {
    if (
      displayState?.type === 'updates-available' &&
      displayState.response.downloadUrl
    ) {
      openExternalLink(displayState.response.downloadUrl);
    }
  }, [displayState, openExternalLink]);

  if (displayState?.type === 'error') {
    return (
      <div
        className="
          flex items-center justify-center gap-2 border-b
          border-sigil-usage-orange-border bg-sigil-usage-orange-background p-1
          text-sigil-usage-orange-text
        "
      >
        <Icon icon="error" />
        {displayState.error}
      </div>
    );
  }

  if (displayState?.type === 'updates-available') {
    return (
      <div
        className="
          flex items-center justify-center gap-2 border-b
          border-sigil-usage-blue-border bg-sigil-usage-blue-background p-1
          text-sigil-usage-blue-text
        "
      >
        <Icon icon="upgrade" />
        {strings.updateAvailable(version, displayState.response.latestVersion)}
        {displayState.response.downloadUrl && (
          <button
            className="
              flex cursor-pointer items-center gap-0.5 rounded-md border
              border-sigil-usage-blue-selected-border
              bg-sigil-usage-blue-selected-background px-1 py-0.5
              text-sigil-usage-blue-text
              hover:bg-sigil-usage-blue-selected-border
            "
            onClick={openDownloadLink}
          >
            <Icon icon="download" />
            {strings.download}
          </button>
        )}
      </div>
    );
  }

  return null;
};
