import path from 'path';
import pino from 'pino';
import { runTimecodeToolboxServer } from '.';
import { homedir } from 'os';

const DATA_DIR = path.join(homedir(), 'timecode-toolbox');

const logger = pino({
  level: 'info',
  transport: {
    target: 'pino-pretty',
  },
});

const server = runTimecodeToolboxServer({
  logger,
  appProps: {
    dataDirectory: DATA_DIR,
  },
  toolkitOptions: {
    entrypointJsFile: path.join(path.dirname(__dirname), 'dist/entrypoint.js'),
  },
  title: 'Timecode Toolbox Server',
});

const shutdown = () =>
  server
    .shutdown()
    .catch((err) => {
      logger.error({ err }, 'Error during shutdown');
    })
    .finally(() => {
      process.exit(0);
    });

// Catch SIGINT and SIGTERM to allow for graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down...');
  shutdown();
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down...');
  shutdown();
});

export {};
