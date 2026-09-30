import { toCatalogGame, toCatalogGameDetails } from './rawg.mapper.js';
import type { RawgGame } from './rawg.types.js';

const celeste: RawgGame = {
  id: 22121,
  slug: 'celeste',
  name: 'Celeste',
  released: '2018-01-25',
  background_image: 'https://media.rawg.io/media/games/celeste.jpg',
  genres: [{ id: 83, name: 'Platformer', slug: 'platformer' }],
  platforms: [{ platform: { id: 4, name: 'PC', slug: 'pc' } }],
};

describe('rawg.mapper', () => {
  it('maps a RAWG game to the catalog format', () => {
    expect(toCatalogGame(celeste)).toEqual({
      rawgId: 22121,
      slug: 'celeste',
      title: 'Celeste',
      coverUrl: 'https://media.rawg.io/media/games/celeste.jpg',
      releaseDate: new Date('2018-01-25T00:00:00.000Z'),
      genres: [{ name: 'Platformer', slug: 'platformer' }],
      platforms: [{ name: 'PC', slug: 'pc' }],
    });
  });

  it('discards entries missing an id, slug or name', () => {
    expect(toCatalogGame({ ...celeste, name: '  ' })).toBeNull();
    expect(toCatalogGame({ ...celeste, slug: '' })).toBeNull();
    expect(
      toCatalogGame({ ...celeste, id: undefined as unknown as number }),
    ).toBeNull();
  });

  it('tolerates missing optional data', () => {
    expect(
      toCatalogGame({
        ...celeste,
        released: 'TBA',
        background_image: null,
        genres: null,
        platforms: undefined,
      }),
    ).toMatchObject({
      releaseDate: null,
      coverUrl: null,
      genres: [],
      platforms: [],
    });
  });

  it('uses the plain-text description and treats blank ones as missing', () => {
    expect(
      toCatalogGameDetails({ ...celeste, description_raw: ' Climb it. ' }),
    ).toMatchObject({ description: 'Climb it.' });
    expect(
      toCatalogGameDetails({ ...celeste, description_raw: '   ' }),
    ).toMatchObject({ description: null });
  });
});
