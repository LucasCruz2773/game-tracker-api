import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { PrismaService } from '../src/database/prisma.service.js';
import {
  createAuthenticatedUser,
  type AuthenticatedTestUser,
} from './support/fixtures.js';
import { createTestApp, resetDatabase } from './support/test-app.js';

describe('Users social connections (e2e)', () => {
  let app: INestApplication<App>;
  let player: AuthenticatedTestUser;
  let otherPlayer: AuthenticatedTestUser;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(app);
    player = await createAuthenticatedUser(app, 'player_one');
    otherPlayer = await createAuthenticatedUser(app, 'player_two');
  });

  afterAll(async () => {
    await app.close();
  });

  function asPlayer(user: AuthenticatedTestUser = player) {
    const server = app.getHttpServer();
    return {
      get: (url: string) =>
        request(server).get(url).set('Cookie', user.sessionCookie),
      post: (url: string) =>
        request(server).post(url).set('Cookie', user.sessionCookie),
      delete: (url: string) =>
        request(server).delete(url).set('Cookie', user.sessionCookie),
    };
  }

  describe('GET /users', () => {
    it('lists other users with social metadata and pagination', async () => {
      const response = await asPlayer().get('/users').expect(200);

      expect(response.body).toEqual({
        items: [
          {
            id: otherPlayer.user.id,
            username: 'player_two',
            displayName: null,
            avatarUrl: null,
            followerCount: 0,
            followingCount: 0,
            isFollowing: false,
          },
        ],
        page: 1,
        pageSize: 20,
        total: 1,
      });
    });

    it('searches by username or display name without case sensitivity', async () => {
      const prisma = app.get(PrismaService);
      await prisma.user.update({
        where: { id: otherPlayer.user.id },
        data: { displayName: 'Retro Player' },
      });

      const byUsername = await asPlayer()
        .get('/users?search=PLAYER_TWO')
        .expect(200);
      const byDisplayName = await asPlayer()
        .get('/users?search=retro')
        .expect(200);

      expect(byUsername.body.total).toBe(1);
      expect(byDisplayName.body.items[0].username).toBe('player_two');
    });

    it('requires a session', async () => {
      await request(app.getHttpServer()).get('/users').expect(401);
    });
  });

  describe('POST /users/:username/follow', () => {
    it('follows another user and exposes the updated relationship', async () => {
      await asPlayer().post('/users/player_two/follow').expect(201, {
        username: 'player_two',
        isFollowing: true,
      });

      const response = await asPlayer().get('/users').expect(200);
      expect(response.body.items[0]).toMatchObject({
        username: 'player_two',
        followerCount: 1,
        isFollowing: true,
      });
    });

    it('rejects duplicate and self follows', async () => {
      await asPlayer().post('/users/player_two/follow').expect(201);
      await asPlayer().post('/users/player_two/follow').expect(409);
      await asPlayer().post('/users/player_one/follow').expect(400);
    });

    it('returns 404 for an unknown user', async () => {
      await asPlayer().post('/users/missing_player/follow').expect(404);
    });
  });

  describe('DELETE /users/:username/follow', () => {
    it('unfollows idempotently', async () => {
      await asPlayer().post('/users/player_two/follow').expect(201);
      await asPlayer().delete('/users/player_two/follow').expect(204);
      await asPlayer().delete('/users/player_two/follow').expect(204);

      const response = await asPlayer().get('/users').expect(200);
      expect(response.body.items[0]).toMatchObject({
        followerCount: 0,
        isFollowing: false,
      });
    });
  });
});
