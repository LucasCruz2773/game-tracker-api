import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

export enum GameOrdering {
  Relevance = 'relevance',
  Popularity = 'popularity',
  Rating = 'rating',
  Name = 'name',
  Released = 'released',
}

export enum GameSortDirection {
  Ascending = 'asc',
  Descending = 'desc',
}

export class SearchGamesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: GameOrdering,
    default: GameOrdering.Relevance,
    description: 'Catalog ordering preset',
  })
  @IsOptional()
  @IsEnum(GameOrdering)
  ordering: GameOrdering = GameOrdering.Relevance;

  @ApiPropertyOptional({
    enum: GameSortDirection,
    description:
      'Defaults to ascending for name and descending for other fields.',
  })
  @IsOptional()
  @IsEnum(GameSortDirection)
  direction?: GameSortDirection;

  @ApiPropertyOptional({
    example: 'role-playing-games-rpg',
    description: 'RAWG genre slug',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  genre?: string;

  @ApiPropertyOptional({
    example: 'celeste',
    description: 'Text to search for. Omit it to browse popular games.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  search?: string;
}
