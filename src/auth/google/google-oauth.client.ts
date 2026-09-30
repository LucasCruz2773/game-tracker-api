import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CodeChallengeMethod, OAuth2Client } from 'google-auth-library';
import { randomBytes } from 'node:crypto';
import type { EnvironmentVariables } from '../../config/environment.js';

export interface GoogleAuthorizationRequest {
  url: string;
  state: string;
  codeVerifier: string;
}

export interface GoogleProfile {
  googleId: string;
  email: string;
  emailVerified: boolean;
  displayName: string | null;
  avatarUrl: string | null;
}

const GOOGLE_SCOPES = ['openid', 'email', 'profile'];

@Injectable()
export class GoogleOAuthClient {
  private readonly clientId: string;
  private readonly oauthClient: OAuth2Client;

  constructor(configService: ConfigService<EnvironmentVariables, true>) {
    this.clientId = configService.get('GOOGLE_CLIENT_ID', { infer: true });
    this.oauthClient = new OAuth2Client({
      clientId: this.clientId,
      clientSecret: configService.get('GOOGLE_CLIENT_SECRET', { infer: true }),
      redirectUri: configService.get('GOOGLE_CALLBACK_URL', { infer: true }),
    });
  }

  async createAuthorizationRequest(): Promise<GoogleAuthorizationRequest> {
    const state = randomBytes(32).toString('base64url');
    const { codeVerifier, codeChallenge } =
      await this.oauthClient.generateCodeVerifierAsync();

    const url = this.oauthClient.generateAuthUrl({
      scope: GOOGLE_SCOPES,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: CodeChallengeMethod.S256,
      prompt: 'select_account',
    });

    return { url, state, codeVerifier };
  }

  /** Exchanges the authorization code and returns the profile from the verified ID token. */
  async fetchProfile(
    code: string,
    codeVerifier: string,
  ): Promise<GoogleProfile> {
    const { tokens } = await this.oauthClient.getToken({ code, codeVerifier });

    if (!tokens.id_token) {
      throw new Error('Google did not return an ID token');
    }

    const ticket = await this.oauthClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: this.clientId,
    });
    const payload = ticket.getPayload();

    if (!payload?.sub || !payload.email) {
      throw new Error('Google ID token is missing the sub or email claim');
    }

    return {
      googleId: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified === true,
      displayName: payload.name ?? null,
      avatarUrl: payload.picture ?? null,
    };
  }
}
