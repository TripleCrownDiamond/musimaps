/**
 * Pertinence de la recherche d'artistes.
 *
 * Le scénario qui motive tout ce module : chercher un artiste précis dans une
 * ville précise, et ne pas se voir proposer un homonyme d'un autre continent
 * — ni une fiche sans coordonnées, qu'on ne pourra pas poser sur la carte.
 */
import { describe, expect, it } from 'vitest';
import { isPlaceable, parsePlaceTokens, rankArtistResults, type RankableArtist } from './search';

/** Artiste minimal, complété au cas par cas. */
const artist = (over: Partial<RankableArtist> & { name: string }): RankableArtist => ({
  city: '',
  country: '',
  lat: 48.85,
  lng: 2.35,
  ...over,
});

describe('parsePlaceTokens', () => {
  it('reconnaît un pays, en français comme en anglais', () => {
    expect(parsePlaceTokens('booba france')).toEqual(['france']);
    expect(parsePlaceTokens('artist japan')).toEqual(['japan']);
    expect(parsePlaceTokens('artiste japon')).toEqual(['japon']);
  });

  it('reconnaît une ville portée par les résultats', () => {
    // Aucune liste de villes n'est maintenue : le corpus renseigne la requête.
    expect(parsePlaceTokens('booba paris', ['Paris'])).toEqual(['paris']);
    expect(parsePlaceTokens('booba paris', [])).toEqual([]);
  });

  it('ne prend pas un nom d’artiste pour un lieu', () => {
    expect(parsePlaceTokens('booba')).toEqual([]);
    expect(parsePlaceTokens('nina simone', ['Paris'])).toEqual([]);
  });

  it('ignore les mots outils', () => {
    expect(parsePlaceTokens('artiste de la france')).toEqual(['france']);
  });
});

describe('isPlaceable', () => {
  it('accepte des coordonnées valides', () => {
    expect(isPlaceable({ name: 'x', lat: 48.85, lng: 2.35 })).toBe(true);
    expect(isPlaceable({ name: 'x', lat: -33.86, lng: 151.2 })).toBe(true);
  });

  it('refuse le point nul de l’Atlantique', () => {
    // 0,0 n'est jamais une vraie position : c'est un géocodage raté.
    expect(isPlaceable({ name: 'x', lat: 0, lng: 0 })).toBe(false);
  });

  it('refuse des coordonnées absentes ou hors bornes', () => {
    expect(isPlaceable({ name: 'x' })).toBe(false);
    expect(isPlaceable({ name: 'x', lat: 91, lng: 2 })).toBe(false);
    expect(isPlaceable({ name: 'x', lat: NaN, lng: 2 })).toBe(false);
  });
});

describe('rankArtistResults', () => {
  it('classe le nom exact avant une simple inclusion', () => {
    const ranked = rankArtistResults(
      [artist({ name: 'Booba Tribute Band' }), artist({ name: 'Booba' })],
      'Booba',
    );
    expect(ranked[0].artist.name).toBe('Booba');
  });

  it('fait remonter l’artiste dont la ville correspond', () => {
    const ranked = rankArtistResults(
      [
        artist({ name: 'Booba', city: 'Sydney', country: 'Australie', lat: -33.8, lng: 151.2 }),
        artist({ name: 'Booba', city: 'Paris', country: 'France' }),
      ],
      'Booba Paris',
    );
    expect(ranked[0].artist.city).toBe('Paris');
    expect(ranked[0].reasons).toContain('ville cohérente (Paris)');
  });

  it('écarte l’homonyme dont le lieu contredit la requête', () => {
    const ranked = rankArtistResults(
      [artist({ name: 'Booba', city: 'Sydney', country: 'Australie' })],
      'Booba France',
    );
    // Le nom colle, le pays non : le score chute sous le seuil de pertinence.
    expect(ranked).toHaveLength(0);
  });

  it('accepte le pays quand la ville ne correspond pas', () => {
    const ranked = rankArtistResults(
      [artist({ name: 'Booba', city: 'Marseille', country: 'France' })],
      'Booba France',
    );
    expect(ranked[0].reasons).toContain('pays cohérent (France)');
  });

  it('ne pénalise personne quand la requête ne nomme aucun lieu', () => {
    const ranked = rankArtistResults(
      [
        artist({ name: 'Booba', city: 'Sydney', country: 'Australie' }),
        artist({ name: 'Booba', city: 'Paris', country: 'France' }),
      ],
      'Booba',
    );
    expect(ranked).toHaveLength(2);
    expect(ranked[0].score).toBe(ranked[1].score);
  });

  it('départage à score égal en faveur de l’artiste plaçable', () => {
    const ranked = rankArtistResults(
      [
        artist({ name: 'Booba', lat: undefined, lng: undefined }),
        artist({ name: 'Booba', lat: 48.85, lng: 2.35 }),
      ],
      'Booba',
    );
    expect(ranked[0].placeable).toBe(true);
    expect(ranked[0].reasons).toContain('plaçable sur la carte');
  });

  it('garde un artiste absent de la carte s’il est pertinent', () => {
    // Le cœur de la demande : trouver un artiste pas encore référencé.
    const ranked = rankArtistResults(
      [artist({ name: 'Artiste Inconnu', lat: undefined, lng: undefined })],
      'Artiste Inconnu',
    );
    expect(ranked).toHaveLength(1);
    expect(ranked[0].placeable).toBe(false);
    expect(ranked[0].reasons).toContain('sans coordonnées');
  });

  it('écarte un résultat sans rapport avec la requête', () => {
    const ranked = rankArtistResults([artist({ name: 'Nina Simone' })], 'Booba');
    expect(ranked).toHaveLength(0);
  });

  it('retrouve un artiste malgré accents et ligatures', () => {
    const ranked = rankArtistResults([artist({ name: 'Le 3ème Œil' })], 'le 3eme oeil');
    expect(ranked[0].reasons).toContain('nom exact');
  });

  it('classe la correspondance exacte avant une variante élargie', () => {
    const ranked = rankArtistResults(
      [artist({ name: 'Nina Simone Tribute' }), artist({ name: 'Nina Simone' })],
      'Nina Simone',
    );
    expect(ranked[0].artist.name).toBe('Nina Simone');
  });

  it('rend une liste vide sur une requête vide', () => {
    expect(rankArtistResults([artist({ name: 'Booba' })], '   ')).toEqual([]);
  });

  it('borne le score dans [0, 1]', () => {
    const ranked = rankArtistResults(
      [
        artist({
          name: 'Booba',
          city: 'Paris',
          country: 'France',
          image: 'photo.jpg',
          bio: 'x'.repeat(120),
          verified: true,
        }),
      ],
      'Booba Paris',
    );
    expect(ranked[0].score).toBeGreaterThan(0.9);
    expect(ranked[0].score).toBeLessThanOrEqual(1);
  });
});
