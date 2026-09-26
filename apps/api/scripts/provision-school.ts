/**
 * Platform operation: provision a new school and its first administrator.
 *
 *   npm run provision:school -w @edventure/api -- --code PILOT --name "Pilot School" \
 *     --admin-username principal --admin-name "Principal Name" --operator "your.name"
 *
 * Runs with the owner database connection (a privileged, audited platform action). The temporary
 * password is printed once; the administrator must replace it and enrol MFA at first sign-in.
 */
import { parseArgs } from 'node:util';
import { loadEnvFile, readConfig } from '../src/config';
import { createContainer } from '../src/container';

const { values } = parseArgs({
  options: {
    code: { type: 'string' },
    name: { type: 'string' },
    'name-ur': { type: 'string' },
    'admin-username': { type: 'string' },
    'admin-name': { type: 'string' },
    operator: { type: 'string' },
  },
});

for (const key of ['code', 'name', 'admin-username', 'admin-name', 'operator'] as const) {
  if (!values[key]) {
    console.error(`Missing --${key}`);
    process.exit(1);
  }
}

loadEnvFile();
const container = await createContainer(readConfig(), { role: 'api' });
try {
  const { school, credential } = await container.platform.provisionSchool(
    {
      code: values.code!,
      name: values.name!,
      nameUr: values['name-ur'] ?? null,
      admin: { username: values['admin-username']!, displayName: values['admin-name']! },
    },
    values.operator!,
  );
  console.log(`\nSchool ${school.code} provisioned (${school.id}).`);
  console.log(`Administrator username: ${credential.username}`);
  console.log(`Temporary password (shown once): ${credential.temporaryPassword}\n`);
} finally {
  await container.close();
}
