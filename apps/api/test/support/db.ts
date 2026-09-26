import { randomUUID } from 'node:crypto';
import { inject } from 'vitest';
import { connect } from '../../src/db/client';
import { dropDatabase, ensureDatabase, localUrl } from '../../scripts/lib/local-postgres';

/** A fresh database cloned from the migrated template. */
export async function createTestDatabase() {
  const port = inject('pgPort');
  const name = `t_${randomUUID().replace(/-/g, '').slice(0, 20)}`;
  await ensureDatabase(port, name, inject('templateDb'));
  const ownerUrl = localUrl(port, name);
  const appUrl = localUrl(port, name, 'edventure_app', inject('appRolePassword'));
  const app = connect(appUrl, { max: 5, application: 'edventure-test' });
  const owner = connect(ownerUrl, { max: 2, application: 'edventure-test-owner' });
  return {
    name,
    ownerUrl,
    appUrl,
    app,
    owner,
    async drop() {
      await app.close();
      await owner.close();
      await dropDatabase(port, name);
    },
  };
}

export type TestDatabase = Awaited<ReturnType<typeof createTestDatabase>>;
