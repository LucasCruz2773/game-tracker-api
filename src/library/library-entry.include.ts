import type { Prisma } from '../generated/prisma/client.js';
import { gameWithTagsInclude } from '../games/game.include.js';

export const libraryEntryWithGameInclude = {
  game: { include: gameWithTagsInclude },
} satisfies Prisma.GameLibraryInclude;

export type LibraryEntryWithGame = Prisma.GameLibraryGetPayload<{
  include: typeof libraryEntryWithGameInclude;
}>;
