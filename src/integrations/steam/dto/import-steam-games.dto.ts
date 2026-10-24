import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  Min,
} from 'class-validator';
import { LibraryStatus } from '../../../generated/prisma/client.js';

export class ImportSteamGamesDto {
  @ApiProperty({ type: [Number], maxItems: 25 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(25)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  appIds: number[];

  @ApiPropertyOptional({
    enum: LibraryStatus,
    default: LibraryStatus.COMPLETED,
    description: 'Initial status applied only to newly imported games',
  })
  @IsOptional()
  @IsEnum(LibraryStatus)
  status?: LibraryStatus;
}
