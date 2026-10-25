import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { parseIsoDate, todayUtc } from '../common/dates.js';
import { PrismaService } from '../database/prisma.service.js';
import { ActivityType, Prisma } from '../generated/prisma/client.js';
import type { AddToLibraryDto } from './dto/add-to-library.dto.js';
import {
  LibraryEntryDto,
  type LibraryListResponseDto,
} from './dto/library-entry-response.dto.js';
import type { ListLibraryQueryDto } from './dto/list-library-query.dto.js';
import {
  emptyStatusCounts,
  type LibraryStatsDto,
} from './dto/library-stats.dto.js';
import type { UpdateLibraryEntryDto } from './dto/update-library-entry.dto.js';
import {
  resolveLibraryProgress,
  type LibraryProgressChanges,
} from './library-entry.rules.js';
import {
  libraryEntryWithGameInclude,
  type LibraryEntryWithGame,
} from './library-entry.include.js';

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

@Injectable()
export class LibraryService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(userId: string): Promise<LibraryStatsDto> {
    const [statusGroups, libraryTotals, reviewAverage] = await Promise.all([
      this.prisma.gameLibrary.groupBy({
        by: ['status'],
        where: { userId },
        _count: { _all: true },
      }),
      this.prisma.gameLibrary.aggregate({
        where: { userId },
        _sum: { hoursPlayed: true },
        _count: { _all: true },
      }),
      this.prisma.review.aggregate({
        where: { userId },
        _avg: { rating: true },
      }),
    ]);

    const byStatus = emptyStatusCounts();
    for (const group of statusGroups) {
      byStatus[group.status] = group._count._all;
    }

    const averageRating = toNullableNumber(reviewAverage._avg.rating);

