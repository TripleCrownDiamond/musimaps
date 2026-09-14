import { describe, expect, it } from 'vitest';
import { PROFILE_MEDIA, profileCoverHeight, profileInitials } from './profile-media';

describe('account media design', () => {
  it('uses the same sizes for display and editing on both surfaces', () => {
    expect(PROFILE_MEDIA.avatarSize).toEqual({ profile: 112, edit: 80 });
    expect(PROFILE_MEDIA.profileOverlap).toBe(PROFILE_MEDIA.avatarSize.profile / 2);
    expect(PROFILE_MEDIA.coverMinHeight).toBeLessThan(PROFILE_MEDIA.coverMaxHeight);
    expect(PROFILE_MEDIA.actionSize).toBeGreaterThanOrEqual(44);
  });
  it('makes consistent initials, including blank names and repeated spaces', () => {
    expect(profileInitials('')).toBe('M');
    expect(profileInitials('  Aya   Nakamura ')).toBe('AN');
    expect(profileInitials('Élodie Durand')).toBe('ÉD');
    expect(profileInitials('A B C')).toBe('AB');
  });
  it('clamps only cover height without shrinking the available width', () => {
    expect(profileCoverHeight(200)).toBe(PROFILE_MEDIA.coverMinHeight);
    expect(profileCoverHeight(320)).toBe(180);
    expect(profileCoverHeight(800)).toBe(PROFILE_MEDIA.coverMaxHeight);
  });
});
