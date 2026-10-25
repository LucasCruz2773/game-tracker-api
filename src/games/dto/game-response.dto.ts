import { ApiProperty } from '@nestjs/swagger';
import { toIsoDate } from '../../common/dates.js';
import type { GameWithTags } from '../game.include.js';

export class GameTagDto {
  @ApiProperty({ example: 'Platformer' })
  name: string;

  @ApiProperty({ example: 'platformer' })
  slug: string;
}

export class GameSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'celeste' })
  slug: string;

  @ApiProperty({ example: 'Celeste' })
  title: string;

  @ApiProperty({ type: String, nullable: true, format: 'uri' })
  coverUrl: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    format: 'date',
    example: '2018-01-25',
  })
  releaseDate: string | null;

  @ApiProperty({ type: [GameTagDto] })
  genres: GameTagDto[];

  @ApiProperty({ type: [GameTagDto] })
  platforms: GameTagDto[];

  static fromEntity(game: GameWithTags): GameSummaryDto {
    return {
      id: game.id,
      slug: game.slug,
      title: game.title,
      coverUrl: game.coverUrl,
      releaseDate: toIsoDate(game.releaseDate),
      genres: game.genres.map(({ name, slug }) => ({ name, slug })),
      platforms: game.platforms.map(({ name, slug }) => ({ name, slug })),
    };
  }
}

export class GameDetailsDto extends GameSummaryDto {
  @ApiProperty({ type: String, nullable: true })
  description: string | null;

  @ApiProperty({ type: Number, nullable: true, example: 8.6 })
  averageRating: number | null;

  @ApiProperty({ type: Number, nullable: true, example: 4.3 })
  averageStarRating: number | null;

  @ApiProperty({ example: 42 })
  reviewCount: number;

  static fromEntityWithRatings(
    game: GameWithTags,
    ratings: { averageRating: number | null; reviewCount: number },
  ): GameDetailsDto {
    return Object.assign(GameSummaryDto.fromEntity(game), {
      description: game.description,
      averageRating: ratings.averageRating,
      averageStarRating:
        ratings.averageRating === null
          ? null
          : Math.round((ratings.averageRating / 2) * 10) / 10,
      reviewCount: ratings.reviewCount,
    });
  }
}

export class GameSearchResponseDto {
  @ApiProperty({ type: [GameSummaryDto] })
  items: GameSummaryDto[];

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  pageSize: number;

  @ApiProperty({ example: 873, description: 'Total matches in the catalog' })
  total: number;
}
