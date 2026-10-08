import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { GameReviewsController } from './game-reviews.controller.js';
import { ReviewsController } from './reviews.controller.js';
import { ReviewsService } from './reviews.service.js';

@Module({
  imports: [AuthModule],
  controllers: [GameReviewsController, ReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
