import { Injectable, Logger, NotFoundException } from '@nestjs/common';
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
import type { SearchGamesQueryDto } from './dto/search-games-query.dto.js';
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
    const catalogResult = await this.rawgClient.searchGames({
      search: query.search,
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

    return GameDetailsDto.fromEntity(syncedGame);
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

    return this.prisma.$transaction(
      catalogGames.map((catalogGame) =>
        this.prisma.game.upsert({
          where: { rawgId: catalogGame.rawgId },
          create: {
            rawgId: catalogGame.rawgId,
            ...toGameFields(catalogGame),
            genres: { connect: toSlugReferences(catalogGame.genres) },
            platforms: { connect: toSlugReferences(catalogGame.platforms) },
          },
          update: {
            ...toGameFields(catalogGame),
            genres: { set: toSlugReferences(catalogGame.genres) },
            platforms: { set: toSlugReferences(catalogGame.platforms) },
          },
          include: gameWithTagsInclude,
        }),
      ),
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
