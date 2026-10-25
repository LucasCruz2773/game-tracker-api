import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import { ActivitiesService } from './activities.service.js';
import { ActivityListResponseDto } from './dto/activity-response.dto.js';

@ApiTags('Activities')
@ApiCookieAuth()
@ApiUnauthorizedResponse()
@UseGuards(JwtAuthGuard)
@Controller('activities')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get('feed')
  @ApiOkResponse({ type: ActivityListResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid pagination' })
  feed(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ): Promise<ActivityListResponseDto> {
    return this.activitiesService.listFeed(user.id, query);
  }
}
