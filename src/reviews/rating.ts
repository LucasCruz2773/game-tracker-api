/** Stored as 1–10; each step is half a star (0.5–5 on the UI). */
export const MIN_REVIEW_RATING = 1;
export const MAX_REVIEW_RATING = 10;
export const MAX_REVIEW_BODY_LENGTH = 5_000;

export function toStarRating(rating: number): number {
  return rating / 2;
}
