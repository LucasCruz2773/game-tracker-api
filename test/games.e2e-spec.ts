import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { PrismaService } from '../src/database/prisma.service.js';
import type {
  CatalogGame,
  CatalogGameDetails,
} from '../src/games/catalog.types.js';
import {
  CatalogUnavailableException,
  RawgClient,
} from '../src/games/rawg/rawg.client.js';
import { createTestApp, resetDatabase } from './support/test-app.js';

const celeste: CatalogGame = {
  rawgId: 22121,
  slug: 'celeste',
  title: 'Celeste',
  coverUrl: 'https://media.rawg.io/media/games/celeste.jpg',
  releaseDate: new Date('2018-01-25T00:00:00.000Z'),
  genres: [
    { name: 'Platformer', slug: 'platformer' },
    { name: 'Indie', slug: 'indie' },
  ],
  platforms: [{ name: 'PC', slug: 'pc' }],
};

const hollowKnight: CatalogGame = {
  rawgId: 9767,
  slug: 'hollow-knight',
  title: 'Hollow Knight',
  coverUrl: null,
  releaseDate: null,
  genres: [{ name: 'Indie', slug: 'indie' }],
  platforms: [{ name: 'PC', slug: 'pc' }],
};

describe('Games (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const rawgClient = {
    searchGames: vi.fn(),
    getGameDetails: vi.fn(),
  };

  beforeAll(async () => {
    app = await createTestApp({
      providerOverrides: [{ provide: RawgClient, useValue: rawgClient }],
    });
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    vi.resetAllMocks();
    await resetDatabase(app);
  });

  afterAll(async () => {
    await app.close();
  });

  async function searchCatalog(games: CatalogGame[]) {
    rawgClient.searchGames.mockResolvedValue({ total: 873, games });
    return request(app.getHttpServer())
      .get('/games')
      .query({ search: 'celeste' })
      .expect(200);
  }

  describe('GET /games', () => {
    it('returns catalog results with local ids and stores them', async () => {
      const response = await searchCatalog([celeste, hollowKnight]);

      expect(rawgClient.searchGames).toHaveBeenCalledWith({
        search: 'celeste',
        ordering: undefined,
        discover: false,
        page: 1,
        pageSize: 20,
      });
      expect(response.body).toEqual({
        items: [
          {
            id: expect.any(String),
            slug: 'celeste',
            title: 'Celeste',
            coverUrl: 'https://media.rawg.io/media/games/celeste.jpg',
            releaseDate: '2018-01-25',
            genres: [
              { name: 'Indie', slug: 'indie' },
              { name: 'Platformer', slug: 'platformer' },
            ],
            platforms: [{ name: 'PC', slug: 'pc' }],
          },
          expect.objectContaining({ slug: 'hollow-knight', releaseDate: null }),
        ],
        page: 1,
        pageSize: 20,
        total: 873,
      });
      await expect(prisma.game.count()).resolves.toBe(2);
      await expect(prisma.genre.count()).resolves.toBe(2);
    });

    it('maps ordering presets to RAWG ordering fields', async () => {
      rawgClient.searchGames.mockResolvedValue({ total: 0, games: [] });

      await request(app.getHttpServer())
        .get('/games')
        .query({ ordering: 'popularity' })
        .expect(200);

      expect(rawgClient.searchGames).toHaveBeenCalledWith(
        expect.objectContaining({ ordering: '-added', discover: true }),
      );
      await request(app.getHttpServer())
        .get('/games')
        .query({ ordering: 'unknown' })
        .expect(400);
    });

    it('updates existing games instead of duplicating them', async () => {
      const firstResponse = await searchCatalog([celeste]);
      const secondResponse = await searchCatalog([
        { ...celeste, title: 'Celeste (Remastered)', genres: [] },
      ]);

      expect(secondResponse.body.items[0]).toMatchObject({
        id: firstResponse.body.items[0].id,
        title: 'Celeste (Remastered)',
        genres: [],
      });
      await expect(prisma.game.count()).resolves.toBe(1);
    });

    it('stores each game once when concurrent searches return it', async () => {
      rawgClient.searchGames
        .mockResolvedValueOnce({ total: 2, games: [celeste, hollowKnight] })
        .mockResolvedValueOnce({ total: 2, games: [hollowKnight, celeste] })
        .mockResolvedValue({ total: 2, games: [celeste, hollowKnight] });

      const responses = await Promise.all(
        Array.from({ length: 6 }, () =>
          request(app.getHttpServer()).get('/games'),
        ),
      );

      expect(responses.map((response) => response.status)).toEqual(
        Array(6).fill(200),
      );
      expect(
        responses[1].body.items.map((game: { title: string }) => game.title),
      ).toEqual(['Hollow Knight', 'Celeste']);
      await expect(prisma.game.count()).resolves.toBe(2);
    });

    it('validates pagination parameters', async () => {
      await request(app.getHttpServer())
        .get('/games')
        .query({ pageSize: 100 })
        .expect(400);

      expect(rawgClient.searchGames).not.toHaveBeenCalled();
    });

    it('answers 502 when the catalog is unavailable', async () => {
      rawgClient.searchGames.mockRejectedValue(
        new CatalogUnavailableException(),
      );

      const response = await request(app.getHttpServer())
        .get('/games')
        .expect(502);

      expect(response.body.message).toBe(
        'Game catalog is temporarily unavailable',
      );
    });
  });

  describe('GET /games/:id', () => {
    const celesteDetails: CatalogGameDetails = {
      ...celeste,
      description: 'Help Madeline survive her inner demons.',
      genres: [...celeste.genres, { name: 'Adventure', slug: 'adventure' }],
    };

    it('fetches details from the catalog only the first time', async () => {
      const searchResponse = await searchCatalog([celeste]);
      const gameId = searchResponse.body.items[0].id as string;
      rawgClient.getGameDetails.mockResolvedValue(celesteDetails);

      const firstResponse = await request(app.getHttpServer())
        .get(`/games/${gameId}`)
        .expect(200);
      await request(app.getHttpServer()).get(`/games/${gameId}`).expect(200);

      expect(firstResponse.body).toMatchObject({
        id: gameId,
        description: 'Help Madeline survive her inner demons.',
      });
      expect(firstResponse.body.genres).toContainEqual({
        name: 'Adventure',
        slug: 'adventure',
      });
      expect(rawgClient.getGameDetails).toHaveBeenCalledTimes(1);
      expect(rawgClient.getGameDetails).toHaveBeenCalledWith(22121);
    });

    it('serves stored data when the catalog is unavailable', async () => {
      const searchResponse = await searchCatalog([celeste]);
      const gameId = searchResponse.body.items[0].id as string;
      rawgClient.getGameDetails.mockRejectedValue(
        new CatalogUnavailableException(),
      );

      const response = await request(app.getHttpServer())
        .get(`/games/${gameId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        title: 'Celeste',
        description: null,
      });
    });

    it('returns the community rating average and review count', async () => {
      const searchResponse = await searchCatalog([celeste]);
      const gameId = searchResponse.body.items[0].id as string;
      rawgClient.getGameDetails.mockResolvedValue(celesteDetails);
      const users = await Promise.all(
        [1, 2].map((number) =>
          prisma.user.create({
            data: {
              googleId: `google-rating-${number}`,
              email: `rating-${number}@example.com`,
              username: `rating_user_${number}`,
            },
          }),
        ),
      );
      await prisma.review.createMany({
        data: [
          { userId: users[0].id, gameId, rating: 8 },
          { userId: users[1].id, gameId, rating: 9 },
        ],
      });

      const response = await request(app.getHttpServer())
        .get(`/games/${gameId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        averageRating: 8.5,
        averageStarRating: 4.3,
        reviewCount: 2,
      });
    });

    it('answers 404 for an unknown game and 400 for an invalid id', async () => {
      await request(app.getHttpServer())
        .get('/games/0192f5a0-0000-7000-8000-000000000000')
        .expect(404);
      await request(app.getHttpServer()).get('/games/not-a-uuid').expect(400);
    });
  });
});
