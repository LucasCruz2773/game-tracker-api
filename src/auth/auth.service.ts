import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { timingSafeEqual } from 'node:crypto';
import type { User } from '../generated/prisma/client.js';
import { UsersService } from '../users/users.service.js';
import type { UpdateUserProfileDto } from '../users/dto/update-user-profile.dto.js';
import type { SessionTokenPayload } from './auth.types.js';
import {
  GoogleOAuthClient,
  type GoogleAuthorizationRequest,
  type GoogleProfile,
} from './google/google-oauth.client.js';
import { GoogleSignInError } from './google/google-sign-in.error.js';

export interface AuthSession {
  user: User;
  accessToken: string;
}

export interface GoogleCallbackParams {
  code?: string;
  state?: string;
  /** Set by Google when the user denies consent, e.g. "access_denied". */
  providerError?: string;
  /** Values stored in the sign-in cookie when the flow started. */
  expectedState?: string;
  codeVerifier?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly googleOAuthClient: GoogleOAuthClient,
  ) {}

  startGoogleSignIn(): Promise<GoogleAuthorizationRequest> {
    return this.googleOAuthClient.createAuthorizationRequest();
  }

  async completeGoogleSignIn(
    params: GoogleCallbackParams,
  ): Promise<AuthSession> {
    const { code, state, providerError, expectedState, codeVerifier } = params;

    if (providerError) {
      throw new GoogleSignInError('cancelled');
    }

    if (
      !code ||
      !state ||
      !expectedState ||
      !codeVerifier ||
      !constantTimeEquals(state, expectedState)
    ) {
      throw new GoogleSignInError('invalid_state');
    }

    let profile: GoogleProfile;

    try {
      profile = await this.googleOAuthClient.fetchProfile(code, codeVerifier);
    } catch (error) {
      this.logger.warn(
        `Google rejected the sign-in: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new GoogleSignInError('google_rejected');
    }

    if (!profile.emailVerified) {
      throw new GoogleSignInError('email_not_verified');
    }

    try {
      const user = await this.usersService.findOrCreateFromGoogle(profile);
      return await this.createSession(user);
    } catch (error) {
      if (error instanceof ConflictException) {
        throw new GoogleSignInError('account_conflict');
      }
      throw error;
    }
  }

  async getCurrentUser(userId: string): Promise<User> {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new UnauthorizedException();
    }

    return user;
  }

  updateCurrentUser(
    userId: string,
    changes: UpdateUserProfileDto,
  ): Promise<User> {
    return this.usersService.updateProfile(userId, changes);
  }

  private async createSession(user: User): Promise<AuthSession> {
    const payload: SessionTokenPayload = { sub: user.id };
    const accessToken = await this.jwtService.signAsync(payload);

    return { user, accessToken };
  }
}

function constantTimeEquals(received: string, expected: string): boolean {
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);

  return (
    receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  );
}
