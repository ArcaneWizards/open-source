import z from 'zod';

export const APP_PLATFORM = z.enum(['windows', 'macos', 'linux']);

export type AppPlatform = z.infer<typeof APP_PLATFORM>;

export const APP_ARCHITECTURE = z.enum(['x64', 'arm64']);

export type AppArchitecture = z.infer<typeof APP_ARCHITECTURE>;

export const APP_EDITION = z.enum(['desktop', 'cli']);

export type AppEdition = z.infer<typeof APP_EDITION>;

/**
 * Wildcard for unknown content types,
 * to allow for forward compatibility with new content types that may be
 * added in the future.
 *
 * (must be last in zod union)
 */
const API_CONTENT_ITEM_UNKNOWN = z
  .object({
    type: z.string(),
  })
  .transform(() => ({
    type: 'unknown' as const,
  }));

const API_CONTENT_ITEM = z.union([
  z.object({
    type: z.enum(['text', 'inlineCode']),
    text: z.string(),
  }),
  z.object({
    type: z.literal('link'),
    text: z.string(),
    url: z.string(),
  }),
  API_CONTENT_ITEM_UNKNOWN,
]);

export type ApiContentItem = z.infer<typeof API_CONTENT_ITEM>;

export type ApiContent =
  | {
      type: 'container';
      children: ApiContent[];
      mode: 'inline' | 'block' | 'paragraph';
    }
  | {
      type: 'list';
      children: ApiContent[];
      listType: 'ordered' | 'unordered' | 'unstyled';
    }
  | {
      type: 'header';
      level: number;
      children: ApiContent[];
    }
  | ApiContentItem;

export const API_CONTENT: z.ZodType<ApiContent> = z.lazy(() =>
  z.union([
    z.object({
      type: z.literal('container'),
      children: z.array(API_CONTENT),
      mode: z.enum(['inline', 'block', 'paragraph']),
    }),
    z.object({
      type: z.literal('list'),
      children: z.array(API_CONTENT),
      listType: z.enum(['ordered', 'unordered', 'unstyled']),
    }),
    z.object({
      type: z.literal('header'),
      level: z.number().int().min(1).max(6),
      children: z.array(API_CONTENT),
    }),
    API_CONTENT_ITEM as z.ZodType<ApiContentItem>,
  ]),
);

export const CHECK_FOR_UPDATES_REQUEST = z.object({
  app: z.string(),
  edition: APP_EDITION,
  platform: APP_PLATFORM,
  architecture: APP_ARCHITECTURE,
  currentVersion: z.string(),
  updateId: z.string(),
});

export type CheckForUpdatesRequest = z.infer<typeof CHECK_FOR_UPDATES_REQUEST>;

export const CHECK_FOR_UPDATES_VERSION = z.object({
  version: z.string(),
  /** @deprecated */
  releaseNotes: z.literal(''),
  notes: API_CONTENT.nullable(),
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

export const GET_EULA_REQUEST = z.object({
  app: z.string(),
});

export type GetEulaRequest = z.infer<typeof GET_EULA_REQUEST>;

export const GET_EULA_RESPONSE = z.object({
  title: z.string(),
  dateLastUpdated: z.string(),
  content: API_CONTENT,
});

export type GetEulaResponse = z.infer<typeof GET_EULA_RESPONSE>;

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
  const callApi = async <TRequest, TResponse>(
    endpoint: string,
    request: TRequest,
    responseSchema: z.ZodType<TResponse>,
  ): Promise<TResponse> => {
    const response = await fetch(new URL(endpoint, baseUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      throw new ApiError(
        `Failed to call API endpoint ${endpoint}: ${response.statusText} - ${await response.text()}`,
        response,
      );
    }
    const responseData = await response.json();
    return responseSchema.parse(responseData);
  };

  const checkForUpdates = async (
    request: CheckForUpdatesRequest,
  ): Promise<CheckForUpdatesResponse> =>
    callApi('/api/v1/updates', request, CHECK_FOR_UPDATES_RESPONSE);

  const getEula = async (request: GetEulaRequest): Promise<GetEulaResponse> =>
    callApi('/api/v1/eula', request, GET_EULA_RESPONSE);

  return {
    checkForUpdates,
    getEula,
  };
};

export type ArcaneWizardsApi = ReturnType<typeof api>;
