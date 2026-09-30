import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types.js';
import {
  GoogleOAuthClient,
  type GoogleProfile,
} from '../src/auth/google/google-oauth.client.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { createTestApp, resetDatabase } from './support/test-app.js';

const FRONTEND_URL = 'http://localhost:5173';
const GOOGLE_STATE = 'state-issued-by-api';
const PKCE_VERIFIER = 'pkce-verifier';

const googleProfile: GoogleProfile = {
  googleId: '109876543210',
  email: 'Lucas.Fernandes@gmail.com',
  emailVerified: true,
  displayName: 'Lucas Fernandes',
  avatarUrl: 'https://lh3.googleusercontent.com/a/avatar',
};

function createFakeGoogleOAuthClient() {
  return {
    createAuthorizationRequest: vi.fn().mockResolvedValue({
      url: `https://accounts.google.com/o/oauth2/v2/auth?state=${GOOGLE_STATE}`,
      state: GOOGLE_STATE,
      codeVerifier: PKCE_VERIFIER,
    }),
    fetchProfile: vi.fn().mockResolvedValue(googleProfile),
  };
}

function getCookie(
  response: request.Response,
  name: string,
): string | undefined {
  const setCookieHeader = response.headers['set-cookie'] as unknown as
    string[] | undefined;
  return setCookieHeader?.find((cookie) => cookie.startsWith(`${name}=`));
}

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const googleOAuthClient = createFakeGoogleOAuthClient();

  beforeAll(async () => {
    app = await createTestApp({
      providerOverrides: [
        { provide: GoogleOAuthClient, useValue: googleOAuthClient },
      ],
    });
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    googleOAuthClient.fetchProfile.mockResolvedValue(googleProfile);
    await resetDatabase(app);
  });

  afterAll(async () => {
    await app.close();
  });

  /** Runs the redirect to Google and the callback with the same browser cookies. */
  async function signInWithGoogle(
    callbackQuery: Record<string, string> = {
      code: 'authorization-code',
      state: GOOGLE_STATE,
    },
  ) {
    const agent = request.agent(app.getHttpServer());
    await agent.get('/auth/google').expect(302);
    const callbackResponse = await agent
      .get('/auth/google/callback')
      .query(callbackQuery)
      .expect(302);

    return { agent, callbackResponse };
  }

  describe('GET /auth/google', () => {
    it('redirects to Google and remembers the sign-in attempt in an HttpOnly cookie', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/google')
        .expect(302);

      expect(response.headers['location']).toContain(
        'https://accounts.google.com/',
      );
      expect(getCookie(response, 'gametrack_google_sign_in')).toContain(
        'HttpOnly',
      );
    });
  });

  describe('GET /auth/google/callback', () => {
    it('creates the account on first sign-in and returns to the app with a session', async () => {
      const { agent, callbackResponse } = await signInWithGoogle();

      expect(callbackResponse.headers['location']).toBe(`${FRONTEND_URL}/`);
      expect(getCookie(callbackResponse, 'gametrack_session')).toContain(
        'HttpOnly',
      );
      expect(googleOAuthClient.fetchProfile).toHaveBeenCalledWith(
        'authorization-code',
        PKCE_VERIFIER,
      );

      const me = await agent.get('/auth/me').expect(200);
      expect(me.body).toEqual({
        id: expect.any(String),
        email: 'lucas.fernandes@gmail.com',
        username: 'lucas_fernandes',
        displayName: 'Lucas Fernandes',
        avatarUrl: 'https://lh3.googleusercontent.com/a/avatar',
        createdAt: expect.any(String),
      });
    });

    it('signs an existing account back in and refreshes its profile', async () => {
      const first = await signInWithGoogle();
      const firstUser = await first.agent.get('/auth/me').expect(200);

      googleOAuthClient.fetchProfile.mockResolvedValue({
        ...googleProfile,
        displayName: 'Lucas F.',
      });
      const second = await signInWithGoogle();
      const secondUser = await second.agent.get('/auth/me').expect(200);

      expect(secondUser.body).toMatchObject({
        id: firstUser.body.id,
        username: 'lucas_fernandes',
        displayName: 'Lucas F.',
      });
      await expect(prisma.user.count()).resolves.toBe(1);
    });

    it('picks another username when the generated one is taken', async () => {
      await prisma.user.create({
        data: {
          googleId: 'someone-else',
          email: 'other@gmail.com',
          username: 'lucas_fernandes',
        },
      });

      const { agent } = await signInWithGoogle();

      const me = await agent.get('/auth/me').expect(200);
      expect(me.body.username).toMatch(/^lucas_fernandes_\d{4}$/);
    });

    it('rejects a callback whose state does not match the sign-in attempt', async () => {
      const { agent, callbackResponse } = await signInWithGoogle({
        code: 'authorization-code',
        state: 'forged-state',
      });

      expect(callbackResponse.headers['location']).toBe(
        `${FRONTEND_URL}/login?error=invalid_state`,
      );
      expect(getCookie(callbackResponse, 'gametrack_session')).toBeUndefined();
      expect(googleOAuthClient.fetchProfile).not.toHaveBeenCalled();
      await agent.get('/auth/me').expect(401);
    });

    it('rejects a callback that was not started by this browser', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/google/callback')
        .query({ code: 'authorization-code', state: GOOGLE_STATE })
        .expect(302);

      expect(response.headers['location']).toBe(
        `${FRONTEND_URL}/login?error=invalid_state`,
      );
    });

    it('does not create accounts for unverified Google emails', async () => {
      googleOAuthClient.fetchProfile.mockResolvedValue({
        ...googleProfile,
        emailVerified: false,
      });

      const { callbackResponse } = await signInWithGoogle();

      expect(callbackResponse.headers['location']).toBe(
        `${FRONTEND_URL}/login?error=email_not_verified`,
      );
      await expect(prisma.user.count()).resolves.toBe(0);
    });

    it('returns to the login page when the user cancels on Google', async () => {
      const { callbackResponse } = await signInWithGoogle({
        error: 'access_denied',
        state: GOOGLE_STATE,
      });

      expect(callbackResponse.headers['location']).toBe(
        `${FRONTEND_URL}/login?error=cancelled`,
      );
    });
  });

  describe('GET /auth/me', () => {
    it('rejects requests without a session cookie', () => {
      return request(app.getHttpServer()).get('/auth/me').expect(401);
    });

    it('rejects a tampered session token', () => {
      return request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', 'gametrack_session=eyJhbGciOiJIUzI1NiJ9.e30.invalid')
        .expect(401);
    });

    it.each([
      ['without a subject', {}],
      ['with a malformed subject', { sub: 'not-a-uuid' }],
    ])('rejects a signed session token %s', async (_case, payload) => {
      const token = await app.get(JwtService).signAsync(payload);

      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', `gametrack_session=${token}`)
        .expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('clears the session cookie', async () => {
      const { agent } = await signInWithGoogle();
      await agent.get('/auth/me').expect(200);

      await agent.post('/auth/logout').expect(204);

      await agent.get('/auth/me').expect(401);
    });
  });
});

describe('Auth rate limiting (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp({
      enableThrottling: true,
      providerOverrides: [
        {
          provide: GoogleOAuthClient,
          useValue: createFakeGoogleOAuthClient(),
        },
      ],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('blocks repeated sign-in attempts from the same client', async () => {
    for (let attemptNumber = 1; attemptNumber <= 10; attemptNumber++) {
      await request(app.getHttpServer()).get('/auth/google').expect(302);
    }

    await request(app.getHttpServer()).get('/auth/google').expect(429);
  });
});
