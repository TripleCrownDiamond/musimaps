import { darkPalette, lightPalette, spacing } from './tokens';

/** Hauteur normale et uniforme du header de profil (artiste, revendiqué, compte). */
export const PROFILE_HEADER_HEIGHT = 300;

/**
 * Gouttière horizontale commune aux profils (artiste, revendiqué, compte) :
 * topbar et contenu s'alignent sur la même marge, quel que soit l'écran.
 */
export const PROFILE_GUTTER = spacing.xl;

/** Diamètre de la photo de profil artiste sur son profil (dp). */
export const ARTIST_AVATAR_SIZE = 120;

/** Débordement de la photo artiste par-dessous la cover : la moitié ressort. */
export const ARTIST_AVATAR_OVERLAP = ARTIST_AVATAR_SIZE / 2;

/** Shared visual contract for account media, distinct from public artist media. */
export const PROFILE_MEDIA = {
  coverAspect: [16, 9] as const,
  coverMinHeight: 144,
  coverMaxHeight: 208,
  avatarSize: { profile: 112, edit: 80 },
  avatarBorder: 4,
  profileOverlap: 56,
  actionSize: 44,
  initialsScale: 0.32,
  fallbackCoverColors: [lightPalette.brandPrimary, darkPalette.warmWhite, darkPalette.warmWhite] as const,
  fallbackAvatarColors: [lightPalette.brandPrimary, lightPalette.brandSecondary] as const,
  avatarTextColor: lightPalette.primaryText,
  coverShadeOpacity: 0.75,
} as const;

export function profileCoverHeight(width: number): number {
  const naturalHeight = width * PROFILE_MEDIA.coverAspect[1] / PROFILE_MEDIA.coverAspect[0];
  return Math.min(PROFILE_MEDIA.coverMaxHeight, Math.max(PROFILE_MEDIA.coverMinHeight, naturalHeight));
}

export function profileInitials(name: string): string {
  return name.trim().split(/\s+/u).filter(Boolean)
    .slice(0, 2).map((word) => Array.from(word)[0]).join('').toUpperCase() || 'M';
}
