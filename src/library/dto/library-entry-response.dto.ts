import { ApiProperty } from '@nestjs/swagger';
import { toIsoDate } from '../../common/dates.js';
import { LibraryStatus, type Review } from '../../generated/prisma/client.js';
import { GameSummaryDto } from '../../games/dto/game-response.dto.js';
import { toStarRating } from '../../reviews/rating.js';
import type { LibraryEntryWithGame } from '../library-entry.include.js';

type LibraryReview = Pick<Review, 'id' | 'rating'>;

export class LibraryEntryReviewDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ minimum: 1, maximum: 10 })
  rating: number;

  @ApiProperty({ minimum: 0.5, maximum: 5 })
  starRating: number;

  static fromEntity(review: LibraryReview): LibraryEntryReviewDto {
    return {
      id: review.id,
      rating: review.rating,
      starRating: toStarRating(review.rating),
    };
  }
}

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

  @ApiProperty({ type: LibraryEntryReviewDto, nullable: true })
  review: LibraryEntryReviewDto | null;

  static fromEntity(
    entry: LibraryEntryWithGame,
    review: LibraryReview | null,
  ): LibraryEntryDto {
    return {
      id: entry.id,
      status: entry.status,
      hoursPlayed: entry.hoursPlayed,
      startedAt: toIsoDate(entry.startedAt),
      completedAt: toIsoDate(entry.completedAt),
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      game: GameSummaryDto.fromEntity(entry.game),
      review: review ? LibraryEntryReviewDto.fromEntity(review) : null,
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
