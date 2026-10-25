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
import { ListUsersQueryDto } from './dto/list-users-query.dto.js';
import {
  FollowStatusDto,
  SocialUserListResponseDto,
} from './dto/social-user-response.dto.js';
import { UsernameParamDto } from './dto/username-param.dto.js';
import { SocialService } from './social.service.js';

@ApiTags('Social')
@ApiCookieAuth()
@ApiUnauthorizedResponse()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class SocialController {
  constructor(private readonly socialService: SocialService) {}

  @Get()
  @ApiOkResponse({ type: SocialUserListResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid search or pagination' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListUsersQueryDto,
  ): Promise<SocialUserListResponseDto> {
    return this.socialService.listUsers(user.id, query);
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
