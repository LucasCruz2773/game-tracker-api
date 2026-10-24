import 'dotenv/config';
import { defineConfig } from 'vitest/config';
import { requireTestDatabaseUrl } from './test/support/test-database-url.js';

const testDatabaseUrl = requireTestDatabaseUrl(
  process.env['TEST_DATABASE_URL'],
);

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    globalSetup: ['./test/support/global-setup.ts'],
    testTimeout: 30_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: testDatabaseUrl,
      DATABASE_URL_UNPOOLED: testDatabaseUrl,
      TEST_DATABASE_URL: testDatabaseUrl,
      // RAWG and Google clients are replaced by fakes in e2e tests; no real credentials are needed.
      RAWG_API_KEY: process.env['RAWG_API_KEY'] || 'e2e-fake-rawg-key',
      GOOGLE_CLIENT_ID: process.env['GOOGLE_CLIENT_ID'] || 'e2e-fake-client-id',
      GOOGLE_CLIENT_SECRET:
        process.env['GOOGLE_CLIENT_SECRET'] || 'e2e-fake-client-secret',
      GOOGLE_CALLBACK_URL: 'http://localhost:3000/auth/google/callback',
      FRONTEND_URL: 'http://localhost:5173',
    },
    // Test files share one database, so they must not run concurrently.
    fileParallelism: false,
  },
});
