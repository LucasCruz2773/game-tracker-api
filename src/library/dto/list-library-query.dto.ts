import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import { LibraryStatus } from '../../generated/prisma/client.js';

export const LIBRARY_SORT_FIELDS = [
  'updatedAt',
  'createdAt',
  'title',
  'rating',
] as const;
export type LibrarySortField = (typeof LIBRARY_SORT_FIELDS)[number];

export class ListLibraryQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    maxLength: 100,
    description: 'Searches games in the library by title',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: LibraryStatus })
  @IsOptional()
  @IsEnum(LibraryStatus)
  status?: LibraryStatus;

  @ApiPropertyOptional({ enum: LIBRARY_SORT_FIELDS, default: 'updatedAt' })
  @IsIn(LIBRARY_SORT_FIELDS)
  sortBy: LibrarySortField = 'updatedAt';

  @ApiPropertyOptional({
    enum: ['asc', 'desc'],
    description: 'Defaults to asc for title and desc for dates and rating',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}
