import { Injectable } from '@nestjs/common';
import type { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import { PrismaService } from '../database/prisma.service.js';
import { activityFeedInclude } from './activity.include.js';
import {
  ActivityDto,
  type ActivityListResponseDto,
} from './dto/activity-response.dto.js';

@Injectable()
export class ActivitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async listFeed(
    viewerId: string,
    query: PaginationQueryDto,
  ): Promise<ActivityListResponseDto> {
    const where = {
      actor: { followers: { some: { followerId: viewerId } } },
    } as const;
    const [activities, total] = await this.prisma.$transaction([
      this.prisma.activity.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: activityFeedInclude,
      }),
      this.prisma.activity.count({ where }),
    ]);

    return {
      items: activities.map((activity) => ActivityDto.fromEntity(activity)),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }
}
