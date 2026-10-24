import { SteamOpenIdClient } from './steam-openid.client.js';

describe('SteamOpenIdClient', () => {
  const client = new SteamOpenIdClient();

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds an OpenID request tied to the callback and realm', () => {
    const url = new URL(
      client.createAuthenticationUrl(
        'https://example.com/api/integrations/steam/callback?state=abc',
        'https://example.com',
      ),
    );

    expect(url.origin + url.pathname).toBe(
      'https://steamcommunity.com/openid/login',
    );
    expect(url.searchParams.get('openid.mode')).toBe('checkid_setup');
    expect(url.searchParams.get('openid.realm')).toBe('https://example.com');
    expect(url.searchParams.get('openid.return_to')).toContain('state=abc');
  });

  it('verifies the signed response and extracts the SteamID', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response('ns:http://specs.openid.net/auth/2.0\nis_valid:true\n'),
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      client.verifyAuthentication({
        'openid.mode': 'id_res',
        'openid.claimed_id':
          'https://steamcommunity.com/openid/id/76561198000000000',
      }),
    ).resolves.toBe('76561198000000000');

    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(request.body).toBeInstanceOf(URLSearchParams);
    expect((request.body as URLSearchParams).get('openid.mode')).toBe(
      'check_authentication',
    );
  });
});
