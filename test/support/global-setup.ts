import 'dotenv/config';
import { execSync } from 'node:child_process';
import { toTestDatabaseUrl } from './test-database-url.js';

export default function setup(): void {
  const env = {
    ...process.env,
    DATABASE_URL: toTestDatabaseUrl(process.env['DATABASE_URL']),
  };

  // The test database is disposable: every run starts from an empty schema so
  // rows or failed migrations left by previous runs can't break it.
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
