/** Subset of the RAWG API payloads used by GameTrack. See https://api.rawg.io/docs/ */

export interface RawgNamedResource {
  id: number;
  name: string;
  slug: string;
}

export interface RawgGame {
  id: number;
  slug: string;
  name: string;
  released: string | null;
  background_image: string | null;
  genres?: RawgNamedResource[] | null;
  platforms?: { platform: RawgNamedResource }[] | null;
}

export interface RawgGameDetails extends RawgGame {
  description_raw?: string | null;
}

export interface RawgPaginatedResponse<T> {
  count: number;
  results: T[];
}
