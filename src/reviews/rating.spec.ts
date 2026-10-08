import { toStarRating } from './rating.js';

describe('toStarRating', () => {
  it('converts stored half-steps to stars', () => {
    expect(toStarRating(1)).toBe(0.5);
    expect(toStarRating(8)).toBe(4);
    expect(toStarRating(10)).toBe(5);
  });
});
