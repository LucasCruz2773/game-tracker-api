import type { Prisma } from '../generated/prisma/client.js';

export const gameWithTagsInclude = {
  genres: { orderBy: { name: 'asc' } },
  platforms: { orderBy: { name: 'asc' } },
} satisfies Prisma.GameInclude;

export type GameWithTags = Prisma.GameGetPayload<{
  include: typeof gameWithTagsInclude;
}>;
