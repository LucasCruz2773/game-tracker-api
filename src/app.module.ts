import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module.js';
import { validateEnvironment } from './config/environment.js';
import { DatabaseModule } from './database/database.module.js';
import { GamesModule } from './games/games.module.js';
import { HealthModule } from './health/health.module.js';
import { LibraryModule } from './library/library.module.js';
import { ReviewsModule } from './reviews/reviews.module.js';
import { SocialModule } from './social/social.module.js';
import { SteamIntegrationModule } from './integrations/steam/steam-integration.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnvironment,
    }),
    // Applied only where ThrottlerGuard is used; routes can override the limit with @Throttle().
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 10 }],
    }),
    DatabaseModule,
    HealthModule,
    AuthModule,
    GamesModule,
    LibraryModule,
    ReviewsModule,
    SteamIntegrationModule,
    SocialModule,
  ],
})
export class AppModule {}
