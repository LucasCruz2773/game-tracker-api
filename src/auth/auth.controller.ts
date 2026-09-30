import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiCookieAuth,
  ApiFoundResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import {
  NodeEnvironment,
  type EnvironmentVariables,
} from '../config/environment.js';
import { UserResponseDto } from '../users/dto/user-response.dto.js';
import {
  GOOGLE_SIGN_IN_COOKIE_NAME,
  GOOGLE_SIGN_IN_TTL_MS,
  SESSION_COOKIE_NAME,
} from './auth.constants.js';
import { AuthService } from './auth.service.js';
import type { AuthenticatedUser } from './auth.types.js';
import { CurrentUser } from './current-user.decorator.js';
import { GoogleSignInError } from './google/google-sign-in.error.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

interface PendingGoogleSignIn {
  state: string;
  codeVerifier: string;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {}

  @Get('google')
  @UseGuards(ThrottlerGuard)
  @ApiOperation({ summary: 'Redirects the browser to the Google sign-in page' })
  @ApiFoundResponse({ description: 'Redirect to Google' })
  @ApiTooManyRequestsResponse()
  async startGoogleSignIn(@Res() response: Response): Promise<void> {
    const authorizationRequest = await this.authService.startGoogleSignIn();
    const pendingSignIn: PendingGoogleSignIn = {
      state: authorizationRequest.state,
      codeVerifier: authorizationRequest.codeVerifier,
    };

    response.cookie(GOOGLE_SIGN_IN_COOKIE_NAME, JSON.stringify(pendingSignIn), {
      ...this.baseCookieOptions(),
      maxAge: GOOGLE_SIGN_IN_TTL_MS,
    });
    response.redirect(authorizationRequest.url);
  }

  @Get('google/callback')
  @UseGuards(ThrottlerGuard)
  @ApiOperation({
    summary: 'Google redirects here; starts the session and returns to the app',
  })
  @ApiFoundResponse({
    description:
      'Redirect to the frontend, or to /login?error=<reason> on failure',
  })
  @ApiTooManyRequestsResponse()
  async completeGoogleSignIn(
    @Query('code') code: unknown,
    @Query('state') state: unknown,
    @Query('error') providerError: unknown,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const pendingSignIn = parsePendingSignIn(
      request.cookies?.[GOOGLE_SIGN_IN_COOKIE_NAME],
    );
    response.clearCookie(GOOGLE_SIGN_IN_COOKIE_NAME, this.baseCookieOptions());

    try {
      const session = await this.authService.completeGoogleSignIn({
        code: asString(code),
        state: asString(state),
        providerError: asString(providerError),
        expectedState: pendingSignIn?.state,
        codeVerifier: pendingSignIn?.codeVerifier,
      });

      response.cookie(SESSION_COOKIE_NAME, session.accessToken, {
        ...this.baseCookieOptions(),
        maxAge:
          this.configService.get('JWT_EXPIRES_IN_SECONDS', { infer: true }) *
          1000,
      });
      response.redirect(this.frontendUrl('/'));
    } catch (error) {
      if (!(error instanceof GoogleSignInError)) {
        this.logger.error(
          'Unexpected error during Google sign-in',
          error instanceof Error ? error.stack : String(error),
        );
      }

      const reason =
        error instanceof GoogleSignInError ? error.reason : 'unexpected_error';
      response.redirect(this.frontendUrl('/login', { error: reason }));
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  logout(@Res({ passthrough: true }) response: Response): void {
    response.clearCookie(SESSION_COOKIE_NAME, this.baseCookieOptions());
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOkResponse({ type: UserResponseDto })
  @ApiUnauthorizedResponse()
  async me(@CurrentUser() user: AuthenticatedUser): Promise<UserResponseDto> {
    return UserResponseDto.fromEntity(
      await this.authService.getCurrentUser(user.id),
    );
  }

  private frontendUrl(
    path: string,
    searchParams: Record<string, string> = {},
  ): string {
    const url = new URL(
      path,
      this.configService.get('FRONTEND_URL', { infer: true }),
    );

    for (const [name, value] of Object.entries(searchParams)) {
      url.searchParams.set(name, value);
    }

    return url.toString();
  }

  private baseCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      // Lax (not Strict) so the cookies are sent on the top-level redirect back from Google.
      sameSite: 'lax',
      secure:
        this.configService.get('NODE_ENV', { infer: true }) ===
        NodeEnvironment.Production,
      path: '/',
    };
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function parsePendingSignIn(cookieValue: unknown): PendingGoogleSignIn | null {
  if (typeof cookieValue !== 'string') {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(cookieValue);

    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'state' in parsed &&
      'codeVerifier' in parsed &&
      typeof parsed.state === 'string' &&
      typeof parsed.codeVerifier === 'string'
    ) {
      return { state: parsed.state, codeVerifier: parsed.codeVerifier };
    }
  } catch {
    // Malformed cookie: treated the same as a missing one.
  }

  return null;
}
