import 'dotenv/config';
import { resetTestDatabase } from './reset-test-database.js';
import { toTestDatabaseUrl } from './test-database-url.js';

export default function setup(): void {
  resetTestDatabase(toTestDatabaseUrl(process.env['DATABASE_URL']));
}
