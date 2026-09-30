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

    const configService = {
      get: () => API_KEY,
    } as unknown as ConfigService<EnvironmentVariables, true>;
    rawgClient = new RawgClient(configService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('sends the API key and search parameters', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ count: 0, results: [] }));

    await rawgClient.searchGames({ search: 'celeste', page: 2, pageSize: 10 });

    const requestedUrl = fetchMock.mock.calls[0][0] as URL;
    expect(requestedUrl.pathname).toBe('/api/games');
    expect(Object.fromEntries(requestedUrl.searchParams)).toEqual({
      key: API_KEY,
      search: 'celeste',
      page: '2',
      page_size: '10',
    });
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
