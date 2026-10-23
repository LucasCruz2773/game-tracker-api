import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp, setupSwagger } from './app.setup.js';
import {
  NodeEnvironment,
  type EnvironmentVariables,
} from './config/environment.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  configureApp(app);

  const configService = app.get(ConfigService<EnvironmentVariables, true>);

  if (
    configService.get('NODE_ENV', { infer: true }) !==
    NodeEnvironment.Production
  ) {
    setupSwagger(app);
  }

  await app.listen(configService.get('PORT', { infer: true }), '0.0.0.0');
}
await bootstrap();
