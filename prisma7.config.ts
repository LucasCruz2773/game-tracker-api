import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Neon recommends its direct connection for migrations and the pooled
    // connection for normal application traffic.
    url: process.env['DATABASE_URL_UNPOOLED'] ?? process.env['DATABASE_URL'],
  },
});
