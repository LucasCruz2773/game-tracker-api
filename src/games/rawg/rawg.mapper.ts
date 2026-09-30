import type {
  CatalogGame,
  CatalogGameDetails,
  CatalogTag,
} from '../catalog.types.js';
import type {
  RawgGame,
  RawgGameDetails,
  RawgNamedResource,
} from './rawg.types.js';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Returns null for entries missing the fields GameTrack depends on. */
export function toCatalogGame(rawgGame: RawgGame): CatalogGame | null {
  if (
    !Number.isInteger(rawgGame.id) ||
    !isNonEmptyString(rawgGame.slug) ||
    !isNonEmptyString(rawgGame.name)
  ) {
    return null;
  }

  return {
    rawgId: rawgGame.id,
    slug: rawgGame.slug,
    title: rawgGame.name.trim(),
    coverUrl: isNonEmptyString(rawgGame.background_image)
      ? rawgGame.background_image
      : null,
    releaseDate: parseReleaseDate(rawgGame.released),
    genres: toCatalogTags(rawgGame.genres ?? []),
    platforms: toCatalogTags(
      (rawgGame.platforms ?? []).map(({ platform }) => platform),
    ),
  };
}

export function toCatalogGameDetails(
  rawgGame: RawgGameDetails,
): CatalogGameDetails | null {
  const catalogGame = toCatalogGame(rawgGame);

  if (!catalogGame) {
    return null;
  }

  const description = rawgGame.description_raw?.trim();

  return { ...catalogGame, description: description || null };
}

function parseReleaseDate(released: string | null): Date | null {
  if (!released || !ISO_DATE_PATTERN.test(released)) {
    return null;
  }

  const releaseDate = new Date(`${released}T00:00:00.000Z`);
  return Number.isNaN(releaseDate.getTime()) ? null : releaseDate;
}

function toCatalogTags(resources: RawgNamedResource[]): CatalogTag[] {
  return resources
    .filter(
      (resource) =>
        isNonEmptyString(resource?.name) && isNonEmptyString(resource.slug),
    )
    .map(({ name, slug }) => ({ name, slug }));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
