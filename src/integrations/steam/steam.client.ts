import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../../config/environment.js';

const STEAM_API_BASE_URL = 'https://api.steampowered.com';

export interface SteamProfile {
  steamId: string;
  personaName: string;
  avatarUrl: string | null;
}

export interface SteamOwnedGame {
  appId: number;
  name: string;
  playtimeMinutes: number;
}

interface PlayerSummariesResponse {
  response?: {
    players?: Array<{
      steamid?: unknown;
      personaname?: unknown;
      avatarfull?: unknown;
    }>;
  };
}

interface OwnedGamesResponse {
  response?: {
    game_count?: unknown;
    games?: Array<{
      appid?: unknown;
      name?: unknown;
      playtime_forever?: unknown;
    }>;
  };
}

@Injectable()
export class SteamClient {
  private readonly apiKey: string | undefined;

  constructor(configService: ConfigService<EnvironmentVariables, true>) {
    this.apiKey = configService.get('STEAM_WEB_API_KEY', { infer: true });
  }

  async getProfile(steamId: string): Promise<SteamProfile> {
    const body = await this.request<PlayerSummariesResponse>(
      '/ISteamUser/GetPlayerSummaries/v2/',
      { steamids: steamId },
    );
    const player = body.response?.players?.[0];

    if (player?.steamid !== steamId || typeof player.personaname !== 'string') {
      throw new BadGatewayException('Steam profile could not be loaded');
    }

    return {
      steamId,
      personaName: player.personaname,
      avatarUrl:
        typeof player.avatarfull === 'string' ? player.avatarfull : null,
    };
  }

  async getOwnedGames(steamId: string): Promise<SteamOwnedGame[]> {
    const body = await this.request<OwnedGamesResponse>(
      '/IPlayerService/GetOwnedGames/v1/',
      {
        steamid: steamId,
        include_appinfo: 'true',
        include_played_free_games: 'true',
      },
    );
    const library = body.response;

    if (!library || typeof library.game_count !== 'number') {
      throw new UnprocessableEntityException(
        'Your Steam game details must be public before syncing',
      );
    }

    return (library.games ?? [])
      .filter(
        (game) =>
          Number.isInteger(game.appid) &&
          typeof game.name === 'string' &&
          game.name.trim().length > 0 &&
          Number.isInteger(game.playtime_forever),
      )
      .map((game) => ({
        appId: game.appid as number,
        name: (game.name as string).trim(),
        playtimeMinutes: Math.max(0, game.playtime_forever as number),
      }));
  }

  private async request<T>(
    path: string,
    query: Record<string, string>,
  ): Promise<T> {
    if (!this.apiKey) {
      throw new ServiceUnavailableException(
        'Steam integration is not configured',
      );
    }

    const url = new URL(`${STEAM_API_BASE_URL}${path}`);
    url.searchParams.set('key', this.apiKey);
    url.searchParams.set('format', 'json');
    for (const [name, value] of Object.entries(query)) {
      url.searchParams.set(name, value);
    }

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8_000),
      });
    } catch {
      throw new BadGatewayException('Steam API is temporarily unavailable');
    }

    if (!response.ok) {
      throw new BadGatewayException('Steam API is temporarily unavailable');
    }

    try {
      return (await response.json()) as T;
    } catch {
      throw new BadGatewayException('Steam API returned an invalid response');
    }
  }
}
