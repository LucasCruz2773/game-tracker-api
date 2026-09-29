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
    },
    // Test files share one database, so they must not run concurrently.
    fileParallelism: false,
  },
});
