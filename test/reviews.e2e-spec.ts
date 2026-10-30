import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import type { Game } from '../src/generated/prisma/client.js';
import {
  createAuthenticatedUser,
  createGame,
  type AuthenticatedTestUser,
} from './support/fixtures.js';
import { createTestApp, resetDatabase } from './support/test-app.js';

describe('Reviews (e2e)', () => {
  let app: INestApplication<App>;
  let player: AuthenticatedTestUser;
  let otherPlayer: AuthenticatedTestUser;
  let celeste: Game;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(app);
    player = await createAuthenticatedUser(app, 'player_one');
    otherPlayer = await createAuthenticatedUser(app, 'player_two');
    celeste = await createGame(app, 'Celeste');
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
      patch: (url: string) =>
        request(server).patch(url).set('Cookie', user.sessionCookie),
      delete: (url: string) =>
        request(server).delete(url).set('Cookie', user.sessionCookie),
    };
  }

  function createReview(
    game: Game = celeste,
    body: Record<string, unknown> = { rating: 8, body: 'Incredible.' },
    user: AuthenticatedTestUser = player,
  ) {
    return asPlayer(user).post(`/games/${game.id}/reviews`).send(body);
  }

  describe('GET /games/:gameId/reviews', () => {
    it('lists reviews without requiring a session', async () => {
      await createReview().expect(201);
      await createReview(celeste, { rating: 6 }, otherPlayer).expect(201);

      const response = await request(app.getHttpServer())
        .get(`/games/${celeste.id}/reviews`)
        .expect(200);

      expect(response.body).toEqual({
        items: [
          expect.objectContaining({
            rating: 6,
            starRating: 3,
            author: expect.objectContaining({ username: 'player_two' }),
          }),
          expect.objectContaining({
            rating: 8,
            starRating: 4,
            body: 'Incredible.',
            author: expect.objectContaining({ username: 'player_one' }),
          }),
        ],
        page: 1,
        pageSize: 20,
        total: 2,
      });
      expect(response.body.items[0].author).not.toHaveProperty('email');
    });

    it('returns 404 when the game does not exist', async () => {
      await request(app.getHttpServer())
        .get(`/games/${crypto.randomUUID()}/reviews`)
        .expect(404);
    });
  });

  describe('GET /games/:gameId/reviews/mine', () => {
    it('returns the signed-in user review', async () => {
      const created = await createReview().expect(201);

      const response = await asPlayer()
        .get(`/games/${celeste.id}/reviews/mine`)
        .expect(200);

      expect(response.body.id).toBe(created.body.id);
    });

    it('returns 404 when the user has not reviewed the game', async () => {
      await asPlayer().get(`/games/${celeste.id}/reviews/mine`).expect(404);
    });

    it('requires a session', async () => {
      await request(app.getHttpServer())
        .get(`/games/${celeste.id}/reviews/mine`)
        .expect(401);
    });
  });

  describe('POST /games/:gameId/reviews', () => {
    it('creates a review with an optional body', async () => {
      const response = await createReview().expect(201);

      expect(response.body).toEqual({
        id: expect.any(String),
        rating: 8,
        starRating: 4,
        body: 'Incredible.',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        author: expect.objectContaining({
          id: player.user.id,
          username: 'player_one',
        }),
      });

      const library = await asPlayer().get('/library').expect(200);
      expect(library.body).toMatchObject({
        total: 1,
        items: [
          {
            status: 'UNSET',
            game: { id: celeste.id },
            review: { id: response.body.id, rating: 8, starRating: 4 },
          },
        ],
      });
    });

    it('stores an empty body as null', async () => {
      const response = await createReview(celeste, {
        rating: 10,
        body: '   ',
      }).expect(201);

      expect(response.body.body).toBeNull();
    });

    it('rejects duplicate reviews for the same game', async () => {
      await createReview().expect(201);
      await createReview().expect(409);
    });

    it('validates the rating range', async () => {
      await createReview(celeste, { rating: 0 }).expect(400);
      await createReview(celeste, { rating: 11 }).expect(400);
    });

    it('requires a session', async () => {
      await request(app.getHttpServer())
        .post(`/games/${celeste.id}/reviews`)
        .send({ rating: 8 })
        .expect(401);
    });
  });

  describe('PATCH /reviews/:id', () => {
    it('updates the author review', async () => {
      const created = await createReview().expect(201);

      const response = await asPlayer()
        .patch(`/reviews/${created.body.id}`)
        .send({ rating: 9, body: 'Even better on a second playthrough.' })
        .expect(200);

      expect(response.body).toMatchObject({
        rating: 9,
        starRating: 4.5,
        body: 'Even better on a second playthrough.',
      });
    });

    it('forbids editing someone else review', async () => {
      const created = await createReview().expect(201);

      await asPlayer(otherPlayer)
        .patch(`/reviews/${created.body.id}`)
        .send({ rating: 1 })
        .expect(403);
    });

    it('requires a session', async () => {
      const created = await createReview().expect(201);

      await request(app.getHttpServer())
        .patch(`/reviews/${created.body.id}`)
        .send({ rating: 7 })
        .expect(401);
    });
  });

  describe('DELETE /reviews/:id', () => {
    it('deletes the author review', async () => {
      const created = await createReview().expect(201);

      await asPlayer().delete(`/reviews/${created.body.id}`).expect(204);
      await asPlayer().get(`/games/${celeste.id}/reviews/mine`).expect(404);
      const library = await asPlayer().get('/library').expect(200);
      expect(library.body.total).toBe(0);
    });

    it('forbids deleting someone else review', async () => {
      const created = await createReview().expect(201);

      await asPlayer(otherPlayer)
        .delete(`/reviews/${created.body.id}`)
        .expect(403);
    });
  });
});
