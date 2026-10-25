import { ApiProperty } from '@nestjs/swagger';

interface SocialUserEntity {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  followers: { followerId: string }[];
  _count: {
    followers: number;
    following: number;
  };
}

export class SocialUserDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'lucas_fernandes' })
  username: string;

  @ApiProperty({ type: String, nullable: true, example: 'Lucas Fernandes' })
  displayName: string | null;

  @ApiProperty({ type: String, nullable: true, format: 'uri' })
  avatarUrl: string | null;

  @ApiProperty({ example: 12 })
  followerCount: number;

  @ApiProperty({ example: 8 })
  followingCount: number;

  @ApiProperty({ example: true })
  isFollowing: boolean;

  static fromEntity(user: SocialUserEntity): SocialUserDto {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      followerCount: user._count.followers,
      followingCount: user._count.following,
      isFollowing: user.followers.length > 0,
    };
  }
}

export class SocialUserListResponseDto {
  @ApiProperty({ type: [SocialUserDto] })
  items: SocialUserDto[];

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  pageSize: number;

  @ApiProperty({ example: 42 })
  total: number;
}

export class FollowStatusDto {
  @ApiProperty({ example: 'lucas_fernandes' })
  username: string;

  @ApiProperty({ example: true })
  isFollowing: boolean;
}
