import { loadEnvFile, readConfig } from './config';
import { createContainer } from './container';
import { startWorkers } from './jobs/handlers';

/**
 * The background worker: same codebase and services as the API, separate process. Runs imports,
 * provisioning, malware scans, push delivery, reports, reminders, retention and maintenance.
 */
loadEnvFile();
const config = readConfig();
const container = await createContainer(config, { role: 'worker' });
const log = (msg: string, extra: object = {}) => console.log(JSON.stringify({ time: new Date().toISOString(), msg, ...extra }));

await startWorkers(container, log);
log('worker started');

const shutdown = async (signal: string) => {
  log('worker stopping', { signal });
  await container.close();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
