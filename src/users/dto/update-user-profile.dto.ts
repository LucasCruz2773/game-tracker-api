import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

function trimmedOrNull(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() || null : value;
}

export class UpdateUserProfileDto {
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    minLength: 2,
    maxLength: 50,
    example: 'Lucas Fernandes',
  })
  @IsOptional()
  @Transform(({ value }) => trimmedOrNull(value))
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  displayName?: string | null;

  @ApiPropertyOptional({
    minLength: 3,
    maxLength: 30,
    pattern: '^[a-z0-9_]+$',
    example: 'lucas_fernandes',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @Matches(/^[a-z0-9_]{3,30}$/)
  username?: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    format: 'uri',
    maxLength: 2048,
  })
  @IsOptional()
  @Transform(({ value }) => trimmedOrNull(value))
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(2048)
  @IsUrl({ protocols: ['https'], require_protocol: true })
  avatarUrl?: string | null;
}
