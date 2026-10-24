import { Module } from '@nestjs/common';
import { GamesController } from './games.controller.js';
import { GamesService } from './games.service.js';
import { RawgClient } from './rawg/rawg.client.js';

@Module({
  controllers: [GamesController],
  providers: [GamesService, RawgClient],
  exports: [GamesService],
})
export class GamesModule {}
