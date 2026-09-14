import { afterEach, describe, expect, it } from 'vitest';
import { formatNotificationTime } from './notifications';

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
