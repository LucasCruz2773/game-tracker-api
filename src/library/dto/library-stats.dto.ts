import { ApiProperty } from '@nestjs/swagger';
import { LibraryStatus } from '../../generated/prisma/client.js';

export class LibraryStatusCountsDto {
  @ApiProperty({ example: 2 })
  PLAYING: number;

  @ApiProperty({ example: 5 })
  BACKLOG: number;

  @ApiProperty({ example: 3 })
  COMPLETED: number;

  @ApiProperty({ example: 1 })
  DROPPED: number;
}

export class LibraryStatsDto {
  @ApiProperty({ example: 11 })
  totalGames: number;

  @ApiProperty({ type: LibraryStatusCountsDto })
  byStatus: LibraryStatusCountsDto;

  @ApiProperty({ example: 142 })
  totalHoursPlayed: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 8,
    description: 'Average review rating on the 1–10 scale',
  })
  averageRating: number | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 4,
    description: 'Average rating converted to stars (0.5–5)',
  })
  averageStarRating: number | null;
}

export function emptyStatusCounts(): LibraryStatusCountsDto {
  return {
    [LibraryStatus.PLAYING]: 0,
    [LibraryStatus.BACKLOG]: 0,
    [LibraryStatus.COMPLETED]: 0,
    [LibraryStatus.DROPPED]: 0,
  };
}
