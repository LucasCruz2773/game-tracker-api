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
  Min,
  ValidateNested,
} from 'class-validator';
import { LibraryStatus } from '../../../generated/prisma/client.js';

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
