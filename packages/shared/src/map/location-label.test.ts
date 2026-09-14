import { describe, expect, it } from 'vitest';
import type { Artist } from '../index';
import { artistMapLocation, mapLocationHeading, mapLocationLabel } from './location';

const artistIn = (city: string, country: string): Artist => ({
  id: city, name: city, city, country, coordinates: [0, 0], genre: '', flag: '', followers: '', bio: '',
  color: ['#000000', '#ffffff'], tracks: [], events: [],
});

describe('artistMapLocation', () => {
  it('uses the country of the city when the declared nationality contradicts it', () => {
    const heading = mapLocationHeading(null, artistMapLocation(artistIn('Dakar', 'FR')), 'en');
    expect(heading?.label).toBe('Dakar, Senegal');
  });

  it('keeps the declared country when the city agrees with it', () => {
    expect(artistMapLocation(artistIn('Lagos', 'Nigeria')).country).toBe('Nigeria');
    expect(artistMapLocation(artistIn('Lagos', 'NG')).country).toBe('NG');
  });
});

describe('mapLocationLabel', () => {
  it('names the country instead of showing its ISO code', () => {
    expect(mapLocationLabel({ city: 'Lagos', country: 'NG' }, 'en')).toBe('Lagos, Nigeria');
    expect(mapLocationLabel({ city: 'Cotonou', country: 'bj' }, 'fr')).toBe('Cotonou, Bénin');
  });

  it('keeps a country that is already a name', () => {
    expect(mapLocationLabel({ city: 'Lagos', country: 'Nigeria' }, 'en')).toBe('Lagos, Nigeria');
  });

  it('localizes the heading built from an artist location', () => {
    const heading = mapLocationHeading(null, { coordinates: [3.38, 6.45], city: 'Lagos', country: 'NG' }, 'en');
    expect(heading?.label).toBe('Lagos, Nigeria');
  });
});
