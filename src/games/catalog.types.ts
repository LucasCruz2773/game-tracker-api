/** Game data as provided by the external catalog, independent of the RAWG payload format. */

export interface CatalogTag {
  name: string;
  slug: string;
}

export interface CatalogGame {
  rawgId: number;
  slug: string;
  title: string;
  coverUrl: string | null;
  releaseDate: Date | null;
  genres: CatalogTag[];
  platforms: CatalogTag[];
}

export interface CatalogGameDetails extends CatalogGame {
  description: string | null;
}

export interface CatalogSearchResult {
  total: number;
  games: CatalogGame[];
}
