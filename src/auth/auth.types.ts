import type { Request } from 'express';

export interface SessionTokenPayload {
  sub: string;
}

export interface AuthenticatedUser {
  id: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
