import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CreateReviewDto } from './dto/create-review.dto.js';
import { ListReviewsQueryDto } from './dto/list-reviews-query.dto.js';
import { ReviewDto, ReviewListResponseDto } from './dto/review-response.dto.js';
import { ReviewsService } from './reviews.service.js';

@ApiTags('Reviews')
@Controller('games/:gameId/reviews')
export class GameReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  @ApiOkResponse({ type: ReviewListResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid pagination' })
  @ApiNotFoundResponse({ description: 'Game not found' })
  list(
    @Param('gameId', ParseUUIDPipe) gameId: string,
    @Query() query: ListReviewsQueryDto,
  ): Promise<ReviewListResponseDto> {
    return this.reviewsService.listByGame(gameId, query);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiUnauthorizedResponse()
  @ApiOkResponse({ type: ReviewDto })
  @ApiNotFoundResponse({
    description: 'Game not found or you have not reviewed it yet',
  })
  findMine(
    @CurrentUser() user: AuthenticatedUser,
    @Param('gameId', ParseUUIDPipe) gameId: string,
  ): Promise<ReviewDto> {
    return this.reviewsService.findMine(user.id, gameId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiUnauthorizedResponse()
  @ApiCreatedResponse({ type: ReviewDto })
  @ApiBadRequestResponse({ description: 'Invalid rating or review text' })
  @ApiNotFoundResponse({ description: 'Game not found' })
  @ApiConflictResponse({ description: 'You have already reviewed this game' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('gameId', ParseUUIDPipe) gameId: string,
    @Body() createReviewDto: CreateReviewDto,
  ): Promise<ReviewDto> {
    return this.reviewsService.create(user.id, gameId, createReviewDto);
  }
}
