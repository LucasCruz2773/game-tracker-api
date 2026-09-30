import { INestApplication, type Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { PrismaService } from '../../src/database/prisma.service.js';

interface ProviderOverride {
  provide: Type;
  useValue: unknown;
}

interface TestAppOptions {
  /** Rate limiting is disabled by default so tests can call routes freely. */
  enableThrottling?: boolean;
  providerOverrides?: ProviderOverride[];
}

export async function createTestApp(
  options: TestAppOptions = {},
): Promise<INestApplication<App>> {
  const moduleBuilder = Test.createTestingModule({ imports: [AppModule] });

  if (!options.enableThrottling) {
    moduleBuilder
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true });
  }

  for (const override of options.providerOverrides ?? []) {
    moduleBuilder
      .overrideProvider(override.provide)
      .useValue(override.useValue);
  }

  const moduleFixture = await moduleBuilder.compile();
  const app = moduleFixture.createNestApplication<INestApplication<App>>();
  configureApp(app);
  await app.init();

  return app;
}

export async function resetDatabase(app: INestApplication): Promise<void> {
  const prisma = app.get(PrismaService);
  const [{ databaseName }] = await prisma.$queryRaw<
    { databaseName: string }[]
  >`SELECT current_database() AS "databaseName"`;

  if (!databaseName.endsWith('_test')) {
    throw new Error(
      `Refusing to reset "${databaseName}": e2e tests must run against a *_test database`,
    );
  }

  await prisma.$executeRaw`TRUNCATE TABLE users, games, genres, platforms RESTART IDENTITY CASCADE`;
}
