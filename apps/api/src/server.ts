import { buildApp } from './app';
import { loadEnvFile, readConfig } from './config';
import { createContainer } from './container';

loadEnvFile();
const config = readConfig();
const container = await createContainer(config, { role: 'api' });
const app = await buildApp(container);

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'shutting down');
  await app.close();
  await container.close();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

await app.listen({ host: config.HOST, port: config.PORT });
