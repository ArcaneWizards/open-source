import { type FC, useCallback, useEffect } from 'react';
import type {
  AppArchitecture,
  AppEdition,
  AppPlatform,
  ArcaneWizardsApi,
} from '@arcanewizards/apis';
import type { UpdateCheckResult } from './frontend/updates';
import { useLogger } from './context';

type UpdateCheckerProps = {
  api: ArcaneWizardsApi;
  app: string;
  version: string;
  edition: AppEdition;
  setUpdateState: (update: UpdateCheckResult | null) => void;
  config: {
    agreedToEula?: {
      updateId: string;
    };
    checkForUpdates: boolean;
  };
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
  app,
  api,
  version,
  edition,
  setUpdateState,
  config,
}) => {
  const logger = useLogger();

  const checkForUpdates = useCallback(() => {
    if (!config.agreedToEula || !config.checkForUpdates) {
      return;
    }
    const lastCheckedMillis = Date.now();
    setUpdateState({ type: 'loading' });
    api
      .checkForUpdates({
        app,
        edition,
        platform: getAppPlatform(),
        architecture: getAppArchitecture(),
        currentVersion: version,
        updateId: config.agreedToEula.updateId,
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
    app,
    api,
    setUpdateState,
    edition,
    logger,
    version,
    config.agreedToEula,
    config.checkForUpdates,
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
