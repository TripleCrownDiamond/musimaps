/**
 * Adresses publiques.
 *
 * Ces tests existent parce que le domaine était faux en production :
 * `musimaps.app` ne résout pas, le site vit sur `musimaps.com`. Chaque partage,
 * chaque URL canonique et chaque balise Open Graph pointait vers le vide.
 * Le premier test ci-dessous est un garde-fou : il échoue si quelqu'un
 * réintroduit l'ancien domaine.
 */
import { describe, expect, it } from 'vitest';
import { LEGAL_PATHS, SITE_URL, artistUrl, privacyUrl, siteUrl, termsUrl } from './urls';

describe('SITE_URL', () => {
  it('pointe sur le domaine vivant, jamais sur l’ancien', () => {
    expect(SITE_URL).toBe('https://musimaps.com');
    expect(SITE_URL).not.toContain('musimaps.app');
  });

  it('n’a pas de barre oblique finale — la concaténation en dépend', () => {
    expect(SITE_URL.endsWith('/')).toBe(false);
  });
});

describe('siteUrl', () => {
  it('rend la racine avec une barre oblique', () => {
    expect(siteUrl()).toBe('https://musimaps.com/');
    expect(siteUrl('/')).toBe('https://musimaps.com/');
  });

  it('préfixe l’anglais par /en', () => {
    expect(siteUrl('/', 'en')).toBe('https://musimaps.com/en');
    expect(siteUrl('/globe', 'en')).toBe('https://musimaps.com/en/globe');
  });

  it('tolère un chemin sans barre oblique initiale', () => {
    expect(siteUrl('globe')).toBe('https://musimaps.com/globe');
  });

  it('produit toujours une URL absolue analysable', () => {
    for (const url of [siteUrl(), siteUrl('/globe', 'en'), termsUrl(), privacyUrl('en')]) {
      expect(() => new URL(url)).not.toThrow();
      expect(url).toMatch(/^https:\/\//);
    }
  });
});

describe('artistUrl', () => {
  it('construit le lien de partage d’un artiste', () => {
    expect(artistUrl('booba')).toBe('https://musimaps.com/artist/booba');
  });

  it('accepte un identifiant quand le slug est absent', () => {
    expect(artistUrl('mb-697eaf40')).toBe('https://musimaps.com/artist/mb-697eaf40');
  });

  it('respecte la langue', () => {
    expect(artistUrl('booba', 'en')).toBe('https://musimaps.com/en/artist/booba');
  });
});

describe('pages légales', () => {
  it('exposent des chemins stables — les stores les exigent', () => {
    expect(LEGAL_PATHS.terms).toBe('/cgu');
    expect(LEGAL_PATHS.privacy).toBe('/confidentialite');
  });

  it('résolvent vers le site vivant', () => {
    expect(termsUrl()).toBe('https://musimaps.com/cgu');
    expect(privacyUrl()).toBe('https://musimaps.com/confidentialite');
    expect(termsUrl('en')).toBe('https://musimaps.com/en/cgu');
  });
});
