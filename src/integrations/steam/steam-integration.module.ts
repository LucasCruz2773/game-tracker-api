import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module.js';
import { GamesModule } from '../../games/games.module.js';
import { SteamIntegrationController } from './steam-integration.controller.js';
import { SteamIntegrationService } from './steam-integration.service.js';
import { SteamClient } from './steam.client.js';
import { SteamOpenIdClient } from './steam-openid.client.js';

@Module({
  imports: [AuthModule, GamesModule],
  controllers: [SteamIntegrationController],
  providers: [SteamIntegrationService, SteamClient, SteamOpenIdClient],
})
export class SteamIntegrationModule {}
