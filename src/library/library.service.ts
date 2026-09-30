import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { parseIsoDate, todayUtc } from '../common/dates.js';
import { PrismaService } from '../database/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import type { AddToLibraryDto } from './dto/add-to-library.dto.js';
import {
  LibraryEntryDto,
  type LibraryListResponseDto,
} from './dto/library-entry-response.dto.js';
import type { ListLibraryQueryDto } from './dto/list-library-query.dto.js';
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

  async list(
    userId: string,
    query: ListLibraryQueryDto,
  ): Promise<LibraryListResponseDto> {
    const where: Prisma.GameLibraryWhereInput = {
      userId,
      ...(query.status && { status: query.status }),
    };
    const order = query.order ?? (query.sortBy === 'title' ? 'asc' : 'desc');
    const orderBy: Prisma.GameLibraryOrderByWithRelationInput[] = [
      query.sortBy === 'title'
        ? { game: { title: order } }
        : { [query.sortBy]: order },
      // Tie-breaker so pagination is stable when sort values are equal.
      // UUIDv7 ids are time-ordered, so this also matches creation order.
      { id: order },
    ];

    const [entries, total] = await this.prisma.$transaction([
      this.prisma.gameLibrary.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: libraryEntryWithGameInclude,
      }),
      this.prisma.gameLibrary.count({ where }),
    ]);

    return {
      items: entries.map((entry) => LibraryEntryDto.fromEntity(entry)),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async findOne(userId: string, gameId: string): Promise<LibraryEntryDto> {
    return LibraryEntryDto.fromEntity(
      await this.findEntryOrThrow(userId, gameId),
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
      const entry = await this.prisma.gameLibrary.create({
        data: {
          userId,
          gameId: game.id,
          hoursPlayed: addToLibraryDto.hoursPlayed ?? 0,
          ...progress,
        },
        include: libraryEntryWithGameInclude,
      });

      return LibraryEntryDto.fromEntity(entry);
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

    const updatedEntry = await this.prisma.gameLibrary.update({
      where: { id: entry.id },
      data: {
        ...progress,
        ...(updateDto.hoursPlayed !== undefined && {
          hoursPlayed: updateDto.hoursPlayed,
        }),
      },
      include: libraryEntryWithGameInclude,
    });

    return LibraryEntryDto.fromEntity(updatedEntry);
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
