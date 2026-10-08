import type { Prisma } from '../generated/prisma/client.js';

export const reviewWithAuthorInclude = {
  user: {
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
    },
  },
} satisfies Prisma.ReviewInclude;

export type ReviewWithAuthor = Prisma.ReviewGetPayload<{
  include: typeof reviewWithAuthorInclude;
}>;
