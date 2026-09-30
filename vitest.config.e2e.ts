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
      // The RAWG client is replaced by a fake in e2e tests; no real key is needed.
      RAWG_API_KEY: process.env['RAWG_API_KEY'] || 'e2e-fake-rawg-key',
    },
    // Test files share one database, so they must not run concurrently.
    fileParallelism: false,
  },
});
