import { ApiProperty } from '@nestjs/swagger';
import type { User } from '../../generated/prisma/client.js';

export class UserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'player@gametrack.dev' })
  email: string;

  @ApiProperty({ example: 'player_one' })
  username: string;

  @ApiProperty()
  createdAt: Date;

  static fromEntity(user: User): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      createdAt: user.createdAt,
    };
  }
}
