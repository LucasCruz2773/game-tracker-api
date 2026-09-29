import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { createTestApp, resetDatabase } from './support/test-app.js';

const validRegistration = {
  email: 'player@gametrack.dev',
  username: 'player_one',
  password: 'correct-horse-battery',
};

function getSessionCookie(response: request.Response): string | undefined {
  const setCookieHeader = response.headers['set-cookie'] as unknown as
    string[] | undefined;
  return setCookieHeader?.find((cookie) =>
    cookie.startsWith('gametrack_session='),
  );
}

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/register', () => {
    it('creates the user, starts a session and never exposes the password hash', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...validRegistration, email: '  Player@GameTrack.dev ' })
        .expect(201);

      expect(response.body).toEqual({
        id: expect.any(String),
        email: 'player@gametrack.dev',
        username: 'player_one',
        createdAt: expect.any(String),
      });

      const sessionCookie = getSessionCookie(response);
      expect(sessionCookie).toContain('HttpOnly');
      expect(sessionCookie).toContain('SameSite=Lax');
    });

    it('rejects an email that is already registered, ignoring case', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(validRegistration)
        .expect(201);

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          ...validRegistration,
          email: 'PLAYER@gametrack.dev',
          username: 'another_player',
        })
        .expect(409);

      expect(response.body.message).toBe('Email is already in use');
    });

    it('rejects a username that is already taken', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(validRegistration)
        .expect(201);

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...validRegistration, email: 'other@gametrack.dev' })
        .expect(409);

      expect(response.body.message).toBe('Username is already in use');
    });

    it('rejects invalid data and unknown fields', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'not-an-email',
          username: 'x',
          password: 'short',
          role: 'admin',
        })
        .expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining([
          'property role should not exist',
          'email must be an email',
          'password must be longer than or equal to 8 characters',
        ]),
      );
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(validRegistration)
        .expect(201);
    });

    it('starts a session that gives access to GET /auth/me', async () => {
      const agent = request.agent(app.getHttpServer());

      await agent
        .post('/auth/login')
        .send({
          email: validRegistration.email,
          password: validRegistration.password,
        })
        .expect(200);

      const response = await agent.get('/auth/me').expect(200);
      expect(response.body).toMatchObject({
        email: validRegistration.email,
        username: validRegistration.username,
      });
    });

    it('returns the same error for a wrong password and an unknown email', async () => {
      const wrongPassword = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: validRegistration.email, password: 'wrong-password' })
        .expect(401);

      const unknownEmail = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nobody@gametrack.dev', password: 'wrong-password' })
        .expect(401);

      expect(wrongPassword.body.message).toBe('Invalid email or password');
      expect(unknownEmail.body.message).toBe('Invalid email or password');
      expect(getSessionCookie(wrongPassword)).toBeUndefined();
    });
  });

  describe('GET /auth/me', () => {
    it('rejects requests without a session cookie', () => {
      return request(app.getHttpServer()).get('/auth/me').expect(401);
    });

    it('rejects a tampered session token', () => {
      return request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', 'gametrack_session=eyJhbGciOiJIUzI1NiJ9.e30.invalid')
        .expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('clears the session cookie', async () => {
      const agent = request.agent(app.getHttpServer());
      await agent.post('/auth/register').send(validRegistration).expect(201);
      await agent.get('/auth/me').expect(200);

      await agent.post('/auth/logout').expect(204);

      await agent.get('/auth/me').expect(401);
    });
  });
});

describe('Auth rate limiting (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp({ enableThrottling: true });
  });

  afterAll(async () => {
    await app.close();
  });

  it('blocks repeated login attempts from the same client', async () => {
    const attempt = () =>
      request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nobody@gametrack.dev', password: 'guessing' });

    for (let attemptNumber = 1; attemptNumber <= 10; attemptNumber++) {
      await attempt().expect(401);
    }

    await attempt().expect(429);
  });
});
