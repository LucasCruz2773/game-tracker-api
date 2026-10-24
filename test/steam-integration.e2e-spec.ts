import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { PrismaService } from '../src/database/prisma.service.js';
import type { CatalogGame } from '../src/games/catalog.types.js';
import { RawgClient } from '../src/games/rawg/rawg.client.js';
import { SteamClient } from '../src/integrations/steam/steam.client.js';
import {
  createAuthenticatedUser,
  type AuthenticatedTestUser,
} from './support/fixtures.js';
import { createTestApp, resetDatabase } from './support/test-app.js';

const portal: CatalogGame = {
  rawgId: 4200,
  slug: 'portal-2',
  title: 'Portal 2',
  coverUrl: null,
  releaseDate: new Date('2011-04-18T00:00:00.000Z'),
  genres: [{ name: 'Puzzle', slug: 'puzzle' }],
  platforms: [{ name: 'PC', slug: 'pc' }],
};

describe('Steam integration (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let player: AuthenticatedTestUser;
  const steamClient = {
    getProfile: vi.fn(),
    getOwnedGames: vi.fn(),
  };
  const rawgClient = {
    searchGames: vi.fn(),
    getGameDetails: vi.fn(),
  };

  beforeAll(async () => {
    app = await createTestApp({
      providerOverrides: [
        { provide: SteamClient, useValue: steamClient },
        { provide: RawgClient, useValue: rawgClient },
      ],
    });
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    vi.resetAllMocks();
    await resetDatabase(app);
    player = await createAuthenticatedUser(app, 'steam_player');
    await prisma.steamAccount.create({
      data: {
        userId: player.user.id,
        steamId: '76561198000000000',
        personaName: 'Steam Player',
      },
    });
    steamClient.getOwnedGames.mockResolvedValue([
      { appId: 620, name: 'Portal 2', playtimeMinutes: 120 },
      { appId: 10, name: 'Unmatched Game', playtimeMinutes: 30 },
      { appId: 20, name: 'Never Played', playtimeMinutes: 0 },
    ]);
    rawgClient.searchGames.mockImplementation(
      ({ search }: { search: string }) =>
        Promise.resolve({
          total: search === 'Portal 2' ? 1 : 0,
          games: search === 'Portal 2' ? [portal] : [],
        }),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  function asPlayer() {
    const server = app.getHttpServer();
    return {
      get: (url: string) =>
        request(server).get(url).set('Cookie', player.sessionCookie),
      post: (url: string) =>
        request(server).post(url).set('Cookie', player.sessionCookie),
      delete: (url: string) =>
        request(server).delete(url).set('Cookie', player.sessionCookie),
    };
  }

  it('requires an authenticated GameTrack session', async () => {
    await request(app.getHttpServer()).get('/integrations/steam').expect(401);
    await request(app.getHttpServer())
      .post('/integrations/steam/sync')
      .expect(401);
  });

  it('rejects an invalid import status', async () => {
    await asPlayer()
      .post('/integrations/steam/import')
      .send({ appIds: [620], status: 'FINISHED' })
      .expect(400);
  });

  it('syncs played games, imports exact matches and updates playtime', async () => {
    const syncResponse = await asPlayer()
      .post('/integrations/steam/sync')
      .expect(200);

    expect(syncResponse.body).toMatchObject({
      totalOwned: 3,
      totalPlayed: 2,
      updatedLibraryEntries: 0,
    });
    expect(syncResponse.body.items).toEqual([
      expect.objectContaining({ appId: 620, imported: false }),
      expect.objectContaining({ appId: 10, imported: false }),
    ]);

    const importResponse = await asPlayer()
      .post('/integrations/steam/import')
      .send({ appIds: [620, 10] })
      .expect(200);

    expect(importResponse.body).toEqual({
      imported: 1,
      updated: 0,
      unmatchedAppIds: [10],
    });
    const entry = await prisma.gameLibrary.findFirstOrThrow({
      where: { userId: player.user.id },
    });
    expect(entry).toMatchObject({
      status: 'COMPLETED',
      hoursPlayed: 2,
      completedAt: expect.any(Date),
    });

    steamClient.getOwnedGames.mockResolvedValue([
      { appId: 620, name: 'Portal 2', playtimeMinutes: 300 },
    ]);
    const secondSync = await asPlayer()
      .post('/integrations/steam/sync')
      .expect(200);

    expect(secondSync.body.updatedLibraryEntries).toBe(1);
    await expect(
      prisma.gameLibrary.findUniqueOrThrow({ where: { id: entry.id } }),
    ).resolves.toMatchObject({ hoursPlayed: 5 });
  });

  it('disconnects Steam without removing imported library games', async () => {
    await asPlayer().post('/integrations/steam/sync').expect(200);
    await asPlayer()
      .post('/integrations/steam/import')
      .send({ appIds: [620], status: 'PLAYING' })
      .expect(200);

    const importedEntry = await prisma.gameLibrary.findFirstOrThrow({
      where: { userId: player.user.id },
    });
    expect(importedEntry).toMatchObject({
      status: 'PLAYING',
      startedAt: expect.any(Date),
      completedAt: null,
    });

    await asPlayer().delete('/integrations/steam').expect(204);

    await expect(
      prisma.steamAccount.count({ where: { userId: player.user.id } }),
    ).resolves.toBe(0);
    await expect(
      prisma.steamGame.count({ where: { userId: player.user.id } }),
    ).resolves.toBe(0);
    await expect(
      prisma.gameLibrary.findUniqueOrThrow({
        where: { id: importedEntry.id },
      }),
    ).resolves.toMatchObject({ status: 'PLAYING' });
  });
});
