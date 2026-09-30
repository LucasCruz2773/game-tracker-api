import { execSync } from 'node:child_process';

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

  const env = { ...process.env, DATABASE_URL: testDatabaseUrl };

  try {
    execSync('npx prisma db execute --stdin', {
      input: 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;',
      env,
      stdio: ['pipe', 'ignore', 'ignore'],
    });
  } catch {
    // The database doesn't exist yet; `migrate deploy` creates it below.
  }

  execSync('npx prisma migrate deploy', { env, stdio: 'inherit' });
}
