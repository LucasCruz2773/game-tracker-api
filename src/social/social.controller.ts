import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { LibraryListResponseDto } from '../library/dto/library-entry-response.dto.js';
import { ListLibraryQueryDto } from '../library/dto/list-library-query.dto.js';
import { LibraryStatsDto } from '../library/dto/library-stats.dto.js';
import { LibraryService } from '../library/library.service.js';
import { ListUsersQueryDto } from './dto/list-users-query.dto.js';
import {
  FollowStatusDto,
  PublicProfileDto,
  SocialUserListResponseDto,
  SocialSummaryDto,
} from './dto/social-user-response.dto.js';
import { UsernameParamDto } from './dto/username-param.dto.js';
import { SocialService } from './social.service.js';

@ApiTags('Social')
@ApiCookieAuth()
@ApiUnauthorizedResponse()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class SocialController {
  constructor(
    private readonly socialService: SocialService,
    private readonly libraryService: LibraryService,
  ) {}

  @Get()
  @ApiOkResponse({ type: SocialUserListResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid search or pagination' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListUsersQueryDto,
  ): Promise<SocialUserListResponseDto> {
    return this.socialService.listUsers(user.id, query);
  }

  @Get('me/social-summary')
  @ApiOkResponse({ type: SocialSummaryDto })
  summary(@CurrentUser() user: AuthenticatedUser): Promise<SocialSummaryDto> {
    return this.socialService.getSummary(user.id);
  }

  @Get('me/followers')
  @ApiOkResponse({ type: SocialUserListResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid search or pagination' })
  followers(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListUsersQueryDto,
  ): Promise<SocialUserListResponseDto> {
    return this.socialService.listFollowers(user.id, query);
  }

  @Get('me/following')
  @ApiOkResponse({ type: SocialUserListResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid search or pagination' })
  following(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListUsersQueryDto,
  ): Promise<SocialUserListResponseDto> {
    return this.socialService.listFollowing(user.id, query);
  }

  @Get(':username')
  @ApiOkResponse({ type: PublicProfileDto })
  @ApiNotFoundResponse({ description: 'User not found' })
  profile(
    @CurrentUser() viewer: AuthenticatedUser,
    @Param() params: UsernameParamDto,
  ): Promise<PublicProfileDto> {
    return this.socialService.getPublicProfile(viewer.id, params.username);
  }

  @Get(':username/library')
  @ApiOkResponse({ type: LibraryListResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid filters or pagination' })
  @ApiNotFoundResponse({ description: 'User not found' })
  async library(
    @Param() params: UsernameParamDto,
    @Query() query: ListLibraryQueryDto,
  ): Promise<LibraryListResponseDto> {
    const userId = await this.socialService.findUserIdByUsername(
      params.username,
    );
    return this.libraryService.list(userId, query);
  }

  @Get(':username/summary')
  @ApiOkResponse({ type: LibraryStatsDto })
  @ApiNotFoundResponse({ description: 'User not found' })
  async publicSummary(
    @Param() params: UsernameParamDto,
  ): Promise<LibraryStatsDto> {
    const userId = await this.socialService.findUserIdByUsername(
      params.username,
    );
    return this.libraryService.getStats(userId);
  }

  @Post(':username/follow')
  @ApiCreatedResponse({ type: FollowStatusDto })
  @ApiBadRequestResponse({ description: 'You cannot follow yourself' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiConflictResponse({ description: 'You already follow this user' })
  follow(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: UsernameParamDto,
  ): Promise<FollowStatusDto> {
    return this.socialService.follow(user.id, params.username);
  }

  @Delete(':username/follow')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiBadRequestResponse({ description: 'You cannot follow yourself' })
  @ApiNotFoundResponse({ description: 'User not found' })
  unfollow(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: UsernameParamDto,
  ): Promise<void> {
    return this.socialService.unfollow(user.id, params.username);
  }
}
