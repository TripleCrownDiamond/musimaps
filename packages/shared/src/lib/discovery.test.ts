import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, describe, expect, it } from 'vitest';
import type { Artist } from '../index';
import { configureRuntime, type Storage } from '../runtime';
import {
  addMapArtist,
  addOrUpdateMapArtist,
  discoveryEvidenceCount,
  displayGenre,
  hasCrossSourceEvidence,
  mergeRediscoveredArtist,
  normalizeArtistSearchQuery,
  type DiscoveredArtist,
} from './discovery';

describe('cross-source discovery gate', () => {
  it('requires two independent catalogues', () => {
    expect(discoveryEvidenceCount({ evidence: { musicbrainz: true } })).toBe(1);
    expect(hasCrossSourceEvidence({ evidence: { musicbrainz: true } })).toBe(false);
    expect(hasCrossSourceEvidence({ evidence: { musicbrainz: true, wikipedia: true } })).toBe(true);
  });

  it('does not count an unverified official link as a second source', () => {
    expect(hasCrossSourceEvidence({ evidence: { musicbrainz: true, official: true } })).toBe(false);
  });

  it('normalizes the common Ayra Starr typo before querying sources', () => {
    expect(normalizeArtistSearchQuery('  Arya Star ')).toBe('Ayra Starr');
    expect(normalizeArtistSearchQuery('Ayra Starr')).toBe('Ayra Starr');
  });
});

describe('displayGenre', () => {
  it('translates the technical Unknown fallback', () => {
    expect(displayGenre('Unknown', 'Inconnu')).toBe('Inconnu');
    expect(displayGenre('  ', 'Unknown')).toBe('Unknown');
    expect(displayGenre(null, 'Inconnu')).toBe('Inconnu');
  });

  it('keeps a real genre', () => {
    expect(displayGenre('Afrobeats', 'Inconnu')).toBe('Afrobeats');
  });
});

const ZEYNAB_ID = 'mb-a4f07ac8-8e9f-44d7-a2bb-cbb77a2f5694';

// Le pin tel que corrigé par la migration 00065.
const curated: Artist = {
  id: ZEYNAB_ID,
  name: 'Zeynab',
  genre: 'Afropop',
  city: 'Cotonou',
  country: 'BJ',
  flag: '🇧🇯',
  coordinates: [2.4401, 6.373391],
  bio: '',
  followers: '',
  color: ['#2F52E0', '#A8FF35'],
  tracks: [],
  events: [],
  verified: true,
  claimedBy: 'user-1',
  platforms: { spotify: 'https://open.spotify.com/artist/curated' },
  socials: {},
  source: 'musicbrainz',
};

// Ce qu'un ré-import MusicBrainz propose pour le même artiste.
const reimported: DiscoveredArtist = {
  id: ZEYNAB_ID,
  name: 'Zeynab Abib',
  genre: 'Gospel',
  city: 'Abidjan',
  country: 'CI',
  flag: '🇨🇮',
  lat: 5.320357,
  lng: -4.016107,
  bio: 'Chanteuse béninoise.',
  image: 'https://upload.wikimedia.org/zeynab.jpg',
  source: 'waitlist',
  platforms: {
    spotify: 'https://open.spotify.com/artist/other',
    youtube: 'https://youtube.com/@zeynab',
  },
  socials: { instagram: 'https://instagram.com/zeynab' },
};

describe('mergeRediscoveredArtist', () => {
  it('keeps the curated identity and location of an existing pin', () => {
    const merged = mergeRediscoveredArtist(curated, reimported);
    expect(merged).toMatchObject({
      id: ZEYNAB_ID,
      name: 'Zeynab',
      city: 'Cotonou',
      country: 'BJ',
      flag: '🇧🇯',
      coordinates: [2.4401, 6.373391],
      source: 'musicbrainz',
      verified: true,
      claimedBy: 'user-1',
    });
  });

  it('only fills fields that are empty', () => {
    const merged = mergeRediscoveredArtist(curated, reimported);
    expect(merged.genre).toBe('Afropop');
    expect(merged.bio).toBe('Chanteuse béninoise.');
    expect(merged.image).toBe('https://upload.wikimedia.org/zeynab.jpg');
  });

  it('adds missing links without replacing existing ones', () => {
    const merged = mergeRediscoveredArtist(curated, reimported);
    expect(merged.platforms).toEqual({
      spotify: 'https://open.spotify.com/artist/curated',
      youtube: 'https://youtube.com/@zeynab',
    });
    expect(merged.socials).toEqual({ instagram: 'https://instagram.com/zeynab' });
  });
});

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get: async (k) => map.get(k) ?? null,
    set: async (k, v) => void map.set(k, v),
    remove: async (k) => void map.delete(k),
  };
}

function useFakeSupabase(client: object) {
  configureRuntime({ supabase: client as SupabaseClient, storage: memoryStorage() });
}

describe('map writes never overwrite an existing artist', () => {
  afterEach(() => configureRuntime({ supabase: null, storage: memoryStorage() }));

  it('addMapArtist inserts only, without moderation fields', async () => {
    const calls: Array<{ row: Record<string, unknown>; options: Record<string, unknown> }> = [];
    useFakeSupabase({
      from: () => ({
        upsert: async (row: Record<string, unknown>, options: Record<string, unknown>) => {
          calls.push({ row, options });
          return { error: null };
        },
      }),
    });

    await expect(addMapArtist(reimported)).resolves.toEqual({ ok: true });
    expect(calls).toHaveLength(1);
    expect(calls[0].options).toMatchObject({ onConflict: 'id', ignoreDuplicates: true });
    expect(calls[0].row).not.toHaveProperty('verified');
    expect(calls[0].row).not.toHaveProperty('claimed_by');
  });

  it('addOrUpdateMapArtist never requests an admin override', async () => {
    const calls: Array<{ fn: string; args: { p_artist: Record<string, unknown> } }> = [];
    useFakeSupabase({
      rpc: async (fn: string, args: { p_artist: Record<string, unknown> }) => {
        calls.push({ fn, args });
        return { data: { ok: true, id: ZEYNAB_ID, updated: true }, error: null };
      },
    });

    await expect(addOrUpdateMapArtist(reimported)).resolves.toEqual({
      ok: true,
      id: ZEYNAB_ID,
      updated: true,
    });
    expect(calls[0].fn).toBe('add_or_update_map_artist');
    expect(calls[0].args.p_artist).not.toHaveProperty('admin_override');
  });
});
