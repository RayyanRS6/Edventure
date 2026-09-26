/** Writes the generated OpenAPI document (from the same Zod contracts the routes use) to openapi.json. */
import fs from 'node:fs';
import path from 'node:path';
import { buildApp } from '../src/app';
import { loadEnvFile, readConfig } from '../src/config';
import { createContainer } from '../src/container';

loadEnvFile();
const container = await createContainer(readConfig(), { role: 'api' });
const app = await buildApp(container, { logger: false });
await app.ready();
const out = path.resolve(process.cwd(), 'openapi.json');
fs.writeFileSync(out, JSON.stringify(app.swagger(), null, 2));
console.log(`OpenAPI written to ${out}`);
await app.close();
await container.close();
