import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { normalizeIdentifier } from './normalize-identifier.js';

export class RegisterDto {
  @ApiProperty({ example: 'player@gametrack.dev', maxLength: 254 })
  @Transform(normalizeIdentifier)
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({
    example: 'player_one',
    description: '3–30 characters: letters, numbers or underscores',
  })
  @Transform(normalizeIdentifier)
  @Matches(/^[a-z0-9_]{3,30}$/, {
    message:
      'username must be 3-30 characters long and contain only letters, numbers or underscores',
  })
  username: string;

  @ApiProperty({ minLength: 8, maxLength: 128, format: 'password' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}
