import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import type { GoogleProfile } from '../auth/google/google-oauth.client.js';
import { PrismaService } from '../database/prisma.service.js';
import { Prisma, type User } from '../generated/prisma/client.js';
import type { UpdateUserProfileDto } from './dto/update-user-profile.dto.js';
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

  async updateProfile(
    userId: string,
    changes: UpdateUserProfileDto,
  ): Promise<User> {
    if (changes.username === undefined && changes.avatarUrl === undefined) {
      throw new BadRequestException('Provide at least one profile field');
    }

    try {
      return await this.prisma.user.update({
        where: { id: userId },
        data: {
          ...(changes.username !== undefined && {
            username: changes.username,
          }),
          ...(changes.avatarUrl !== undefined && {
            avatarUrl: changes.avatarUrl,
          }),
          profileCustomized: true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_CONSTRAINT_VIOLATION
      ) {
        throw new ConflictException('Username is already in use');
      }
      throw error;
    }
  }

  /**
   * Returns the user linked to the Google account, creating it on first sign-in.
   * Google profile data stays in sync until the user customizes their local profile.
   */
  async findOrCreateFromGoogle(profile: GoogleProfile): Promise<User> {
    const googleProfileData = {
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
        data: existingUser.profileCustomized
          ? {
              email: googleProfileData.email,
              displayName: googleProfileData.displayName,
            }
          : googleProfileData,
      });
    }

    const emailOwner = await this.prisma.user.findUnique({
      where: { email: googleProfileData.email },
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
            ...googleProfileData,
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
