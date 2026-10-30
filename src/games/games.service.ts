import {
  BadGatewayException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type {
  CatalogGame,
  CatalogGameDetails,
  CatalogTag,
} from './catalog.types.js';
import {
  GameDetailsDto,
  GameSearchResponseDto,
  GameSummaryDto,
} from './dto/game-response.dto.js';
import {
  GameOrdering,
  type SearchGamesQueryDto,
} from './dto/search-games-query.dto.js';
import { gameWithTagsInclude, type GameWithTags } from './game.include.js';
import { CatalogUnavailableException, RawgClient } from './rawg/rawg.client.js';

@Injectable()
export class GamesService {
  private readonly logger = new Logger(GamesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rawgClient: RawgClient,
  ) {}

  async search(query: SearchGamesQueryDto): Promise<GameSearchResponseDto> {
    const discover = query.search === undefined;
    const catalogResult = await this.rawgClient.searchGames({
      search: query.search,
      ordering: toRawgOrdering(query.ordering, discover),
      discover,
      page: query.page,
      pageSize: query.pageSize,
    });
    const games = await this.saveCatalogGames(catalogResult.games);

    return {
      items: games.map((game) => GameSummaryDto.fromEntity(game)),
      page: query.page,
      pageSize: query.pageSize,
      total: catalogResult.total,
    };
  }

  async findById(id: string): Promise<GameDetailsDto> {
    const game = await this.prisma.game.findUnique({
      where: { id },
      include: gameWithTagsInclude,
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    const syncedGame = game.detailsSyncedAt
      ? game
      : await this.syncGameDetails(game);

    const reviewAggregate = await this.prisma.review.aggregate({
      where: { gameId: id },
      _avg: { rating: true },
      _count: { _all: true },
    });
    const rawAverage = reviewAggregate._avg.rating;
    const averageRating =
      rawAverage === null ? null : Math.round(Number(rawAverage) * 10) / 10;

    return GameDetailsDto.fromEntityWithRatings(syncedGame, {
      averageRating,
      reviewCount: reviewAggregate._count._all,
    });
  }

  async fetchCover(id: string): Promise<{ body: Buffer; contentType: string }> {
    const game = await this.prisma.game.findUnique({
      where: { id },
      select: { coverUrl: true },
    });

    if (!game?.coverUrl) {
      throw new NotFoundException('Game cover not found');
    }

    let coverUrl: URL;
    try {
      coverUrl = new URL(game.coverUrl);
    } catch {
      throw new BadGatewayException('Invalid game cover URL');
    }

    if (
      coverUrl.protocol !== 'https:' ||
      (coverUrl.hostname !== 'rawg.io' &&
        !coverUrl.hostname.endsWith('.rawg.io'))
    ) {
      throw new BadGatewayException('Unsupported game cover host');
    }

    try {
      const response = await fetch(coverUrl, {
        headers: { Accept: 'image/*' },
        signal: AbortSignal.timeout(8_000),
      });
      const contentType = response.headers.get('content-type') ?? '';
      if (!response.ok || !contentType.startsWith('image/')) {
        throw new Error(`Cover responded with ${response.status}`);
      }

      const body = Buffer.from(await response.arrayBuffer());
      if (body.byteLength > 10 * 1024 * 1024) {
        throw new Error('Cover is larger than 10 MB');
      }
      return { body, contentType };
    } catch (error) {
      this.logger.warn(
        `Could not fetch cover for game ${id}: ${String(error)}`,
      );
      throw new BadGatewayException('Game cover is unavailable');
    }
  }

  async findExactCatalogMatch(title: string): Promise<GameSummaryDto | null> {
    const catalogResult = await this.rawgClient.searchGames({
      search: title,
      page: 1,
      pageSize: 10,
    });
    const normalizedTitle = normalizeTitle(title);
    const match = catalogResult.games.find(
      (game) => normalizeTitle(game.title) === normalizedTitle,
    );

    if (!match) {
      return null;
    }

    const [savedGame] = await this.saveCatalogGames([match]);
    return GameSummaryDto.fromEntity(savedGame);
  }

  /**
   * Fetches the full details of a game the first time it is opened.
   * If the catalog is down, the summary data already stored is returned instead.
   */
  private async syncGameDetails(game: GameWithTags): Promise<GameWithTags> {
    let details: CatalogGameDetails | null;

    try {
      details = await this.rawgClient.getGameDetails(game.rawgId);
    } catch (error) {
      if (error instanceof CatalogUnavailableException) {
        this.logger.warn(
          `Serving game ${game.id} without details: catalog unavailable`,
        );
        return game;
      }
      throw error;
    }

    if (details) {
      await this.saveTags([details]);
    }

    return this.prisma.game.update({
      where: { id: game.id },
      data: {
        ...(details && {
          ...toGameFields(details),
          description: details.description,
          genres: { set: toSlugReferences(details.genres) },
          platforms: { set: toSlugReferences(details.platforms) },
        }),
        detailsSyncedAt: new Date(),
      },
      include: gameWithTagsInclude,
    });
  }

  private async saveCatalogGames(
    catalogGames: CatalogGame[],
  ): Promise<GameWithTags[]> {
    if (catalogGames.length === 0) {
      return [];
    }

    await this.saveTags(catalogGames);

    // An upsert checks and inserts in separate steps, so concurrent searches
    // returning the same game collided on rawg_id. Insert with ON CONFLICT DO
    // NOTHING instead, then refresh every game.
    await this.prisma.game.createMany({
      data: catalogGames.map((catalogGame) => ({
        rawgId: catalogGame.rawgId,
        ...toGameFields(catalogGame),
      })),
      skipDuplicates: true,
    });

    // Updating in rawg_id order makes concurrent transactions lock rows in the
    // same order, so they wait for each other instead of deadlocking.
    const gamesInLockOrder = [...catalogGames].sort(
      (left, right) => left.rawgId - right.rawgId,
    );
    const savedGames: GameWithTags[] = [];
    for (const catalogGame of gamesInLockOrder) {
      savedGames.push(
        await this.prisma.game.update({
          where: { rawgId: catalogGame.rawgId },
          data: {
            ...toGameFields(catalogGame),
            genres: { set: toSlugReferences(catalogGame.genres) },
            platforms: { set: toSlugReferences(catalogGame.platforms) },
          },
          include: gameWithTagsInclude,
        }),
      );
    }

    const savedByRawgId = new Map(
      savedGames.map((game) => [game.rawgId, game]),
    );
    return catalogGames.map((catalogGame) =>
      savedByRawgId.get(catalogGame.rawgId)!,
    );
  }

  /**
   * Inserts with ON CONFLICT DO NOTHING so concurrent requests returning the
   * same genres/platforms don't fail on unique constraints.
   */
  private async saveTags(catalogGames: CatalogGame[]): Promise<void> {
    await this.prisma.genre.createMany({
      data: uniqueBySlug(catalogGames.flatMap((game) => game.genres)),
      skipDuplicates: true,
    });
    await this.prisma.platform.createMany({
      data: uniqueBySlug(catalogGames.flatMap((game) => game.platforms)),
      skipDuplicates: true,
    });
  }
}

function toRawgOrdering(
  ordering: GameOrdering,
  discover: boolean,
): '-relevance' | '-added' | '-rating' | 'name' | '-released' | undefined {
  switch (ordering) {
    case GameOrdering.Popularity:
      return '-added';
    case GameOrdering.Rating:
      return '-rating';
    case GameOrdering.Name:
      return 'name';
    case GameOrdering.Released:
      return '-released';
    case GameOrdering.Relevance:
      return discover ? '-relevance' : undefined;
  }
}

function toGameFields(catalogGame: CatalogGame) {
  return {
    slug: catalogGame.slug,
    title: catalogGame.title,
    coverUrl: catalogGame.coverUrl,
    releaseDate: catalogGame.releaseDate,
  };
}

function toSlugReferences(tags: CatalogTag[]): { slug: string }[] {
  return tags.map(({ slug }) => ({ slug }));
}

function uniqueBySlug(tags: CatalogTag[]): CatalogTag[] {
  return [...new Map(tags.map((tag) => [tag.slug, tag])).values()];
}

function normalizeTitle(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
