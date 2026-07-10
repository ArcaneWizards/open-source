import { FC, useCallback, useEffect, useState } from 'react';
import { Icon } from '@arcanejs/toolkit-frontend/components/core';
import { useSystemInformation } from './context';
import { useBrowserContext } from './browser-context';
import type { CheckForUpdatesResponse } from '@arcanewizards/apis';
import { ToolbarDivider, ToolbarRow, ToolbarWrapper } from './toolbars';
import { ControlButton } from './controls';
import { apiContentToReact } from './utils';

export type UpdateCheckStrings = {
  download: string;
  details: string;
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
  strings: UpdateCheckStrings;
  updates: UpdateCheckResult | null;
  openDetails?: () => void;
};

const BANNER_BUTTON_CLS = `
  flex cursor-pointer items-center gap-0.5 rounded-md border
  border-sigil-usage-hint-selected-border
  bg-sigil-usage-hint-selected-background px-1 py-0.5
  text-sigil-usage-hint-text
  hover:bg-sigil-usage-hint-selected-border
`;

export const UpdateBanner: FC<UpdateBannerProps> = ({
  strings,
  updates,
  openDetails,
}) => {
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
          border-sigil-usage-hint-border bg-sigil-usage-hint-background p-1
          text-sigil-usage-hint-text
        "
      >
        <Icon icon="upgrade" />
        {strings.updateAvailable(version, displayState.response.latestVersion)}
        {openDetails && (
          <button className={BANNER_BUTTON_CLS} onClick={openDetails}>
            <Icon icon="info" />
            {strings.details}
          </button>
        )}
        {displayState.response.downloadUrl && (
          <button className={BANNER_BUTTON_CLS} onClick={openDownloadLink}>
            <Icon icon="download" />
            {strings.download}
          </button>
        )}
      </div>
    );
  }

  return null;
};

export type UpdateDetailsStrings = {
  title: string;
  close: string;
};

type UpdateDetailsProps = {
  updates: UpdateCheckResult;
  strings: UpdateDetailsStrings;
  closeDetails: () => void;
};

export const UpdateDetails: FC<UpdateDetailsProps> = ({
  updates,
  strings,
  closeDetails,
}) => {
  const { version } = useSystemInformation();

  if (updates.type !== 'updates-available') {
    return null;
  }

  return (
    <div className="flex grow flex-col">
      <ToolbarWrapper>
        <ToolbarRow>
          <span className="grow p-1">{strings.title}</span>
          <ToolbarDivider />
          <ControlButton
            onClick={closeDetails}
            variant="titlebar"
            icon="close"
            title={strings.close}
          />
        </ToolbarRow>
      </ToolbarWrapper>
      <div
        className="
          grow basis-0 overflow-y-auto bg-sigil-bg-light scrollbar-sigil flex flex-col p-2 gap-2 select-text
        "
      >
        <p className="m-0 p-0">
          {`There have been ${(updates.response.newVersions ?? []).length} new update(s) since the version you are currently running (${version}).`}
        </p>
        {(updates.response.newVersions ?? []).map((update) => (
          <div
            key={update.version}
            className="flex flex-col gap-2 border border-sigil-border bg-sigil-bg-dark p-2"
          >
            <h3 className="m-0 p-0">{`Version ${update.version}`}</h3>
            {update.notes && <div>{apiContentToReact(update.notes)}</div>}
          </div>
        ))}
      </div>
    </div>
  );
};
