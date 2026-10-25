import { ApiProperty } from '@nestjs/swagger';
import { ActivityType } from '../../generated/prisma/client.js';
import { GameSummaryDto } from '../../games/dto/game-response.dto.js';
import { toStarRating } from '../../reviews/rating.js';
import type { ActivityFeedEntity } from '../activity.include.js';

export class ActivityActorDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'lucas_fernandes' })
  username: string;

  @ApiProperty({ type: String, nullable: true, format: 'uri' })
  avatarUrl: string | null;
}

export class ActivityDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: ActivityType })
  type: ActivityType;

  @ApiProperty({ type: Number, nullable: true, minimum: 1, maximum: 10 })
  rating: number | null;

  @ApiProperty({ type: Number, nullable: true, minimum: 0.5, maximum: 5 })
  starRating: number | null;

  @ApiProperty({ type: String, nullable: true })
  reviewBody: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ type: ActivityActorDto })
  actor: ActivityActorDto;

  @ApiProperty({ type: GameSummaryDto })
  game: GameSummaryDto;

  static fromEntity(activity: ActivityFeedEntity): ActivityDto {
    return {
      id: activity.id,
      type: activity.type,
      rating: activity.rating,
      starRating:
        activity.rating === null ? null : toStarRating(activity.rating),
      reviewBody: activity.reviewBody,
      createdAt: activity.createdAt,
      actor: activity.actor,
      game: GameSummaryDto.fromEntity(activity.game),
    };
  }
}

export class ActivityListResponseDto {
  @ApiProperty({ type: [ActivityDto] })
  items: ActivityDto[];

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  pageSize: number;

  @ApiProperty({ example: 42 })
  total: number;
}
