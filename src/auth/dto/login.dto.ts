import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { normalizeIdentifier } from './normalize-identifier.js';

export class LoginDto {
  @ApiProperty({ example: 'player@gametrack.dev' })
  @Transform(normalizeIdentifier)
  @IsEmail()
  email: string;

  @ApiProperty({ format: 'password' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password: string;
}
