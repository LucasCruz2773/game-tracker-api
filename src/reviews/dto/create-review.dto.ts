import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  MAX_REVIEW_BODY_LENGTH,
  MAX_REVIEW_RATING,
  MIN_REVIEW_RATING,
} from '../rating.js';

export class CreateReviewDto {
  @ApiProperty({
    minimum: MIN_REVIEW_RATING,
    maximum: MAX_REVIEW_RATING,
    description: 'Half-star steps from 0.5 to 5 (stored as 1–10)',
    example: 8,
  })
  @IsInt()
  @Min(MIN_REVIEW_RATING)
  @Max(MAX_REVIEW_RATING)
  rating: number;

  @ApiPropertyOptional({
    maxLength: MAX_REVIEW_BODY_LENGTH,
    nullable: true,
    example: 'A masterpiece of level design.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_REVIEW_BODY_LENGTH)
  body?: string | null;
}
