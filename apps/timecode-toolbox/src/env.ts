import { Logger } from '@arcanejs/protocol/logging';

export const getEnv = (logger: Logger) => {
  const PORT = (process.env.PORT && parseInt(process.env.PORT, 10)) || null;

  let API_BASE_URL: URL;

  try {
    API_BASE_URL = process.env.API_BASE_URL
      ? new URL(process.env.API_BASE_URL)
      : new URL('https://arcanewizards.com');
  } catch (error) {
    const err = new Error(`Invalid API_BASE_URL: ${process.env.API_BASE_URL}`);
    err.cause = error instanceof Error ? error : new Error(String(error));
    logger.error(err);
    throw err;
  }

  return {
    PORT,
    API_BASE_URL,
  };
};
