import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { createTestApp } from './support/test-app.js';

describe('Health (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health reports the API and database as healthy', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('returns the standard error body for unknown routes', async () => {
    const response = await request(app.getHttpServer())
      .get('/does-not-exist')
      .expect(404);

    expect(response.body).toEqual({
      statusCode: 404,
      message: 'Cannot GET /does-not-exist',
      path: '/does-not-exist',
      timestamp: expect.any(String),
    });
  });
});
