import { ConflictException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { User } from '../generated/prisma/client.js';
import { UsersService } from '../users/users.service.js';
import { AuthService, type GoogleCallbackParams } from './auth.service.js';
import {
  GoogleOAuthClient,
  type GoogleProfile,
} from './google/google-oauth.client.js';
import { GoogleSignInError } from './google/google-sign-in.error.js';

const validCallback: GoogleCallbackParams = {
  code: 'authorization-code',
  state: 'state-from-google',
  expectedState: 'state-from-google',
  codeVerifier: 'pkce-verifier',
};

const googleProfile: GoogleProfile = {
  googleId: '1234567890',
  email: 'lucas@gmail.com',
  emailVerified: true,
  displayName: 'Lucas Fernandes',
  avatarUrl: null,
};

const user: User = {
  id: '0192f5a0-0000-7000-8000-000000000001',
  googleId: googleProfile.googleId,
  email: googleProfile.email,
  username: 'lucas_fernandes',
  displayName: googleProfile.displayName,
  avatarUrl: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('AuthService', () => {
  let authService: AuthService;
  const usersService = { findOrCreateFromGoogle: vi.fn(), findById: vi.fn() };
  const jwtService = { signAsync: vi.fn() };
  const googleOAuthClient = { fetchProfile: vi.fn() };

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jwtService.signAsync.mockResolvedValue('signed-token');

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        { provide: GoogleOAuthClient, useValue: googleOAuthClient },
      ],
    }).compile();

    authService = moduleRef.get(AuthService);
  });

  async function expectFailure(params: GoogleCallbackParams, reason: string) {
    const error: unknown = await authService
      .completeGoogleSignIn(params)
      .catch((rejection: unknown) => rejection);

    expect(error).toBeInstanceOf(GoogleSignInError);
    expect((error as GoogleSignInError).reason).toBe(reason);
  }

  describe('completeGoogleSignIn', () => {
    it('creates a session for the Google account', async () => {
      googleOAuthClient.fetchProfile.mockResolvedValue(googleProfile);
      usersService.findOrCreateFromGoogle.mockResolvedValue(user);

      const session = await authService.completeGoogleSignIn(validCallback);

      expect(googleOAuthClient.fetchProfile).toHaveBeenCalledWith(
        'authorization-code',
        'pkce-verifier',
      );
      expect(jwtService.signAsync).toHaveBeenCalledWith({ sub: user.id });
      expect(session).toEqual({ user, accessToken: 'signed-token' });
    });

    it.each<[string, GoogleCallbackParams]>([
      ['a mismatched state', { ...validCallback, state: 'forged-state' }],
      ['no sign-in cookie', { ...validCallback, expectedState: undefined }],
      ['no PKCE verifier', { ...validCallback, codeVerifier: undefined }],
      ['no authorization code', { ...validCallback, code: undefined }],
    ])('rejects %s without contacting Google', async (_description, params) => {
      await expectFailure(params, 'invalid_state');
      expect(googleOAuthClient.fetchProfile).not.toHaveBeenCalled();
    });

    it('reports a cancelled consent screen', async () => {
      await expectFailure(
        { ...validCallback, providerError: 'access_denied' },
        'cancelled',
      );
    });

    it('reports codes or tokens rejected by Google', async () => {
      googleOAuthClient.fetchProfile.mockRejectedValue(
        new Error('invalid_grant'),
      );

      await expectFailure(validCallback, 'google_rejected');
    });

    it('refuses accounts whose email is not verified', async () => {
      googleOAuthClient.fetchProfile.mockResolvedValue({
        ...googleProfile,
        emailVerified: false,
      });

      await expectFailure(validCallback, 'email_not_verified');
      expect(usersService.findOrCreateFromGoogle).not.toHaveBeenCalled();
    });

    it('reports an email already linked to another Google account', async () => {
      googleOAuthClient.fetchProfile.mockResolvedValue(googleProfile);
      usersService.findOrCreateFromGoogle.mockRejectedValue(
        new ConflictException(),
      );

      await expectFailure(validCallback, 'account_conflict');
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });
  });
});
