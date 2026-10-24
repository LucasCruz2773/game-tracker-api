import 'dotenv/config';
import { resetTestDatabase } from './reset-test-database.js';
import { requireTestDatabaseUrl } from './test-database-url.js';

export default function setup(): void {
  resetTestDatabase(requireTestDatabaseUrl(process.env['TEST_DATABASE_URL']));
}
