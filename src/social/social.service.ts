import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import type { ListUsersQueryDto } from './dto/list-users-query.dto.js';
import {
  type FollowStatusDto,
  SocialUserDto,
  type SocialUserListResponseDto,
} from './dto/social-user-response.dto.js';

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

@Injectable()
export class SocialService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(
    viewerId: string,
    query: ListUsersQueryDto,
  ): Promise<SocialUserListResponseDto> {
    const search = query.search?.trim();
    const where: Prisma.UserWhereInput = {
      id: { not: viewerId },
      ...(search && {
        OR: [
          { username: { contains: search, mode: 'insensitive' } },
          { displayName: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };
    const socialSelect = {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      followers: {
        where: { followerId: viewerId },
        select: { followerId: true },
        take: 1,
      },
      _count: { select: { followers: true, following: true } },
    } satisfies Prisma.UserSelect;

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: [{ username: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: socialSelect,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: users.map((user) => SocialUserDto.fromEntity(user)),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async follow(followerId: string, username: string): Promise<FollowStatusDto> {
    const target = await this.findFollowTarget(username);
    this.ensureNotSelf(followerId, target.id);

    try {
      await this.prisma.userFollow.create({
        data: { followerId, followingId: target.id },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_CONSTRAINT_VIOLATION
      ) {
        throw new ConflictException('You already follow this user');
      }
      throw error;
    }

    return { username: target.username, isFollowing: true };
  }

  async unfollow(followerId: string, username: string): Promise<void> {
    const target = await this.findFollowTarget(username);
    this.ensureNotSelf(followerId, target.id);

    await this.prisma.userFollow.deleteMany({
      where: { followerId, followingId: target.id },
    });
  }

  private async findFollowTarget(
    username: string,
  ): Promise<{ id: string; username: string }> {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true, username: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private ensureNotSelf(followerId: string, followingId: string): void {
    if (followerId === followingId) {
      throw new BadRequestException('You cannot follow yourself');
    }
  }
}
