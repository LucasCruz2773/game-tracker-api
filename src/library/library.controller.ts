import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
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
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AddToLibraryDto } from './dto/add-to-library.dto.js';
import {
  LibraryEntryDto,
  LibraryListResponseDto,
} from './dto/library-entry-response.dto.js';
import { ListLibraryQueryDto } from './dto/list-library-query.dto.js';
import { LibraryStatsDto } from './dto/library-stats.dto.js';
import { UpdateLibraryEntryDto } from './dto/update-library-entry.dto.js';
import { LibraryService } from './library.service.js';

@ApiTags('Library')
@ApiCookieAuth()
@ApiUnauthorizedResponse()
@UseGuards(JwtAuthGuard)
@Controller('library')
export class LibraryController {
  constructor(private readonly libraryService: LibraryService) {}

  @Get()
  @ApiOkResponse({ type: LibraryListResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid filters or pagination' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListLibraryQueryDto,
  ): Promise<LibraryListResponseDto> {
    return this.libraryService.list(user.id, query);
  }

  @Get('stats')
  @ApiOkResponse({ type: LibraryStatsDto })
  stats(@CurrentUser() user: AuthenticatedUser): Promise<LibraryStatsDto> {
    return this.libraryService.getStats(user.id);
  }

  @Get(':gameId')
  @ApiOkResponse({ type: LibraryEntryDto })
  @ApiNotFoundResponse({ description: 'Game is not in your library' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('gameId', ParseUUIDPipe) gameId: string,
  ): Promise<LibraryEntryDto> {
    return this.libraryService.findOne(user.id, gameId);
  }

  @Post()
  @ApiCreatedResponse({ type: LibraryEntryDto })
  @ApiBadRequestResponse({ description: 'Invalid data' })
  @ApiNotFoundResponse({ description: 'Game not found' })
  @ApiConflictResponse({ description: 'Game is already in your library' })
  @ApiUnprocessableEntityResponse({ description: 'Inconsistent dates' })
  add(
    @CurrentUser() user: AuthenticatedUser,
    @Body() addToLibraryDto: AddToLibraryDto,
  ): Promise<LibraryEntryDto> {
    return this.libraryService.add(user.id, addToLibraryDto);
  }

  @Patch(':gameId')
  @ApiOkResponse({ type: LibraryEntryDto })
  @ApiBadRequestResponse({ description: 'Invalid data' })
  @ApiNotFoundResponse({ description: 'Game is not in your library' })
  @ApiUnprocessableEntityResponse({ description: 'Inconsistent dates' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('gameId', ParseUUIDPipe) gameId: string,
    @Body() updateDto: UpdateLibraryEntryDto,
  ): Promise<LibraryEntryDto> {
    return this.libraryService.update(user.id, gameId, updateDto);
  }

  @Delete(':gameId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Game is not in your library' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('gameId', ParseUUIDPipe) gameId: string,
  ): Promise<void> {
    return this.libraryService.remove(user.id, gameId);
  }
}
