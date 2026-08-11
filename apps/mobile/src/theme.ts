/**
 * Palette Musimaps — alignée sur la landing page web :
 * fond warm-white, vert lime #A8FF35, encre #111, brandDeep bleu #2F52E0.
 */
export const lightColors = {
  background: '#FAF7F5',
  surface: '#FFFFFF',
  surfaceMuted: '#F5F5F4',
  ink: '#111111',
  inkSoft: '#6B7280',
  muted: '#9CA3AF',
  line: 'rgba(0, 0, 0, 0.08)',
  brand: '#A8FF35',
  brandDeep: '#2F52E0',
  brandSoft: '#F1FBDE',
  danger: '#DC2626',
  success: '#22C55E',
  white: '#FFFFFF',
  black: '#111111',
};

export const darkColors: typeof lightColors = {
  background: '#0D0F13',
  surface: '#14181F',
  surfaceMuted: '#191D24',
  ink: '#F3F4F6',
  inkSoft: '#9AA4AF',
  muted: '#6B7280',
  line: 'rgba(255, 255, 255, 0.14)',
  brand: '#A8FF35',
  brandDeep: '#2F52E0',
  brandSoft: '#1E2A44',
  danger: '#EF4444',
  success: '#40D99A',
  white: '#FFFFFF',
  black: '#0D0F13',
};

/** Palette claire conservée pour les composants statiques plus anciens. */
export const colors = lightColors;
export type AppColors = typeof lightColors;

/**
 * Polices — mêmes familles que le web : Cabinet Grotesk (display)
 * et Satoshi (corps), bundlées depuis Fontshare dans assets/fonts.
 */
export const fonts = {
  display: 'CabinetGrotesk_Extrabold',
  displayBlack: 'CabinetGrotesk_Black',
  body: 'Satoshi_Regular',
  medium: 'Satoshi_Medium',
  bold: 'Satoshi_Bold',
};

export const shadow = {
  shadowColor: '#111111',
  shadowOffset: { width: 0, height: 14 },
  shadowOpacity: 0.12,
  shadowRadius: 26,
  elevation: 8,
};

/**
 * Style du dock de navigation flottant — défini UNE fois ici pour être
 * partagé entre App.tsx (tab bar) et ExploreScreen (restauration après
 * fermeture de la fiche artiste), sans dérive.
 */
export function dockStyle(colors: AppColors, bottom: number) {
  return {
    position: 'absolute' as const,
    left: 18,
    right: 18,
    bottom,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    shadowColor: '#111111',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 12,
    paddingTop: 7,
    paddingBottom: 7,
  };
}
