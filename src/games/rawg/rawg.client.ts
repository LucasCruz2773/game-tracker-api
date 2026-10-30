import {
  BadGatewayException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../../config/environment.js';
import type {
  CatalogGame,
  CatalogGameDetails,
  CatalogSearchResult,
} from '../catalog.types.js';
import { toCatalogGame, toCatalogGameDetails } from './rawg.mapper.js';
import type {
  RawgGame,
  RawgGameDetails,
  RawgPaginatedResponse,
} from './rawg.types.js';

const REQUEST_TIMEOUT_MS = 5_000;

export interface SearchCatalogParams {
  search?: string;
  ordering?: RawgGameOrdering;
  discover?: boolean;
  genre?: string;
  page: number;
  pageSize: number;
}

export type RawgGameOrdering =
  | '-relevance'
  | 'added'
  | '-added'
  | 'rating'
  | '-rating'
  | 'name'
  | '-name'
  | 'released'
  | '-released';

export class CatalogUnavailableException extends BadGatewayException {
  constructor() {
    super('Game catalog is temporarily unavailable');
  }
}

@Injectable()
export class RawgClient {
  private readonly logger = new Logger(RawgClient.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(configService: ConfigService<EnvironmentVariables, true>) {
    this.apiKey = configService.get('RAWG_API_KEY', { infer: true });
    this.baseUrl = configService
      .get('RAWG_BASE_URL', { infer: true })
      .replace(/\/+$/, '');
  }

  async searchGames(params: SearchCatalogParams): Promise<CatalogSearchResult> {
    const response = await this.request(
      params.discover ? '/games/lists/main' : '/games',
      {
        discover: params.discover ? 'true' : undefined,
        exclude_additions: params.discover ? undefined : 'true',
        genres: params.genre,
        search: params.search,
        ordering: params.ordering,
        page: String(params.page),
        page_size: String(params.pageSize),
      },
    );

    // RAWG answers 404 for pages beyond the last one.
    if (response.status === HttpStatus.NOT_FOUND) {
      return { total: 0, games: [] };
    }

    const body =
      await this.parseBody<RawgPaginatedResponse<RawgGame>>(response);

    if (!Array.isArray(body.results) || typeof body.count !== 'number') {
      this.logger.error('RAWG search returned an unexpected payload');
      throw new CatalogUnavailableException();
    }

    const gamesById = new Map<number, CatalogGame>();
    for (const rawgGame of body.results) {
      const game = toCatalogGame(rawgGame);
      if (game && !gamesById.has(game.rawgId)) {
        gamesById.set(game.rawgId, game);
      }
    }

    return {
      total: body.count,
      games: [...gamesById.values()],
    };
  }

  async getGameDetails(rawgId: number): Promise<CatalogGameDetails | null> {
    const response = await this.request(`/games/${rawgId}`);

    if (response.status === HttpStatus.NOT_FOUND) {
      return null;
    }

    return toCatalogGameDetails(
      await this.parseBody<RawgGameDetails>(response),
    );
  }

  private async request(
    path: string,
    query: Record<string, string | undefined> = {},
  ): Promise<Response> {
    const url = new URL(`${this.baseUrl}${path}`);
    url.searchParams.set('key', this.apiKey);

    for (const [name, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(name, value);
      }
    }

    let response: Response;

    try {
      response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      // Never log the URL: it contains the API key.
      this.logger.error(
        `RAWG request to ${path} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new CatalogUnavailableException();
    }

    if (!response.ok && response.status !== HttpStatus.NOT_FOUND) {
      this.logger.error(
        `RAWG request to ${path} failed with status ${response.status}`,
      );
      throw new CatalogUnavailableException();
    }

    return response;
  }

  private async parseBody<T>(response: Response): Promise<T> {
    try {
      return (await response.json()) as T;
    } catch {
      this.logger.error('RAWG returned a response that is not valid JSON');
      throw new CatalogUnavailableException();
    }
  }
}
