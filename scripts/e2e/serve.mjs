// Starts the compiled API (dist-e2e) against a freshly migrated test database.
// Usage: npm run e2e:serve
import { resetTestDatabase } from '../../test/support/reset-test-database.ts';
import { loadE2eEnvironment } from './e2e-environment.mjs';

const environment = loadE2eEnvironment();
resetTestDatabase(environment.DATABASE_URL);

Object.assign(process.env, environment);
await import('../../dist-e2e/main.js');
