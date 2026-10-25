import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { ActivityType, Prisma } from '../generated/prisma/client.js';
import type { CreateReviewDto } from './dto/create-review.dto.js';
import type { ListReviewsQueryDto } from './dto/list-reviews-query.dto.js';
import {
  ReviewDto,
  type ReviewListResponseDto,
} from './dto/review-response.dto.js';
import type { UpdateReviewDto } from './dto/update-review.dto.js';
import {
  reviewWithAuthorInclude,
  type ReviewWithAuthor,
} from './review.include.js';

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async listByGame(
    gameId: string,
    query: ListReviewsQueryDto,
  ): Promise<ReviewListResponseDto> {
    await this.ensureGameExists(gameId);

    const where: Prisma.ReviewWhereInput = { gameId };
    const [reviews, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: reviewWithAuthorInclude,
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      items: reviews.map((review) => ReviewDto.fromEntity(review)),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async findMine(userId: string, gameId: string): Promise<ReviewDto> {
    await this.ensureGameExists(gameId);

    const review = await this.prisma.review.findUnique({
      where: { userId_gameId: { userId, gameId } },
      include: reviewWithAuthorInclude,
    });

    if (!review) {
      throw new NotFoundException('You have not reviewed this game yet');
    }

    return ReviewDto.fromEntity(review);
  }

  async create(
    userId: string,
    gameId: string,
    createReviewDto: CreateReviewDto,
  ): Promise<ReviewDto> {
    await this.ensureGameExists(gameId);

    try {
      const body = normalizeBody(createReviewDto.body);
      const review = await this.prisma.$transaction(async (transaction) => {
        const created = await transaction.review.create({
          data: {
            userId,
            gameId,
            rating: createReviewDto.rating,
            body,
          },
          include: reviewWithAuthorInclude,
        });
        await transaction.activity.create({
          data: {
            actorId: userId,
            gameId,
            type: ActivityType.REVIEWED,
            rating: created.rating,
            reviewBody: created.body,
          },
        });
        return created;
      });

      return ReviewDto.fromEntity(review);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_CONSTRAINT_VIOLATION
      ) {
        throw new ConflictException('You have already reviewed this game');
      }
      throw error;
    }
  }

  async update(
    userId: string,
    reviewId: string,
    updateReviewDto: UpdateReviewDto,
  ): Promise<ReviewDto> {
    const review = await this.findReviewOrThrow(reviewId);
    this.ensureOwner(userId, review);

    const updatedReview = await this.prisma.$transaction(
      async (transaction) => {
        const updated = await transaction.review.update({
          where: { id: reviewId },
          data: {
            ...(updateReviewDto.rating !== undefined && {
              rating: updateReviewDto.rating,
            }),
            ...(updateReviewDto.body !== undefined && {
              body: normalizeBody(updateReviewDto.body),
            }),
          },
          include: reviewWithAuthorInclude,
        });
        await transaction.activity.deleteMany({
          where: {
            actorId: userId,
            gameId: review.gameId,
            type: ActivityType.REVIEWED,
          },
        });
        await transaction.activity.create({
          data: {
            actorId: userId,
            gameId: review.gameId,
            type: ActivityType.REVIEWED,
            rating: updated.rating,
            reviewBody: updated.body,
          },
        });
        return updated;
      },
    );

    return ReviewDto.fromEntity(updatedReview);
  }

  async remove(userId: string, reviewId: string): Promise<void> {
    const review = await this.findReviewOrThrow(reviewId);
    this.ensureOwner(userId, review);

    await this.prisma.$transaction([
      this.prisma.review.delete({ where: { id: reviewId } }),
      this.prisma.activity.deleteMany({
        where: {
          actorId: userId,
          gameId: review.gameId,
          type: ActivityType.REVIEWED,
        },
      }),
    ]);
  }

  private async ensureGameExists(gameId: string): Promise<void> {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      select: { id: true },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }
  }

  private async findReviewOrThrow(reviewId: string): Promise<ReviewWithAuthor> {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      include: reviewWithAuthorInclude,
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    return review;
  }

  private ensureOwner(userId: string, review: ReviewWithAuthor): void {
    if (review.userId !== userId) {
      throw new ForbiddenException('You can only change your own reviews');
    }
  }
}

function normalizeBody(body: string | null | undefined): string | null {
  if (body === undefined || body === null) {
    return null;
  }

  const trimmed = body.trim();
  return trimmed.length > 0 ? trimmed : null;
}
