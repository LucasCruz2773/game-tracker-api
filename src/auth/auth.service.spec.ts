import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import type { User } from '../generated/prisma/client.js';
import { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';

describe('AuthService', () => {
  let authService: AuthService;
  const usersService = {
    create: vi.fn(),
    findByEmail: vi.fn(),
    findById: vi.fn(),
  };
  const jwtService = { signAsync: vi.fn() };

  async function buildUser(password: string): Promise<User> {
    return {
      id: '0192f5a0-0000-7000-8000-000000000001',
      email: 'player@gametrack.dev',
      username: 'player_one',
      passwordHash: await argon2.hash(password),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  beforeEach(async () => {
    vi.resetAllMocks();
    jwtService.signAsync.mockResolvedValue('signed-token');

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    authService = moduleRef.get(AuthService);
  });

  describe('register', () => {
    it('stores an argon2id hash instead of the plain password', async () => {
      usersService.create.mockImplementation(
        async (input: { passwordHash: string }) => ({
          ...(await buildUser('irrelevant')),
          passwordHash: input.passwordHash,
        }),
      );

      const session = await authService.register({
        email: 'player@gametrack.dev',
        username: 'player_one',
        password: 'correct-horse-battery',
      });

      const [{ passwordHash }] = usersService.create.mock.calls[0] as [
        { passwordHash: string },
      ];
      expect(passwordHash).not.toContain('correct-horse-battery');
      expect(passwordHash).toMatch(/^\$argon2id\$/);
      await expect(
        argon2.verify(passwordHash, 'correct-horse-battery'),
      ).resolves.toBe(true);
      expect(session.accessToken).toBe('signed-token');
    });

    it('propagates conflicts from the users service', async () => {
      usersService.create.mockRejectedValue(
        new ConflictException('Email is already in use'),
      );

      await expect(
        authService.register({
          email: 'player@gametrack.dev',
          username: 'player_one',
          password: 'correct-horse-battery',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('returns a session signed with the user id for valid credentials', async () => {
      const user = await buildUser('correct-horse-battery');
      usersService.findByEmail.mockResolvedValue(user);

      const session = await authService.login({
        email: user.email,
        password: 'correct-horse-battery',
      });

      expect(session.user).toBe(user);
      expect(jwtService.signAsync).toHaveBeenCalledWith({ sub: user.id });
    });

    it('rejects a wrong password', async () => {
      usersService.findByEmail.mockResolvedValue(
        await buildUser('correct-horse-battery'),
      );

      await expect(
        authService.login({
          email: 'player@gametrack.dev',
          password: 'wrong-password',
        }),
      ).rejects.toThrow(UnauthorizedException);
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });

    it('rejects an unknown email with the same error', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        authService.login({
          email: 'nobody@gametrack.dev',
          password: 'whatever-password',
        }),
      ).rejects.toThrow('Invalid email or password');
    });
  });

  describe('getCurrentUser', () => {
    it('rejects a session whose user no longer exists', async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(authService.getCurrentUser('missing-id')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
