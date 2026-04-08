import z from 'zod';

export const APP_PLATFORM = z.enum(['windows', 'macos', 'linux']);

export type AppPlatform = z.infer<typeof APP_PLATFORM>;

export const APP_ARCHITECTURE = z.enum(['x64', 'arm64']);

export type AppArchitecture = z.infer<typeof APP_ARCHITECTURE>;

export const APP_EDITION = z.enum(['desktop', 'cli']);

export type AppEdition = z.infer<typeof APP_EDITION>;

export const CHECK_FOR_UPDATES_REQUEST = z.object({
  app: z.string(),
  edition: APP_EDITION,
  platform: APP_PLATFORM,
  architecture: APP_ARCHITECTURE,
  currentVersion: z.string(),
});

export type CheckForUpdatesRequest = z.infer<typeof CHECK_FOR_UPDATES_REQUEST>;

export const CHECK_FOR_UPDATES_VERSION = z.object({
  version: z.string(),
  releaseNotes: z.string(),
});

export type CheckForUpdatesVersion = z.infer<typeof CHECK_FOR_UPDATES_VERSION>;

export const CHECK_FOR_UPDATES_RESPONSE = z.object({
  downloadUrl: z.string().optional(),
  latestVersion: z.string(),
  newVersions: z.array(CHECK_FOR_UPDATES_VERSION).optional(),
});

export type CheckForUpdatesResponse = z.infer<
  typeof CHECK_FOR_UPDATES_RESPONSE
>;

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly response: Response,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const api = (baseUrl: URL) => {
  const checkForUpdates = async (
    request: CheckForUpdatesRequest,
  ): Promise<CheckForUpdatesResponse> => {
    const response = await fetch(new URL('/api/v1/updates', baseUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      throw new ApiError(
        `Failed to check for updates: ${response.statusText} - ${await response.text()}`,
        response,
      );
    }
    const responseData = await response.json();
    return CHECK_FOR_UPDATES_RESPONSE.parse(responseData);
  };

  return {
    checkForUpdates,
  };
};
