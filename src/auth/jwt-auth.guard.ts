import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { isUUID } from 'class-validator';
import type { Request } from 'express';
import { SESSION_COOKIE_NAME } from './auth.constants.js';
import type {
  AuthenticatedRequest,
  SessionTokenPayload,
} from './auth.types.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token: unknown = request.cookies?.[SESSION_COOKIE_NAME];

    if (typeof token !== 'string' || token.length === 0) {
      throw new UnauthorizedException();
    }

    let payload: Partial<SessionTokenPayload>;
    try {
      payload = await this.jwtService.verifyAsync<SessionTokenPayload>(token);
    } catch {
      throw new UnauthorizedException();
    }

    if (typeof payload.sub !== 'string' || !isUUID(payload.sub)) {
      throw new UnauthorizedException();
    }

    (request as AuthenticatedRequest).user = { id: payload.sub };
    return true;
  }
}
