import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { ISO_DATE_PATTERN } from '../../common/dates.js';
import { LibraryStatus } from '../../generated/prisma/client.js';

export const MAX_HOURS_PLAYED = 100_000;

const DATE_MESSAGE = '$property must be a date in the YYYY-MM-DD format';

export class AddToLibraryDto {
  @ApiProperty({ format: 'uuid', description: 'Id returned by GET /games' })
  @IsUUID()
  gameId: string;

  @ApiPropertyOptional({
    enum: LibraryStatus,
    default: LibraryStatus.BACKLOG,
  })
  @IsOptional()
  @IsEnum(LibraryStatus)
  status?: LibraryStatus;

  @ApiPropertyOptional({ minimum: 0, maximum: MAX_HOURS_PLAYED, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_HOURS_PLAYED)
  hoursPlayed?: number;

  @ApiPropertyOptional({
    type: String,
    format: 'date',
    nullable: true,
    description: 'Defaults to today when the status becomes PLAYING',
  })
  @IsOptional()
  @Matches(ISO_DATE_PATTERN, { message: DATE_MESSAGE })
  @IsISO8601({ strict: true }, { message: DATE_MESSAGE })
  startedAt?: string | null;

  @ApiPropertyOptional({
    type: String,
    format: 'date',
    nullable: true,
    description:
      'Only allowed with status COMPLETED; defaults to today when it becomes COMPLETED',
  })
  @IsOptional()
  @Matches(ISO_DATE_PATTERN, { message: DATE_MESSAGE })
  @IsISO8601({ strict: true }, { message: DATE_MESSAGE })
  completedAt?: string | null;
}
