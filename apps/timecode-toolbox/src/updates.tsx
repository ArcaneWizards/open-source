import { FC, useCallback, useEffect } from 'react';
import {
  AppArchitecture,
  AppEdition,
  AppPlatform,
  ArcaneWizardsApi,
} from '@arcanewizards/apis';
import { useLogger } from '@arcanewizards/sigil';
import { UpdateCheckResult } from '@arcanewizards/sigil/frontend/updates';
import { ToolboxConfigData } from './config';
import { useDataFileContext } from '@arcanejs/react-toolkit/data';

type UpdateCheckerProps = {
  api: ArcaneWizardsApi;
  version: string;
  edition: AppEdition;
  setUpdateState: (update: UpdateCheckResult | null) => void;
};

const getAppPlatform = (): AppPlatform => {
  switch (process.platform) {
    case 'win32':
      return 'windows';
    case 'darwin':
      return 'macos';
    case 'linux':
      return 'linux';
    default:
      throw new Error(`Unsupported platform: ${process.platform}`);
  }
};

const getAppArchitecture = (): AppArchitecture => {
  switch (process.arch) {
    case 'x64':
      return 'x64';
    case 'arm64':
      return 'arm64';
    default:
      throw new Error(`Unsupported architecture: ${process.arch}`);
  }
};

export const UpdateChecker: FC<UpdateCheckerProps> = ({
  api,
  version,
  edition,
  setUpdateState,
}) => {
  const { data } = useDataFileContext(ToolboxConfigData);

  const logger = useLogger();

  const checkForUpdates = useCallback(() => {
    if (!data.agreedToEula || !data.checkForUpdates) {
      return;
    }
    const lastCheckedMillis = Date.now();
    setUpdateState({ type: 'loading' });
    api
      .checkForUpdates({
        app: 'timecode-toolbox',
        edition,
        platform: getAppPlatform(),
        architecture: getAppArchitecture(),
        currentVersion: version,
        updateId: data.agreedToEula.updateId,
      })
      .then((response) => {
        if (!response.newVersions || response.newVersions.length === 0) {
          setUpdateState({ type: 'up-to-date', lastCheckedMillis });
          logger.info('No updates available');
          return;
        }
        setUpdateState({
          type: 'updates-available',
          lastCheckedMillis,
          response,
        });
        logger.info(
          `Update available: ${response.latestVersion} - Download at ${response.downloadUrl}`,
        );
      })
      .catch((error: Error) => {
        const err = new Error('Failed to check for updates');
        err.cause = error instanceof Error ? error : new Error(String(error));
        setUpdateState({
          lastCheckedMillis,
          type: 'error',
          error: String(err),
        });
        logger.error(err);
      });
  }, [
    api,
    setUpdateState,
    edition,
    logger,
    version,
    data.agreedToEula,
    data.checkForUpdates,
  ]);

  useEffect(() => {
    checkForUpdates();

    const interval = setInterval(checkForUpdates, 1000 * 60 * 60); // Check every hour
    return () => clearInterval(interval);
  }, [checkForUpdates]);

  useEffect(() => {
    return () => {
      setUpdateState(null);
    };
  }, [setUpdateState]);

  return null;
};
