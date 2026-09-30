import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { toIsoDate } from '../src/common/dates.js';
import type { Game } from '../src/generated/prisma/client.js';
import {
  createAuthenticatedUser,
  createGame,
  type AuthenticatedTestUser,
} from './support/fixtures.js';
import { createTestApp, resetDatabase } from './support/test-app.js';

describe('Library (e2e)', () => {
  let app: INestApplication<App>;
  let player: AuthenticatedTestUser;
  let celeste: Game;
  let hades: Game;
  let portal: Game;
  const today = toIsoDate(new Date());

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(app);
    player = await createAuthenticatedUser(app, 'player_one');
    celeste = await createGame(app, 'Celeste');
    hades = await createGame(app, 'Hades');
    portal = await createGame(app, 'Portal 2');
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

  function addToLibrary(game: Game, body: Record<string, unknown> = {}) {
    return asPlayer()
      .post('/library')
      .send({ gameId: game.id, ...body });
  }

  it('requires a session', async () => {
    await request(app.getHttpServer()).get('/library').expect(401);
    await request(app.getHttpServer())
      .post('/library')
      .send({ gameId: celeste.id })
      .expect(401);
  });

  describe('POST /library', () => {
    it('adds a game to the backlog by default', async () => {
      const response = await addToLibrary(celeste).expect(201);

      expect(response.body).toEqual({
        id: expect.any(String),
        status: 'BACKLOG',
        hoursPlayed: 0,
        startedAt: null,
        completedAt: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        game: expect.objectContaining({ id: celeste.id, title: 'Celeste' }),
      });
    });

    it('starts the game today when added as PLAYING', async () => {
      const response = await addToLibrary(celeste, {
        status: 'PLAYING',
        hoursPlayed: 3,
      }).expect(201);

      expect(response.body).toMatchObject({
        status: 'PLAYING',
        hoursPlayed: 3,
        startedAt: today,
      });
    });

    it('rejects the same game twice', async () => {
      await addToLibrary(celeste).expect(201);

      const response = await addToLibrary(celeste).expect(409);
      expect(response.body.message).toBe('Game is already in your library');
    });

    it('answers 404 for a game that does not exist', async () => {
      await asPlayer()
        .post('/library')
        .send({ gameId: '0192f5a0-0000-7000-8000-000000000000' })
        .expect(404);
    });

    it('validates the payload', async () => {
      const response = await asPlayer()
        .post('/library')
        .send({
          gameId: 'celeste',
          status: 'FINISHED',
          hoursPlayed: -1,
          startedAt: '01/05/2026',
        })
        .expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining([
          'gameId must be a UUID',
          'status must be one of the following values: BACKLOG, PLAYING, COMPLETED, DROPPED',
          'hoursPlayed must not be less than 0',
          'startedAt must be a date in the YYYY-MM-DD format',
        ]),
      );
    });
  });

  describe('PATCH /library/:gameId', () => {
    beforeEach(async () => {
      await addToLibrary(celeste, {
        status: 'PLAYING',
        startedAt: '2026-05-01',
      }).expect(201);
    });

    it('completes a game today and reopens it without the completion date', async () => {
      const completed = await asPlayer()
        .patch(`/library/${celeste.id}`)
        .send({ status: 'COMPLETED', hoursPlayed: 12 })
        .expect(200);

      expect(completed.body).toMatchObject({
        status: 'COMPLETED',
        hoursPlayed: 12,
        startedAt: '2026-05-01',
        completedAt: today,
      });

      const reopened = await asPlayer()
        .patch(`/library/${celeste.id}`)
        .send({ status: 'PLAYING' })
        .expect(200);

      expect(reopened.body).toMatchObject({
        status: 'PLAYING',
        hoursPlayed: 12,
        startedAt: '2026-05-01',
        completedAt: null,
      });
    });

    it('rejects a completion date earlier than the start date', async () => {
      const response = await asPlayer()
        .patch(`/library/${celeste.id}`)
        .send({ status: 'COMPLETED', completedAt: '2026-04-01' })
        .expect(422);

      expect(response.body.message).toBe(
        'completedAt cannot be earlier than startedAt',
      );
    });

    it('answers 404 for a game that is not in the library', async () => {
      await asPlayer()
        .patch(`/library/${hades.id}`)
        .send({ status: 'PLAYING' })
        .expect(404);
    });
  });

  describe('GET /library', () => {
    beforeEach(async () => {
      await addToLibrary(portal, { status: 'COMPLETED' }).expect(201);
      await addToLibrary(celeste, { status: 'PLAYING' }).expect(201);
      await addToLibrary(hades, { status: 'PLAYING' }).expect(201);
    });

    it('lists the most recently updated entries first', async () => {
      const response = await asPlayer().get('/library').expect(200);

      expect(
        response.body.items.map(
          (entry: { game: { title: string } }) => entry.game.title,
        ),
      ).toEqual(['Hades', 'Celeste', 'Portal 2']);
      expect(response.body).toMatchObject({ page: 1, pageSize: 20, total: 3 });
    });

    it('filters by status, sorts by title and paginates', async () => {
      const firstPage = await asPlayer()
        .get('/library?status=PLAYING&sortBy=title&pageSize=1')
        .expect(200);
      const secondPage = await asPlayer()
        .get('/library?status=PLAYING&sortBy=title&pageSize=1&page=2')
        .expect(200);

      expect(firstPage.body.total).toBe(2);
      expect(firstPage.body.items[0].game.title).toBe('Celeste');
      expect(secondPage.body.items[0].game.title).toBe('Hades');
    });

    it('rejects unknown filters', async () => {
      await asPlayer().get('/library?status=WISHLIST').expect(400);
      await asPlayer().get('/library?sortBy=rating').expect(400);
    });
  });

  describe('GET and DELETE /library/:gameId', () => {
    it('removes a game from the library', async () => {
      await addToLibrary(celeste).expect(201);
      await asPlayer().get(`/library/${celeste.id}`).expect(200);

      await asPlayer().delete(`/library/${celeste.id}`).expect(204);

      await asPlayer().get(`/library/${celeste.id}`).expect(404);
      await asPlayer().delete(`/library/${celeste.id}`).expect(404);
    });
  });

  describe('isolation between users', () => {
    it("never exposes or changes another player's library", async () => {
      await addToLibrary(celeste, { status: 'PLAYING' }).expect(201);
      const rival = await createAuthenticatedUser(app, 'rival_player');

      const rivalLibrary = await asPlayer(rival).get('/library').expect(200);
      expect(rivalLibrary.body.total).toBe(0);

      await asPlayer(rival).get(`/library/${celeste.id}`).expect(404);
      await asPlayer(rival)
        .patch(`/library/${celeste.id}`)
        .send({ status: 'DROPPED' })
        .expect(404);
      await asPlayer(rival).delete(`/library/${celeste.id}`).expect(404);

      const ownEntry = await asPlayer().get(`/library/${celeste.id}`);
      expect(ownEntry.body.status).toBe('PLAYING');
    });

    it('lets different players track the same game', async () => {
      const rival = await createAuthenticatedUser(app, 'rival_player');

      await addToLibrary(celeste).expect(201);
      await asPlayer(rival)
        .post('/library')
        .send({ gameId: celeste.id })
        .expect(201);
    });
  });
});
