import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { PrismaService } from '../src/database/prisma.service.js';
import {
  createAuthenticatedUser,
  createGame,
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

  describe('GET /users/me social connections', () => {
    it('returns the counters and paginated people in both directions', async () => {
      const follower = await createAuthenticatedUser(app, 'player_three');

      await asPlayer().post('/users/player_two/follow').expect(201);
      await asPlayer().post('/users/player_three/follow').expect(201);
      await asPlayer(follower).post('/users/player_one/follow').expect(201);

      await asPlayer().get('/users/me/social-summary').expect(200, {
        followerCount: 1,
        followingCount: 2,
      });

      const followers = await asPlayer().get('/users/me/followers').expect(200);
      expect(followers.body).toMatchObject({
        page: 1,
        pageSize: 20,
        total: 1,
        items: [{ username: 'player_three', isFollowing: true }],
      });

      const following = await asPlayer()
        .get('/users/me/following?page=1&pageSize=1')
        .expect(200);
      expect(following.body).toMatchObject({
        page: 1,
        pageSize: 1,
        total: 2,
        items: [{ username: 'player_three', isFollowing: true }],
      });
    });

    it('requires a session for the summary and both lists', async () => {
      const server = app.getHttpServer();
      await request(server).get('/users/me/social-summary').expect(401);
      await request(server).get('/users/me/followers').expect(401);
      await request(server).get('/users/me/following').expect(401);
    });
  });

  describe('GET /users/:username public profile', () => {
    it("returns another player's profile, library and summary", async () => {
      const game = await createGame(app, 'Public Game');
      await asPlayer().post('/users/player_two/follow').expect(201);
      await asPlayer(otherPlayer)
        .post('/library')
        .send({
          gameId: game.id,
          status: 'COMPLETED',
          hoursPlayed: 18,
        })
        .expect(201);
      await asPlayer(otherPlayer)
        .post(`/games/${game.id}/reviews`)
        .send({ rating: 9 })
        .expect(201);

      const profile = await asPlayer().get('/users/player_two').expect(200);
      expect(profile.body).toEqual({
        id: otherPlayer.user.id,
        username: 'player_two',
        avatarUrl: null,
        createdAt: expect.any(String),
        followerCount: 1,
        followingCount: 0,
        isFollowing: true,
      });

      const library = await asPlayer()
        .get('/users/player_two/library')
        .expect(200);
      expect(library.body).toMatchObject({
        total: 1,
        items: [
          {
            status: 'COMPLETED',
            hoursPlayed: 18,
            game: { id: game.id, title: 'Public Game' },
            review: { rating: 9, starRating: 4.5 },
          },
        ],
      });

      await asPlayer()
        .get('/users/player_two/summary')
        .expect(200, {
          totalGames: 1,
          byStatus: { PLAYING: 0, BACKLOG: 0, COMPLETED: 1, DROPPED: 0 },
          totalHoursPlayed: 18,
          averageRating: 9,
          averageStarRating: 4.5,
        });
    });

    it('returns 404 for an unknown player and requires a session', async () => {
      await asPlayer().get('/users/missing_player').expect(404);
      await asPlayer().get('/users/missing_player/library').expect(404);
      await asPlayer().get('/users/missing_player/summary').expect(404);

      const server = app.getHttpServer();
      await request(server).get('/users/player_two').expect(401);
      await request(server).get('/users/player_two/library').expect(401);
      await request(server).get('/users/player_two/summary').expect(401);
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
