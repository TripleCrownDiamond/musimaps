import { lightPalette, spacing } from './tokens';

/**
 * Gouttière horizontale commune aux profils (artiste, revendiqué, compte) :
 * topbar et contenu s'alignent sur la même marge, quel que soit l'écran.
 */
export const PROFILE_GUTTER = spacing.xl;

/** Diamètre de la photo de profil artiste sur son profil (dp). */
export const ARTIST_AVATAR_SIZE = 120;

/** Shared visual contract for account media, distinct from public artist media. */
export const PROFILE_MEDIA = {
  avatarSize: { profile: 112, edit: 80 },
  avatarBorder: 4,
  actionSize: 44,
  initialsScale: 0.32,
  fallbackAvatarColors: [lightPalette.brandPrimary, lightPalette.brandSecondary] as const,
  avatarTextColor: lightPalette.primaryText,
} as const;

export function profileInitials(name: string): string {
  return name.trim().split(/\s+/u).filter(Boolean)
    .slice(0, 2).map((word) => Array.from(word)[0]).join('').toUpperCase() || 'M';
}
