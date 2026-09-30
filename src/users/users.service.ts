import { ConflictException, Injectable } from '@nestjs/common';
import type { GoogleProfile } from '../auth/google/google-oauth.client.js';
import { PrismaService } from '../database/prisma.service.js';
import { Prisma, type User } from '../generated/prisma/client.js';
import { toUsernameBase, withRandomSuffix } from './username.js';

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';
const USERNAME_ATTEMPTS = 5;
const CREATE_ATTEMPTS = 3;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  /**
   * Returns the user linked to the Google account, creating it on first sign-in.
   * Profile data is refreshed on every sign-in so it follows changes made in Google.
   */
  async findOrCreateFromGoogle(profile: GoogleProfile): Promise<User> {
    const profileData = {
      email: profile.email.toLowerCase(),
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
    };

    const existingUser = await this.prisma.user.findUnique({
      where: { googleId: profile.googleId },
    });

    if (existingUser) {
      return this.prisma.user.update({
        where: { id: existingUser.id },
        data: profileData,
      });
    }

    const emailOwner = await this.prisma.user.findUnique({
      where: { email: profileData.email },
      select: { id: true },
    });

    if (emailOwner) {
      throw new ConflictException(
        'Email is already linked to another Google account',
      );
    }

    // Retries cover concurrent sign-ups that grab the same username first.
    for (let attempt = 1; attempt <= CREATE_ATTEMPTS; attempt++) {
      try {
        return await this.prisma.user.create({
          data: {
            ...profileData,
            googleId: profile.googleId,
            username: await this.findAvailableUsername(profile.displayName),
          },
        });
      } catch (error) {
        const isUniqueViolation =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === UNIQUE_CONSTRAINT_VIOLATION;

        if (!isUniqueViolation || attempt === CREATE_ATTEMPTS) {
          throw error;
        }
      }
    }

    throw new Error('Unreachable: user creation attempts exhausted');
  }

  private async findAvailableUsername(
    displayName: string | null,
  ): Promise<string> {
    const base = toUsernameBase(displayName);
    const candidates = [
      base,
      ...Array.from({ length: USERNAME_ATTEMPTS }, () =>
        withRandomSuffix(base),
      ),
    ];

    for (const candidate of candidates) {
      const taken = await this.prisma.user.findUnique({
        where: { username: candidate },
        select: { id: true },
      });

      if (!taken) {
        return candidate;
      }
    }

    throw new Error(`Could not find an available username for "${base}"`);
  }
}
