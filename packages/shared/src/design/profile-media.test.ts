import { describe, expect, it } from 'vitest';
import { PROFILE_MEDIA, profileInitials } from './profile-media';

describe('account media design', () => {
  it('uses the same sizes for display and editing on both surfaces', () => {
    expect(PROFILE_MEDIA.avatarSize).toEqual({ profile: 112, edit: 80 });
    expect(PROFILE_MEDIA.actionSize).toBeGreaterThanOrEqual(44);
  });
  it('makes consistent initials, including blank names and repeated spaces', () => {
    expect(profileInitials('')).toBe('M');
    expect(profileInitials('  Aya   Nakamura ')).toBe('AN');
    expect(profileInitials('Élodie Durand')).toBe('ÉD');
    expect(profileInitials('A B C')).toBe('AB');
  });
});
