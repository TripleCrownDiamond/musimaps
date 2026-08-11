/**
 * Tokens de design Musimaps — SOURCE UNIQUE pour le web et le mobile.
 *
 * TypeScript pur : aucune dépendance plateforme (cf. docs/REGLES-EVOLUTION.md).
 *
 *   Web    → `node scripts/gen-tokens.mjs` régénère
 *            `apps/web/src/tokens.generated.css` (bloc @theme + palette sombre).
 *            Ne JAMAIS éditer ce fichier à la main.
 *   Mobile → `apps/mobile/src/theme.ts` mappe ces valeurs vers
 *            `lightColors` / `darkColors`.
 *
 * Avant l'unification, `theme.ts` était une recopie manuelle d'`index.css` et
 * les deux avaient déjà divergé (brandSoft vert côté mobile contre bleu côté
 * web, `success` sombre différent). Toute nouvelle couleur passe par ici.
 */

/** Jeu de couleurs complet d'un thème. */
export interface ThemePalette {
  /** Fond de page. */
  warmWhite: string;
  /** Fond secondaire (sections, pastilles neutres). */
  secondaryBg: string;
  /** Texte principal. */
  primaryText: string;
  /** Texte secondaire. */
  secondaryText: string;
  /** Vert lime du logo : aplats et éléments graphiques. */
  brand: string;
  /** Variante foncée (bleu) : texte, icônes, boutons secondaires. */
  brandDeep: string;
  /** Texte posé sur `brandDeep`. */
  brandDeepForeground: string;
  /** Teinte claire : fonds de pastilles. */
  brandSoft: string;
  /** Accent — aligné sur `brand`. */
  accent: string;
  /** Succès / validation. */
  success: string;
  /** Erreur / destruction. */
  danger: string;
  /** Surface de carte, panneau, modale. */
  surface: string;
  /** Filet discret (séparateurs légers). */
  hairline: string;
  /** Filet marqué (bordures de cartes). */
  hairlineStrong: string;
  /** Bouton principal : inverse de la page. */
  ink: string;
  /** Texte posé sur `ink`. */
  inkForeground: string;
  /** Texte très atténué (placeholders, métadonnées). */
  muted: string;
  /** Pointillé de fond de carte. */
  mapDot: string;
}

export const lightPalette: ThemePalette = {
  warmWhite: '#FAF7F5',
  secondaryBg: '#F5F5F4',
  primaryText: '#111111',
  secondaryText: '#6B7280',
  brand: '#A8FF35',
  brandDeep: '#2F52E0',
  brandDeepForeground: '#FFFFFF',
  brandSoft: '#E4EAFB',
  accent: '#A8FF35',
  success: '#22C55E',
  danger: '#DC2626',
  surface: '#FFFFFF',
  hairline: 'rgba(0, 0, 0, 0.05)',
  hairlineStrong: 'rgba(0, 0, 0, 0.1)',
  ink: '#111111',
  inkForeground: '#FFFFFF',
  muted: '#9CA3AF',
  mapDot: '#e5e5e5',
};

export const darkPalette: ThemePalette = {
  warmWhite: '#0D0F13',
  secondaryBg: '#191D24',
  primaryText: '#F3F4F6',
  secondaryText: '#9AA4AF',
  brand: '#A8FF35',
  brandDeep: '#2F52E0',
  brandDeepForeground: '#FFFFFF',
  brandSoft: '#1E2A44',
  accent: '#A8FF35',
  success: '#22C55E',
  danger: '#EF4444',
  surface: '#14181F',
  hairline: 'rgba(255, 255, 255, 0.09)',
  hairlineStrong: 'rgba(255, 255, 255, 0.16)',
  ink: '#F3F4F6',
  inkForeground: '#0D0F13',
  muted: '#6B7280',
  mapDot: 'rgba(255, 255, 255, 0.06)',
};

/**
 * Familles typographiques. Le web les charge en webfonts, le mobile bundle
 * les .ttf dans `assets/fonts` — mêmes familles, mêmes graisses.
 */
export const typography = {
  /** Titres — Cabinet Grotesk. */
  display: 'Cabinet Grotesk',
  /** Corps de texte — Satoshi. */
  body: 'Satoshi',
  /** Interlettrage des titres (web : `letter-spacing`). */
  displayTracking: '-0.03em',
} as const;

export const palettes = { light: lightPalette, dark: darkPalette } as const;

export type ThemeName = keyof typeof palettes;
