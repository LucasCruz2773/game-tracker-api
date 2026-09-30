import 'dotenv/config';
import { defineConfig } from 'vitest/config';
import { toTestDatabaseUrl } from './test/support/test-database-url.js';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    globalSetup: ['./test/support/global-setup.ts'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: toTestDatabaseUrl(process.env['DATABASE_URL']),
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
