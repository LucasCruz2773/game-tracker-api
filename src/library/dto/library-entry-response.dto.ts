import { ApiProperty } from '@nestjs/swagger';
import { toIsoDate } from '../../common/dates.js';
import { LibraryStatus } from '../../generated/prisma/client.js';
import { GameSummaryDto } from '../../games/dto/game-response.dto.js';
import type { LibraryEntryWithGame } from '../library-entry.include.js';

export class LibraryEntryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: LibraryStatus })
  status: LibraryStatus;

  @ApiProperty({ example: 12 })
  hoursPlayed: number;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  startedAt: string | null;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  completedAt: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: GameSummaryDto })
  game: GameSummaryDto;

  static fromEntity(entry: LibraryEntryWithGame): LibraryEntryDto {
    return {
      id: entry.id,
      status: entry.status,
      hoursPlayed: entry.hoursPlayed,
      startedAt: toIsoDate(entry.startedAt),
      completedAt: toIsoDate(entry.completedAt),
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      game: GameSummaryDto.fromEntity(entry.game),
    };
  }
}

export class LibraryListResponseDto {
  @ApiProperty({ type: [LibraryEntryDto] })
  items: LibraryEntryDto[];

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  pageSize: number;

  @ApiProperty({ example: 42 })
  total: number;
}
