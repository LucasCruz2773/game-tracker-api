import type { Prisma } from '../generated/prisma/client.js';
import { gameWithTagsInclude } from '../games/game.include.js';

export const activityFeedInclude = {
  actor: {
    select: {
      id: true,
      username: true,
      avatarUrl: true,
    },
  },
  game: { include: gameWithTagsInclude },
} satisfies Prisma.ActivityInclude;

export type ActivityFeedEntity = Prisma.ActivityGetPayload<{
  include: typeof activityFeedInclude;
}>;
