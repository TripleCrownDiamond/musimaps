import { describe, expect, it } from 'vitest';
import {
  discoveryEvidenceCount,
  hasCrossSourceEvidence,
  normalizeArtistSearchQuery,
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
