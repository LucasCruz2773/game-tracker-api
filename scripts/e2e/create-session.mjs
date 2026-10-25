// Creates a user in the test database and prints a signed session for it as JSON,
// standing in for the Google sign-in that browser tests can't go through.
// Usage: node scripts/e2e/create-session.mjs <username> [display name]
import { execSync } from 'node:child_process';
import { createHmac, randomUUID } from 'node:crypto';
import { SESSION_COOKIE_NAME } from '../../src/auth/auth.constants.ts';
import { loadE2eEnvironment } from './e2e-environment.mjs';

const USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/;
const SESSION_TTL_SECONDS = 60 * 60;

const [username = '', displayName = username] = process.argv.slice(2);
if (!USERNAME_PATTERN.test(username)) {
  console.error(
    'Usage: node scripts/e2e/create-session.mjs <username> [display name]',
  );
  process.exit(1);
}

const environment = loadE2eEnvironment();
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  console.error('JWT_SECRET must be set (in .env or the environment)');
  process.exit(1);
}

const userId = randomUUID();
const sqlString = (value) => `'${value.replaceAll("'", "''")}'`;

execSync('npx prisma db execute --stdin', {
  input: `INSERT INTO users (id, google_id, email, username, display_name, updated_at)
    VALUES (${sqlString(userId)}, ${sqlString(`e2e-${userId}`)},
      ${sqlString(`${username}@gametrack.test`)}, ${sqlString(username)},
      ${sqlString(displayName)}, now());`,
  // Prisma prefers the direct URL when it exists. Force both connections to
  // the disposable test database so a local production URL can never win.
  env: {
    ...process.env,
    DATABASE_URL: environment.DATABASE_URL,
    DATABASE_URL_UNPOOLED: environment.DATABASE_URL,
  },
  stdio: ['pipe', 'ignore', 'inherit'],
});

const base64Url = (value) =>
  Buffer.from(JSON.stringify(value)).toString('base64url');
const issuedAt = Math.floor(Date.now() / 1000);
const unsignedToken = `${base64Url({ alg: 'HS256', typ: 'JWT' })}.${base64Url({
  sub: userId,
  iat: issuedAt,
  exp: issuedAt + SESSION_TTL_SECONDS,
})}`;
const signature = createHmac('sha256', jwtSecret)
  .update(unsignedToken)
  .digest('base64url');

process.stdout.write(
  JSON.stringify({
    userId,
    cookieName: SESSION_COOKIE_NAME,
    token: `${unsignedToken}.${signature}`,
  }),
);
