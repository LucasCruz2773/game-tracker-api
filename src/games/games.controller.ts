import {
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';
import {
  GameDetailsDto,
  GameSearchResponseDto,
} from './dto/game-response.dto.js';
import { SearchGamesQueryDto } from './dto/search-games-query.dto.js';
import { GamesService } from './games.service.js';

@ApiTags('Games')
@Controller('games')
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@ApiTooManyRequestsResponse()
export class GamesController {
  constructor(private readonly gamesService: GamesService) {}

  @Get()
  @ApiOkResponse({ type: GameSearchResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid search or pagination' })
  @ApiBadGatewayResponse({ description: 'Game catalog is unavailable' })
  search(@Query() query: SearchGamesQueryDto): Promise<GameSearchResponseDto> {
    return this.gamesService.search(query);
  }

  @Get(':id/cover')
  @Header('Cache-Control', 'public, max-age=86400')
  @ApiOkResponse({ description: 'Game cover image' })
  @ApiNotFoundResponse({ description: 'Game cover not found' })
  async cover(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() response: Response,
  ): Promise<void> {
    const cover = await this.gamesService.fetchCover(id);
    response.type(cover.contentType).send(cover.body);
  }

  @Get(':id')
  @ApiOkResponse({ type: GameDetailsDto })
  @ApiNotFoundResponse({ description: 'Game not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<GameDetailsDto> {
    return this.gamesService.findById(id);
  }
}
