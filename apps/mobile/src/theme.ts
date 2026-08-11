/**
 * Thème mobile — MAPPING de la source unique `@musimaps/shared`.
 *
 * Ce fichier ne définit AUCUNE couleur : il traduit les tokens partagés
 * (packages/shared/src/design/tokens.ts) vers les noms attendus par les
 * écrans RN. Pour changer une couleur, éditer tokens.ts — le web et le
 * mobile suivent ensemble.
 *
 * Avant cette unification, la palette était recopiée à la main depuis
 * index.css et avait divergé : brandSoft était vert (#F1FBDE) au lieu du
 * bleu web (#E4EAFB), et `success` sombre valait #40D99A au lieu de #22C55E.
 */
import { darkPalette, lightPalette } from '@musimaps/shared';

function toAppColors(p: typeof lightPalette, blackTone: string) {
  return {
    background: p.warmWhite,
    surface: p.surface,
    surfaceMuted: p.secondaryBg,
    ink: p.primaryText,
    inkSoft: p.secondaryText,
    muted: p.muted,
    /** Filet des cartes et séparateurs — niveau « marqué » du web. */
    line: p.hairlineStrong,
    /** ★ PRINCIPALE — bleu. À utiliser dans tout code nouveau. */
    brandPrimary: p.brandPrimary,
    /** ☆ SECONDAIRE — vert lime. */
    brandSecondary: p.brandSecondary,
    /** @deprecated Nom trompeur : vaut le lime. Voir `brandSecondary`. */
    brand: p.brand,
    /** @deprecated Nom trompeur : vaut le bleu. Voir `brandPrimary`. */
    brandDeep: p.brandDeep,
    brandSoft: p.brandSoft,
    danger: p.danger,
    success: p.success,
    white: '#FFFFFF',
    /** Extrémité sombre de l'échelle : encre en clair, fond en sombre. */
    black: blackTone,
  };
}

export const lightColors = toAppColors(lightPalette, lightPalette.primaryText);
export const darkColors: typeof lightColors = toAppColors(
  darkPalette,
  darkPalette.warmWhite,
);

/** Palette claire conservée pour les composants statiques plus anciens. */
export const colors = lightColors;
export type AppColors = typeof lightColors;

/**
 * Polices — mêmes familles que le web (Cabinet Grotesk / Satoshi), mais
 * référencées par le nom d'enregistrement RN des .ttf bundlés dans
 * `assets/fonts`. Ces identifiants sont propres à la plateforme : ils
 * restent ici et ne remontent pas dans `shared`.
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
