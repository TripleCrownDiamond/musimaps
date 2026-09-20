import { afterEach, describe, expect, it } from 'vitest';
import { formatNotificationTime, notificationDestination } from './notifications';

describe('notificationDestination', () => {
  const alert = { artist_id: null, ref: null };

  it('ouvre l’artiste concerné', () => {
    expect(notificationDestination({ ...alert, type: 'discovery', artist_id: 'a1' }))
      .toEqual({ kind: 'artist', artistId: 'a1' });
    expect(notificationDestination({ ...alert, type: 'nearby', artist_id: 'a2' }))
      .toEqual({ kind: 'artist', artistId: 'a2' });
  });

  it('mène à l’artiste le plus proche pour une alerte de proximité', () => {
    expect(notificationDestination({ ...alert, type: 'nearby' })).toEqual({ kind: 'nearby' });
  });

  it('ouvre la fiche du badge débloqué, jamais la carte', () => {
    expect(notificationDestination({ ...alert, type: 'achievement', ref: 'first-city' }))
      .toEqual({ kind: 'achievement', badgeId: 'first-city' });
    expect(notificationDestination({ ...alert, type: 'achievement' })).toEqual({ kind: 'achievements' });
    expect(notificationDestination({ ...alert, type: 'streak' })).toEqual({ kind: 'achievements' });
  });

  it('retombe sur le globe pour une alerte sans cible', () => {
    expect(notificationDestination({ ...alert, type: 'booking' })).toEqual({ kind: 'globe' });
  });
});

const NOW = Date.parse('2026-09-13T12:00:00Z');
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe('formatNotificationTime', () => {
  const original = Intl.RelativeTimeFormat;
  afterEach(() => {
    (Intl as { RelativeTimeFormat?: unknown }).RelativeTimeFormat = original;
  });

  it('fonctionne sans Intl.RelativeTimeFormat (absent de Hermes sur Android)', () => {
    (Intl as { RelativeTimeFormat?: unknown }).RelativeTimeFormat = undefined;
    expect(formatNotificationTime(ago(5 * MINUTE), 'fr', NOW)).toBe('Il y a 5 min');
  });

  it('suit les paliers en français et en anglais', () => {
    expect(formatNotificationTime(ago(10_000), 'fr', NOW)).toBe('À l’instant');
    expect(formatNotificationTime(ago(45 * MINUTE), 'en', NOW)).toBe('45 min ago');
    expect(formatNotificationTime(ago(3 * HOUR), 'fr', NOW)).toBe('Il y a 3 h');
    expect(formatNotificationTime(ago(DAY + HOUR), 'fr', NOW)).toBe('Hier');
    expect(formatNotificationTime(ago(3 * DAY), 'en', NOW)).toBe('3 days ago');
  });

  it('ne produit jamais de durée négative pour une date à venir', () => {
    expect(formatNotificationTime(ago(-30_000), 'en', NOW)).toBe('Just now');
  });
});
