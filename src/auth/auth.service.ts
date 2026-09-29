import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import type { User } from '../generated/prisma/client.js';
import { UsersService } from '../users/users.service.js';
import type { SessionTokenPayload } from './auth.types.js';
import type { LoginDto } from './dto/login.dto.js';
import type { RegisterDto } from './dto/register.dto.js';

export interface AuthSession {
  user: User;
  accessToken: string;
}

@Injectable()
export class AuthService {
  private dummyPasswordHash?: Promise<string>;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthSession> {
    const passwordHash = await argon2.hash(registerDto.password);
    const user = await this.usersService.create({
      email: registerDto.email,
      username: registerDto.username,
      passwordHash,
    });

    return this.createSession(user);
  }

  async login(loginDto: LoginDto): Promise<AuthSession> {
    const user = await this.usersService.findByEmail(loginDto.email);

    // Verify against a dummy hash for unknown emails so response time
    // doesn't reveal which emails are registered.
    const passwordHash =
      user?.passwordHash ?? (await this.getDummyPasswordHash());
    const isPasswordValid = await argon2.verify(
      passwordHash,
      loginDto.password,
    );

    if (!user || !isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.createSession(user);
  }

  async getCurrentUser(userId: string): Promise<User> {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new UnauthorizedException();
    }

    return user;
  }

  private async createSession(user: User): Promise<AuthSession> {
    const payload: SessionTokenPayload = { sub: user.id };
    const accessToken = await this.jwtService.signAsync(payload);

    return { user, accessToken };
  }

  private getDummyPasswordHash(): Promise<string> {
    this.dummyPasswordHash ??= argon2.hash('dummy-password-for-timing');
    return this.dummyPasswordHash;
  }
}
