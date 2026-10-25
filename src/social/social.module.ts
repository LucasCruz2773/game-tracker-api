import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { LibraryModule } from '../library/library.module.js';
import { SocialController } from './social.controller.js';
import { SocialService } from './social.service.js';

@Module({
  imports: [AuthModule, LibraryModule],
  controllers: [SocialController],
  providers: [SocialService],
})
export class SocialModule {}
