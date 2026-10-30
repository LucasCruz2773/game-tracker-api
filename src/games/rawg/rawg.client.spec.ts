import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../../config/environment.js';
import { CatalogUnavailableException, RawgClient } from './rawg.client.js';

const API_KEY = 'secret-rawg-key';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('RawgClient', () => {
  let rawgClient: RawgClient;
  let fetchMock: ReturnType<typeof vi.fn>;
  let loggedErrors: string[];

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    loggedErrors = [];
    vi.spyOn(Logger.prototype, 'error').mockImplementation(
      (message: unknown) => {
        loggedErrors.push(String(message));
      },
    );

    rawgClient = createClient('https://api.rawg.io/api');
  });

  function createClient(baseUrl: string): RawgClient {
    const settings: Partial<EnvironmentVariables> = {
      RAWG_API_KEY: API_KEY,
      RAWG_BASE_URL: baseUrl,
    };
    const configService = {
      get: (name: keyof EnvironmentVariables) => settings[name],
    } as unknown as ConfigService<EnvironmentVariables, true>;
    return new RawgClient(configService);
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('sends the API key and search parameters', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ count: 0, results: [] }));

    await rawgClient.searchGames({
      search: 'celeste',
      ordering: '-rating',
      page: 2,
      pageSize: 10,
    });

    const requestedUrl = fetchMock.mock.calls[0][0] as URL;
    expect(requestedUrl.pathname).toBe('/api/games');
    expect(Object.fromEntries(requestedUrl.searchParams)).toEqual({
      key: API_KEY,
      exclude_additions: 'true',
      search: 'celeste',
      ordering: '-rating',
      page: '2',
      page_size: '10',
    });
  });

  it('can be pointed at another catalog server', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ count: 0, results: [] }));

    await createClient('http://localhost:3200/').searchGames({
      page: 1,
      pageSize: 10,
    });

    const requestedUrl = fetchMock.mock.calls[0][0] as URL;
    expect(requestedUrl.origin).toBe('http://localhost:3200');
    expect(requestedUrl.pathname).toBe('/games');
  });

  it('uses RAWG discovery list for the unfiltered exploration page', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ count: 0, results: [] }));

    await rawgClient.searchGames({
      discover: true,
      ordering: '-relevance',
      page: 1,
      pageSize: 20,
    });

    const requestedUrl = fetchMock.mock.calls[0][0] as URL;
    expect(requestedUrl.pathname).toBe('/api/games/lists/main');
    expect(Object.fromEntries(requestedUrl.searchParams)).toMatchObject({
      discover: 'true',
      ordering: '-relevance',
    });
    expect(requestedUrl.searchParams.has('exclude_additions')).toBe(false);
  });

  it('uses the documented games endpoint for genre filters', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ count: 0, results: [] }));

    await rawgClient.searchGames({
      genre: 'role-playing-games-rpg',
      page: 1,
      pageSize: 20,
    });

    const requestedUrl = fetchMock.mock.calls[0][0] as URL;
    expect(requestedUrl.pathname).toBe('/api/games');
    expect(Object.fromEntries(requestedUrl.searchParams)).toMatchObject({
      genres: 'role-playing-games-rpg',
      exclude_additions: 'true',
    });
  });

  it('removes duplicate game ids returned by RAWG', async () => {
    const game = {
      id: 1,
      slug: 'celeste',
      name: 'Celeste',
      released: '2018-01-25',
      background_image: null,
      genres: [],
      platforms: [],
    };
    fetchMock.mockResolvedValue(
      jsonResponse({ count: 2, results: [game, game] }),
    );

    const result = await rawgClient.searchGames({ page: 1, pageSize: 20 });

    expect(result.games).toHaveLength(1);
    expect(result.games[0]?.rawgId).toBe(1);
  });

  it('returns an empty page when RAWG answers 404 for a page out of range', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ detail: 'Invalid page.' }, 404));

    await expect(
      rawgClient.searchGames({ page: 999, pageSize: 20 }),
    ).resolves.toEqual({ total: 0, games: [] });
  });

  it('returns null for a game that does not exist in RAWG', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ detail: 'Not found.' }, 404));

    await expect(rawgClient.getGameDetails(999)).resolves.toBeNull();
  });

  it.each([
    ['a server error', () => Promise.resolve(jsonResponse({}, 503))],
    ['a network failure', () => Promise.reject(new Error('ECONNRESET'))],
    [
      'an unexpected payload',
      () => Promise.resolve(jsonResponse({ unexpected: true })),
    ],
  ])('reports the catalog as unavailable on %s', async (_case, respond) => {
    fetchMock.mockImplementation(respond);

    await expect(
      rawgClient.searchGames({ page: 1, pageSize: 20 }),
    ).rejects.toThrow(CatalogUnavailableException);
  });

  it('never writes the API key to the logs', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNRESET'));

    await expect(rawgClient.getGameDetails(1)).rejects.toThrow();

    expect(loggedErrors.length).toBeGreaterThan(0);
    expect(loggedErrors.join('\n')).not.toContain(API_KEY);
  });
});
