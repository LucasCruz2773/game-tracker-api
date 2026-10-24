import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { todayUtc } from '../../common/dates.js';
import type { EnvironmentVariables } from '../../config/environment.js';
import { PrismaService } from '../../database/prisma.service.js';
import { LibraryStatus, Prisma } from '../../generated/prisma/client.js';
import { GamesService } from '../../games/games.service.js';
import { MAX_HOURS_PLAYED } from '../../library/dto/add-to-library.dto.js';
import { resolveLibraryProgress } from '../../library/library-entry.rules.js';
import type { ImportSteamGamesDto } from './dto/import-steam-games.dto.js';
import type {
  SteamImportResultDto,
  SteamIntegrationStatusDto,
  SteamLibraryItemDto,
  SteamSyncResultDto,
} from './dto/steam-integration.dto.js';
import { SteamClient } from './steam.client.js';
import { SteamOpenIdClient } from './steam-openid.client.js';

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

@Injectable()
export class SteamIntegrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gamesService: GamesService,
    private readonly steamClient: SteamClient,
    private readonly steamOpenIdClient: SteamOpenIdClient,
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {}

  createConnectRequest(): { state: string; url: string } {
    const state = randomBytes(32).toString('base64url');
    const frontendUrl = this.configService.get('FRONTEND_URL', { infer: true });
    const callbackUrl = new URL(
      '/api/integrations/steam/callback',
      frontendUrl,
    );
    callbackUrl.searchParams.set('state', state);

    return {
      state,
      url: this.steamOpenIdClient.createAuthenticationUrl(
        callbackUrl.toString(),
        new URL(frontendUrl).origin,
      ),
    };
  }

  async completeConnection(
    userId: string,
    query: Record<string, string>,
    expectedState: string | undefined,
  ): Promise<void> {
    if (!expectedState || query.state !== expectedState) {
      throw new UnauthorizedException('Steam connection state is invalid');
    }

    const steamId = await this.steamOpenIdClient.verifyAuthentication(query);
    const profile = await this.steamClient.getProfile(steamId);
    const currentAccount = await this.prisma.steamAccount.findUnique({
      where: { userId },
    });

    try {
      if (currentAccount && currentAccount.steamId !== steamId) {
        await this.prisma.$transaction([
          this.prisma.steamGame.deleteMany({ where: { userId } }),
          this.prisma.steamAccount.update({
            where: { userId },
            data: {
              steamId,
              personaName: profile.personaName,
              avatarUrl: profile.avatarUrl,
              lastSyncedAt: null,
            },
          }),
        ]);
        return;
      }

      await this.prisma.steamAccount.upsert({
        where: { userId },
        create: {
          userId,
          steamId,
          personaName: profile.personaName,
          avatarUrl: profile.avatarUrl,
        },
        update: {
          steamId,
          personaName: profile.personaName,
          avatarUrl: profile.avatarUrl,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_CONSTRAINT_VIOLATION
      ) {
        throw new ConflictException(
          'This Steam account is already connected to another user',
        );
      }
      throw error;
    }
  }

  async getStatus(userId: string): Promise<SteamIntegrationStatusDto> {
    const account = await this.prisma.steamAccount.findUnique({
      where: { userId },
    });

    return account
      ? {
          connected: true,
          account: {
            steamId: account.steamId,
            personaName: account.personaName,
            avatarUrl: account.avatarUrl,
            lastSyncedAt: account.lastSyncedAt,
          },
        }
      : { connected: false, account: null };
  }

  async sync(userId: string): Promise<SteamSyncResultDto> {
    const account = await this.requireAccount(userId);
    const ownedGames = await this.steamClient.getOwnedGames(account.steamId);

    if (ownedGames.length > 0) {
      await this.prisma.$transaction(
        ownedGames.map((game) =>
          this.prisma.steamGame.upsert({
            where: {
              userId_steamAppId: { userId, steamAppId: game.appId },
            },
            create: {
              userId,
              steamAppId: game.appId,
              name: game.name,
              playtimeMinutes: game.playtimeMinutes,
            },
            update: {
              name: game.name,
              playtimeMinutes: game.playtimeMinutes,
            },
          }),
        ),
      );
    }

    const importedGames = await this.prisma.steamGame.findMany({
      where: { userId, gameId: { not: null } },
      select: { gameId: true, playtimeMinutes: true },
    });
    let updatedLibraryEntries = 0;

    for (const importedGame of importedGames) {
      if (!importedGame.gameId) continue;
      const result = await this.prisma.gameLibrary.updateMany({
        where: {
          userId,
          gameId: importedGame.gameId,
          hoursPlayed: { lt: toHours(importedGame.playtimeMinutes) },
        },
        data: { hoursPlayed: toHours(importedGame.playtimeMinutes) },
      });
      updatedLibraryEntries += result.count;
    }

    await this.prisma.steamAccount.update({
      where: { userId },
      data: { lastSyncedAt: new Date() },
    });

    const [items, libraryEntries] = await Promise.all([
      this.prisma.steamGame.findMany({
        where: { userId, playtimeMinutes: { gt: 0 } },
        orderBy: [{ playtimeMinutes: 'desc' }, { name: 'asc' }],
      }),
      this.prisma.gameLibrary.findMany({
        where: { userId },
        select: { gameId: true },
      }),
    ]);
    const libraryGameIds = new Set(libraryEntries.map((entry) => entry.gameId));

    return {
      items: items.map((game) =>
        toLibraryItem(
          game,
          game.gameId !== null && libraryGameIds.has(game.gameId),
        ),
      ),
      totalOwned: ownedGames.length,
      totalPlayed: items.length,
      updatedLibraryEntries,
    };
  }

  async importGames(
    userId: string,
    input: ImportSteamGamesDto,
  ): Promise<SteamImportResultDto> {
    await this.requireAccount(userId);
    const appIds = input.games.map((game) => game.appId);
    const statusByAppId = new Map(
      input.games.map((game) => [
        game.appId,
        game.status ?? LibraryStatus.COMPLETED,
      ]),
    );
    const steamGames = await this.prisma.steamGame.findMany({
      where: { userId, steamAppId: { in: appIds } },
    });

    if (steamGames.length !== appIds.length) {
      throw new NotFoundException(
        'Sync your Steam library before importing these games',
      );
    }

    const results = await mapWithConcurrency(
      steamGames,
      4,
      async (steamGame) => {
        let gameId = steamGame.gameId;

        if (!gameId) {
          const match = await this.gamesService.findExactCatalogMatch(
            steamGame.name,
          );
          gameId = match?.id ?? null;
        }

        if (!gameId) {
          return { kind: 'unmatched' as const, appId: steamGame.steamAppId };
        }

        await this.prisma.steamGame.update({
          where: { id: steamGame.id },
          data: { gameId, importedAt: new Date() },
        });

        const existingEntry = await this.prisma.gameLibrary.findUnique({
          where: { userId_gameId: { userId, gameId } },
        });
        const importedHours = toHours(steamGame.playtimeMinutes);

        if (existingEntry) {
          if (importedHours > existingEntry.hoursPlayed) {
            await this.prisma.gameLibrary.update({
              where: { id: existingEntry.id },
              data: { hoursPlayed: importedHours },
            });
          }
          return { kind: 'updated' as const };
        }

        const initialProgress = resolveLibraryProgress(
          null,
          {
            status:
              statusByAppId.get(steamGame.steamAppId) ??
              LibraryStatus.COMPLETED,
          },
          todayUtc(),
        );

        await this.prisma.gameLibrary.create({
          data: {
            userId,
            gameId,
            ...initialProgress,
            hoursPlayed: importedHours,
          },
        });
        return { kind: 'imported' as const };
      },
    );

    return {
      imported: results.filter((result) => result.kind === 'imported').length,
      updated: results.filter((result) => result.kind === 'updated').length,
      unmatchedAppIds: results.flatMap((result) =>
        result.kind === 'unmatched' ? [result.appId] : [],
      ),
    };
  }

  async disconnect(userId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.steamGame.deleteMany({ where: { userId } }),
      this.prisma.steamAccount.deleteMany({ where: { userId } }),
    ]);
  }

  private async requireAccount(userId: string) {
    const account = await this.prisma.steamAccount.findUnique({
      where: { userId },
    });
    if (!account) {
      throw new NotFoundException('No Steam account is connected');
    }
    return account;
  }
}

function toLibraryItem(
  game: {
    steamAppId: number;
    name: string;
    playtimeMinutes: number;
    gameId: string | null;
  },
  imported: boolean,
): SteamLibraryItemDto {
  return {
    appId: game.steamAppId,
    name: game.name,
    playtimeMinutes: game.playtimeMinutes,
    imported,
  };
}

function toHours(playtimeMinutes: number): number {
  return Math.min(MAX_HOURS_PLAYED, Math.round(playtimeMinutes / 60));
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await mapper(items[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}
