import type { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../../config/environment.js';
import { GoogleOAuthClient } from './google-oauth.client.js';

const config: Partial<EnvironmentVariables> = {
  GOOGLE_CLIENT_ID: 'client-id.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'client-secret',
  GOOGLE_CALLBACK_URL: 'http://localhost:3000/auth/google/callback',
};

describe('GoogleOAuthClient', () => {
  const googleOAuthClient = new GoogleOAuthClient({
    get: (key: keyof EnvironmentVariables) => config[key],
  } as unknown as ConfigService<EnvironmentVariables, true>);

  it('builds an authorization URL protected by state and PKCE', async () => {
    const request = await googleOAuthClient.createAuthorizationRequest();
    const url = new URL(request.url);

    expect(url.origin).toBe('https://accounts.google.com');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: config.GOOGLE_CLIENT_ID,
      redirect_uri: config.GOOGLE_CALLBACK_URL,
      response_type: 'code',
      scope: 'openid email profile',
      state: request.state,
      code_challenge_method: 'S256',
    });
    expect(url.searchParams.get('code_challenge')).toBeTruthy();
    expect(url.searchParams.get('code_challenge')).not.toBe(
      request.codeVerifier,
    );
    expect(url.searchParams.has('client_secret')).toBe(false);
  });

  it('generates a new state and verifier for every sign-in', async () => {
    const first = await googleOAuthClient.createAuthorizationRequest();
    const second = await googleOAuthClient.createAuthorizationRequest();

    expect(first.state).not.toBe(second.state);
    expect(first.codeVerifier).not.toBe(second.codeVerifier);
    expect(first.state.length).toBeGreaterThanOrEqual(43);
  });
});
