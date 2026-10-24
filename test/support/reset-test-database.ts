import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

/**
 * Recreates the test database schema from the migrations. The test database is
 * disposable: every run starts from an empty schema so rows or failed
 * migrations left by previous runs can't break it.
 */
export function resetTestDatabase(testDatabaseUrl: string): void {
  const databaseName = new URL(testDatabaseUrl).pathname.slice(1);
  if (!databaseName.endsWith('_test')) {
    throw new Error(
      `Refusing to reset "${databaseName}": not a *_test database`,
    );
  }

  // Prisma prefers DATABASE_URL_UNPOOLED for migrations. Override both values
  // so a developer's Neon production URL can never win over the disposable
  // *_test database selected by the test runner.
  const env = {
    ...process.env,
    DATABASE_URL: testDatabaseUrl,
    DATABASE_URL_UNPOOLED: testDatabaseUrl,
  };
  const prismaCli = resolve(
    process.cwd(),
    'node_modules',
    'prisma',
    'build',
    'index.js',
  );

  execFileSync(process.execPath, [prismaCli, 'db', 'execute', '--stdin'], {
    input: 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;',
    env,
    stdio: ['pipe', 'ignore', 'ignore'],
  });

  execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    env,
    stdio: 'inherit',
  });
}
