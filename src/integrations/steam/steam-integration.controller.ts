import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import type { AuthenticatedUser } from '../../auth/auth.types.js';
import { CurrentUser } from '../../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import {
  NodeEnvironment,
  type EnvironmentVariables,
} from '../../config/environment.js';
import { ImportSteamGamesDto } from './dto/import-steam-games.dto.js';
import {
  SteamImportResultDto,
  SteamIntegrationStatusDto,
  SteamSyncResultDto,
} from './dto/steam-integration.dto.js';
import { SteamIntegrationService } from './steam-integration.service.js';

const STEAM_LINK_COOKIE = 'gametrack_steam_link';
const STEAM_LINK_TTL_MS = 10 * 60 * 1000;

@ApiTags('Steam integration')
@ApiCookieAuth()
@ApiUnauthorizedResponse()
@UseGuards(JwtAuthGuard)
@Controller('integrations/steam')
export class SteamIntegrationController {
  constructor(
    private readonly steamIntegrationService: SteamIntegrationService,
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {}

  @Get('connect')
  @UseGuards(ThrottlerGuard)
  connect(@Res() response: Response): void {
    const request = this.steamIntegrationService.createConnectRequest();
    response.cookie(STEAM_LINK_COOKIE, request.state, {
      ...this.cookieOptions(),
      maxAge: STEAM_LINK_TTL_MS,
    });
    response.redirect(request.url);
  }

  @Get('callback')
  @UseGuards(ThrottlerGuard)
  async callback(
    @CurrentUser() user: AuthenticatedUser,
    @Query() rawQuery: Record<string, string | string[]>,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const query = singleValueQuery(rawQuery);
    const expectedState = asString(request.cookies?.[STEAM_LINK_COOKIE]);
    response.clearCookie(STEAM_LINK_COOKIE, this.cookieOptions());

    try {
      await this.steamIntegrationService.completeConnection(
        user.id,
        query,
        expectedState,
      );
      response.redirect(this.frontendUrl('/integrations', 'connected'));
    } catch {
      response.redirect(this.frontendUrl('/integrations', 'connection_failed'));
    }
  }

  @Get()
  @ApiOkResponse({ type: SteamIntegrationStatusDto })
  status(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SteamIntegrationStatusDto> {
    return this.steamIntegrationService.getStatus(user.id);
  }

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: SteamSyncResultDto })
  sync(@CurrentUser() user: AuthenticatedUser): Promise<SteamSyncResultDto> {
    return this.steamIntegrationService.sync(user.id);
  }

  @Post('import')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: SteamImportResultDto })
  importGames(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: ImportSteamGamesDto,
  ): Promise<SteamImportResultDto> {
    return this.steamIntegrationService.importGames(user.id, input);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  disconnect(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.steamIntegrationService.disconnect(user.id);
  }

  private frontendUrl(path: string, steamResult: string): string {
    const url = new URL(
      path,
      this.configService.get('FRONTEND_URL', { infer: true }),
    );
    url.searchParams.set('steam', steamResult);
    return url.toString();
  }

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure:
        this.configService.get('NODE_ENV', { infer: true }) ===
        NodeEnvironment.Production,
      path: '/',
    };
  }
}

function singleValueQuery(
  query: Record<string, string | string[]>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(query).flatMap(([name, value]) =>
      typeof value === 'string' ? [[name, value]] : [],
    ),
  );
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
