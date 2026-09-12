/* eslint-disable no-console */

/**
 * Manual integration harness for local network access.
 *
 * Runs a real probe against the machine's network and prints the raw event
 * trace, so that the granted/denied decision rule can be checked against what
 * macOS actually reports.
 *
 * Usage:
 *
 *   node scripts/test-integration.mjs [serviceType...]
 *
 * To exercise the denial path, revoke Local Network access for the responsible
 * process (for a terminal run, that is the terminal application itself) in
 * System Settings > Privacy & Security > Local Network, then run this again.
 */
import { probeLocalNetworkAccess, DEFAULT_SERVICE_TYPES } from '../dist/index.js';

const serviceTypes =
  process.argv.slice(2).length > 0 ? process.argv.slice(2) : DEFAULT_SERVICE_TYPES;

const main = async () => {
  if (process.platform !== 'darwin') {
    console.log('Local network access probing is only supported on macOS.');
    return;
  }

  console.log(`Browsing for: ${serviceTypes.join(', ')}`);
  console.log('');

  const started = Date.now();
  const result = await probeLocalNetworkAccess({ serviceTypes });
  const elapsed = Date.now() - started;

  for (const event of result.events) {
    if (event.type === 'state') {
      const error = event.error
        ? ` error=${event.error.domain}/${event.error.code}`
        : '';
      console.log(`  state  ${event.serviceType.padEnd(22)} ${event.state}${error}`);
    } else {
      console.log(
        `  result ${event.serviceType.padEnd(22)} ${event.change} total=${event.total} ${event.name ?? ''}`,
      );
    }
  }

  console.log('');
  console.log(`access:      ${result.access}`);
  console.log(`reason:      ${result.reason}`);
  console.log(`resultCount: ${result.resultCount}`);
  console.log(`errors:      ${JSON.stringify(result.errors)}`);
  console.log(`elapsed:     ${elapsed}ms`);

  if (result.access === 'denied') {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
