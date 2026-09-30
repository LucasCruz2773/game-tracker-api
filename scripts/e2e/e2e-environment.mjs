// Settings for the API instance that the web app's Playwright suite runs against.
// Node 24 strips the types from the imported .ts helper on its own.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { toTestDatabaseUrl } from '../../test/support/test-database-url.ts';

const ENV_FILE = fileURLToPath(new URL('../../.env', import.meta.url));

export function loadE2eEnvironment() {
  // Variables already set in the environment (e.g. in CI) win over the file.
  if (existsSync(ENV_FILE)) {
    process.loadEnvFile(ENV_FILE);
  }

  const frontendUrl = process.env.E2E_FRONTEND_URL ?? 'http://localhost:5174';
  const port = process.env.E2E_API_PORT ?? '3100';

  return {
    NODE_ENV: 'test',
    PORT: port,
    DATABASE_URL: toTestDatabaseUrl(process.env.DATABASE_URL),
    RAWG_BASE_URL: process.env.E2E_RAWG_BASE_URL ?? 'http://localhost:3200',
    // The fake catalog ignores the key; never send the real one to it.
    RAWG_API_KEY: 'e2e-fake-rawg-key',
    // Google is never called: sessions are created by create-session.mjs.
    GOOGLE_CLIENT_ID: 'e2e-fake-client-id',
    GOOGLE_CLIENT_SECRET: 'e2e-fake-client-secret',
    GOOGLE_CALLBACK_URL: `http://localhost:${port}/auth/google/callback`,
    FRONTEND_URL: frontendUrl,
  };
}
