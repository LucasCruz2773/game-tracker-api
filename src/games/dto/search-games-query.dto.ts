import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
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