    return {
      totalGames: libraryTotals._count._all,
      byStatus,
      totalHoursPlayed: libraryTotals._sum.hoursPlayed ?? 0,
      averageRating:
        averageRating === null ? null : roundToOneDecimal(averageRating),
      averageStarRating:
        averageRating === null ? null : roundToOneDecimal(averageRating / 2),
    };
  }

  async list(
    userId: string,
    query: ListLibraryQueryDto,
  ): Promise<LibraryListResponseDto> {
    const where: Prisma.GameLibraryWhereInput = {
      userId,
      ...(query.status && { status: query.status }),
      ...(query.search && {
        game: { title: { contains: query.search, mode: 'insensitive' } },
      }),
    };
    const order = query.order ?? (query.sortBy === 'title' ? 'asc' : 'desc');
    const orderBy: Prisma.GameLibraryOrderByWithRelationInput[] = [
      query.sortBy === 'title'
        ? { game: { title: order } }
        : { [query.sortBy === 'rating' ? 'updatedAt' : query.sortBy]: order },
      // Tie-breaker so pagination is stable when sort values are equal.
      // UUIDv7 ids are time-ordered, so this also matches creation order.
      { id: order },
    ];

    const [entries, total] =
      query.sortBy === 'rating'
        ? await this.listOrderedByRating(userId, query, order)
        : await this.prisma.$transaction([
            this.prisma.gameLibrary.findMany({
              where,
              orderBy,
              skip: (query.page - 1) * query.pageSize,
              take: query.pageSize,
              include: libraryEntryWithGameInclude,
            }),
            this.prisma.gameLibrary.count({ where }),
          ]);
    const reviews =
      entries.length === 0
        ? []
        : await this.prisma.review.findMany({
            where: {
              userId,
              gameId: { in: entries.map((entry) => entry.gameId) },
            },
            select: { id: true, gameId: true, rating: true },
          });
    const reviewByGameId = new Map(
      reviews.map((review) => [review.gameId, review]),
    );

    return {
      items: entries.map((entry) =>
        LibraryEntryDto.fromEntity(
          entry,
          reviewByGameId.get(entry.gameId) ?? null,
        ),
      ),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async findOne(userId: string, gameId: string): Promise<LibraryEntryDto> {
    const entry = await this.findEntryOrThrow(userId, gameId);
    return LibraryEntryDto.fromEntity(
      entry,
      await this.findReview(userId, gameId),
    );
  }

  async add(
    userId: string,
    addToLibraryDto: AddToLibraryDto,
  ): Promise<LibraryEntryDto> {
    const game = await this.prisma.game.findUnique({
      where: { id: addToLibraryDto.gameId },
      select: { id: true },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    const progress = resolveLibraryProgress(
      null,
      toProgressChanges(addToLibraryDto),
      todayUtc(),
    );

    try {
      const entry = await this.prisma.$transaction(async (transaction) => {
        const created = await transaction.gameLibrary.create({
          data: {
            userId,
            gameId: game.id,
            hoursPlayed: addToLibraryDto.hoursPlayed ?? 0,
            ...progress,
          },
          include: libraryEntryWithGameInclude,
        });
        await transaction.activity.create({
          data: {
            actorId: userId,
            gameId: game.id,
            type:
              progress.status === 'COMPLETED'
                ? ActivityType.GAME_COMPLETED
                : ActivityType.LIBRARY_ADDED,
          },
        });
        return created;
      });

      return LibraryEntryDto.fromEntity(
        entry,
        await this.findReview(userId, game.id),
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_CONSTRAINT_VIOLATION
      ) {
        throw new ConflictException('Game is already in your library');
      }
      throw error;
    }
  }

  async update(
    userId: string,
    gameId: string,
    updateDto: UpdateLibraryEntryDto,
  ): Promise<LibraryEntryDto> {
    const entry = await this.findEntryOrThrow(userId, gameId);
    const progress = resolveLibraryProgress(
      entry,
      toProgressChanges(updateDto),
      todayUtc(),
    );

    const updatedEntry = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.gameLibrary.update({
        where: { id: entry.id },
        data: {
          ...progress,
          ...(updateDto.hoursPlayed !== undefined && {
            hoursPlayed: updateDto.hoursPlayed,
          }),
        },
        include: libraryEntryWithGameInclude,
      });
      if (entry.status !== 'COMPLETED' && progress.status === 'COMPLETED') {
        await transaction.activity.create({
          data: {
            actorId: userId,
            gameId,
            type: ActivityType.GAME_COMPLETED,
          },
        });
      }
      return updated;
    });

    return LibraryEntryDto.fromEntity(
      updatedEntry,
      await this.findReview(userId, gameId),
    );
  }

  async remove(userId: string, gameId: string): Promise<void> {
    const { count } = await this.prisma.gameLibrary.deleteMany({
      where: { userId, gameId },
    });

    if (count === 0) {
      throw notInLibrary();
    }
  }

  private async findEntryOrThrow(
    userId: string,
    gameId: string,
  ): Promise<LibraryEntryWithGame> {
    const entry = await this.prisma.gameLibrary.findUnique({
      where: { userId_gameId: { userId, gameId } },
      include: libraryEntryWithGameInclude,
    });

    if (!entry) {
      throw notInLibrary();
    }

    return entry;
  }

  private findReview(userId: string, gameId: string) {
    return this.prisma.review.findUnique({
      where: { userId_gameId: { userId, gameId } },
      select: { id: true, rating: true },
    });
  }

  private async listOrderedByRating(
    userId: string,
    query: ListLibraryQueryDto,
    order: 'asc' | 'desc',
  ): Promise<[LibraryEntryWithGame[], number]> {
    const statusFilter = query.status
      ? Prisma.sql`AND gl.status = ${query.status}::"library_status"`
      : Prisma.empty;
    const searchFilter = query.search
      ? Prisma.sql`AND g.title ILIKE ${`%${query.search}%`}`
      : Prisma.empty;
    const direction = order === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
    const offset = (query.page - 1) * query.pageSize;
    const ids = await this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT gl.id
      FROM "game_library" gl
      INNER JOIN "games" g ON g.id = gl."game_id"
      LEFT JOIN "reviews" r
        ON r."user_id" = gl."user_id" AND r."game_id" = gl."game_id"
      WHERE gl."user_id" = ${userId}::uuid ${statusFilter} ${searchFilter}
      ORDER BY r.rating ${direction} NULLS LAST, gl.id ${direction}
      LIMIT ${query.pageSize} OFFSET ${offset}
    `);
    const [entries, total] = await Promise.all([
      this.prisma.gameLibrary.findMany({
        where: { id: { in: ids.map(({ id }) => id) } },
        include: libraryEntryWithGameInclude,
      }),
      this.prisma.gameLibrary.count({
        where: {
          userId,
          ...(query.status && { status: query.status }),
          ...(query.search && {
            game: { title: { contains: query.search, mode: 'insensitive' } },
          }),
        },
      }),
    ]);
    const position = new Map(ids.map(({ id }, index) => [id, index]));
    entries.sort(
      (left, right) =>
        (position.get(left.id) ?? 0) - (position.get(right.id) ?? 0),
    );
    return [entries, total];
  }
}

function notInLibrary(): NotFoundException {
  return new NotFoundException('Game is not in your library');
}

function toProgressChanges(
  dto: Pick<UpdateLibraryEntryDto, 'status' | 'startedAt' | 'completedAt'>,
): LibraryProgressChanges {
  return {
    status: dto.status,
    startedAt: toOptionalDate(dto.startedAt),
    completedAt: toOptionalDate(dto.completedAt),
  };
}

function toOptionalDate(
  isoDate: string | null | undefined,
): Date | null | undefined {
  return isoDate === undefined || isoDate === null
    ? isoDate
    : parseIsoDate(isoDate);
}

function toNullableNumber(value: number | null | undefined): number | null {
  return value === null || value === undefined ? null : value;
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}
