import { ApiProperty } from '@nestjs/swagger';
import type { User } from '../../generated/prisma/client.js';

export class UserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'player@gmail.com' })
  email: string;

  @ApiProperty({ example: 'lucas_fernandes' })
  username: string;

  @ApiProperty({ type: String, nullable: true, example: 'Lucas Fernandes' })
  displayName: string | null;

  @ApiProperty({ type: String, nullable: true, format: 'uri' })
  avatarUrl: string | null;

  @ApiProperty()
  createdAt: Date;

  static fromEntity(user: User): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
    };
  }
}
