import 'dotenv/config';
import { execSync } from 'node:child_process';
import { toTestDatabaseUrl } from './test-database-url.js';

export default function setup(): void {
  execSync('npx prisma migrate deploy', {
    env: {
      ...process.env,
      DATABASE_URL: toTestDatabaseUrl(process.env['DATABASE_URL']),
    },
    stdio: 'inherit',
  });
}
