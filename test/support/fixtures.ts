import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { SESSION_COOKIE_NAME } from '../../src/auth/auth.constants.js';
import { PrismaService } from '../../src/database/prisma.service.js';
import type { Game, User } from '../../src/generated/prisma/client.js';

export interface AuthenticatedTestUser {
  user: User;
  /** Value for the `Cookie` request header. */
  sessionCookie: string;
}

/** Creates a user directly in the database and signs a session for it, skipping Google. */
export async function createAuthenticatedUser(
  app: INestApplication,
  username: string,
): Promise<AuthenticatedTestUser> {
  const user = await app.get(PrismaService).user.create({
    data: {
      googleId: `google-${randomUUID()}`,
      email: `${username}@gametrack.test`,
      username,
    },
  });
  const accessToken = await app.get(JwtService).signAsync({ sub: user.id });

  return { user, sessionCookie: `${SESSION_COOKIE_NAME}=${accessToken}` };
}

let nextRawgId = 1;

export function createGame(
  app: INestApplication,
  title: string,
): Promise<Game> {
  const rawgId = nextRawgId++;

  return app.get(PrismaService).game.create({
    data: {
      rawgId,
      slug: `${title.toLowerCase().replace(/\W+/g, '-')}-${rawgId}`,
      title,
    },
  });
}
