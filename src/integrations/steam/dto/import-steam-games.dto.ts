import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { LibraryStatus } from '../../../generated/prisma/client.js';
import {
  MAX_REVIEW_RATING,
  MIN_REVIEW_RATING,
} from '../../../reviews/rating.js';

export class ImportSteamGameDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  appId: number;

  @ApiPropertyOptional({
    enum: LibraryStatus,
    default: LibraryStatus.COMPLETED,
    description: 'Initial status applied if this game is newly imported',
  })
  @IsOptional()
  @IsEnum(LibraryStatus)
  status?: LibraryStatus;

  @ApiPropertyOptional({
    minimum: MIN_REVIEW_RATING,
    maximum: MAX_REVIEW_RATING,
    description: 'Optional half-star rating stored as an integer from 1 to 10',
    example: 8,
  })
  @IsOptional()
  @IsInt()
  @Min(MIN_REVIEW_RATING)
  @Max(MAX_REVIEW_RATING)
  rating?: number;
}

export class ImportSteamGamesDto {
  @ApiProperty({ type: [ImportSteamGameDto], maxItems: 25 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(25)
  @ArrayUnique((game: ImportSteamGameDto | null | undefined) => game?.appId)
  @ValidateNested({ each: true })
  @Type(() => ImportSteamGameDto)
  games: ImportSteamGameDto[];
}
