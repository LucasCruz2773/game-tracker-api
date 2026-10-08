import { ApiProperty } from '@nestjs/swagger';
import { toStarRating } from '../rating.js';
import type { ReviewWithAuthor } from '../review.include.js';

export class ReviewAuthorDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'lucas_fernandes' })
  username: string;

  @ApiProperty({ type: String, nullable: true, example: 'Lucas Fernandes' })
  displayName: string | null;

  @ApiProperty({ type: String, nullable: true, format: 'uri' })
  avatarUrl: string | null;

  static fromEntity(user: ReviewWithAuthor['user']): ReviewAuthorDto {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    };
  }
}

export class ReviewDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ minimum: 1, maximum: 10, example: 8 })
  rating: number;

  @ApiProperty({
    example: 4,
    description: 'Rating converted to stars (0.5–5)',
  })
  starRating: number;

  @ApiProperty({ type: String, nullable: true })
  body: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: ReviewAuthorDto })
  author: ReviewAuthorDto;

  static fromEntity(review: ReviewWithAuthor): ReviewDto {
    return {
      id: review.id,
      rating: review.rating,
      starRating: toStarRating(review.rating),
      body: review.body,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      author: ReviewAuthorDto.fromEntity(review.user),
    };
  }
}

export class ReviewListResponseDto {
  @ApiProperty({ type: [ReviewDto] })
  items: ReviewDto[];

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  pageSize: number;

  @ApiProperty({ example: 42 })
  total: number;
}
