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

/**
 * HIÉRARCHIE DE MARQUE — la référence, telle qu'elle s'applique sur la landing.
 *
 *   PRINCIPALE  : le bleu #2F52E0. Boutons, texte de marque, icônes, liens,
 *                 tracés de frontières sur le globe. C'est la couleur qui
 *                 porte l'identité — 192 usages sur le web, 133 sur mobile.
 *   SECONDAIRE  : le vert lime #A8FF35. Accents, aplats, éléments graphiques,
 *                 mise en évidence ponctuelle — 124 usages web, 62 mobile.
 *
 * ⚠️ Les noms historiques sont trompeurs et le resteront tant qu'on ne les
 * aura pas renommés partout : `brand` contient le SECONDAIRE (lime) et
 * `brandDeep` contient le PRINCIPAL (bleu). Ils sont conservés parce que
 * ~600 sites d'appel en dépendent des deux côtés.
 *
 * ➜ Dans tout code nouveau, utiliser `brandPrimary` / `brandSecondary`.
 */
const BRAND_PRIMARY = '#2F52E0';
const BRAND_SECONDARY = '#A8FF35';
/** Blanc sur bleu — contraste ~6:1, identique en clair et en sombre. */
const BRAND_PRIMARY_FG = '#FFFFFF';

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
  /** ★ PRINCIPALE — bleu. Boutons, texte de marque, icônes, liens. */
  brandPrimary: string;
  /** ☆ SECONDAIRE — vert lime. Accents, aplats, mise en évidence. */
  brandSecondary: string;
  /** Texte posé sur la couleur principale. */
  brandPrimaryForeground: string;
  /** @deprecated Nom trompeur — vaut le SECONDAIRE (lime). Voir `brandSecondary`. */
  brand: string;
  /** @deprecated Nom trompeur — vaut la PRINCIPALE (bleu). Voir `brandPrimary`. */
  brandDeep: string;
  /** @deprecated Voir `brandPrimaryForeground`. */
  brandDeepForeground: string;
  /** Teinte claire de la principale : fonds de pastilles. */
  brandSoft: string;
  /** @deprecated Voir `brandSecondary`. */
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
  /**
   * Bouton principal : inverse de la page (noir sur clair, blanc sur sombre).
   * ⚠️ MORT côté web : aucune classe `bg-ink`/`text-ink`, aucun `var(--color-ink)`.
   * Tailwind l'élague donc du thème clair ; il ne survit que dans le bloc sombre.
   * Le mobile l'utilise (`colors.ink`). À trancher : rebrancher ou supprimer.
   */
  ink: string;
  /** Texte posé sur `ink`. Même statut que `ink` — voir ci-dessus. */
  inkForeground: string;
  /** Texte très atténué (placeholders, métadonnées). */
  muted: string;
  /** Pointillé de fond de carte. */
  mapDot: string;
  /** Terre principale du globe — reste sobre pour laisser les pins dominer. */
  mapLand: string;
  /** Eau du globe — déclinaison de la couleur principale bleue. */
  mapWater: string;
  /** Parcs et végétation — déclinaison de l'accent lime. */
  mapLandAccent: string;
  /** Espace autour du globe. */
  mapSpace: string;
  /** Brume atmosphérique au niveau de l'horizon. */
  mapFog: string;
  /** Sommet du halo atmosphérique — couleur principale de marque. */
  mapFogHigh: string;
  /** Labels majeurs de la carte. */
  mapLabel: string;
  /** Halo sous les labels majeurs. */
  mapLabelHalo: string;
}

export const lightPalette: ThemePalette = {
  warmWhite: '#FAF7F5',
  secondaryBg: '#F5F5F4',
  primaryText: '#111111',
  secondaryText: '#6B7280',
  brandPrimary: BRAND_PRIMARY,
  brandSecondary: BRAND_SECONDARY,
  brandPrimaryForeground: BRAND_PRIMARY_FG,
  brand: BRAND_SECONDARY,
  brandDeep: BRAND_PRIMARY,
  brandDeepForeground: BRAND_PRIMARY_FG,
  brandSoft: '#E4EAFB',
  accent: BRAND_SECONDARY,
  success: '#22C55E',
  danger: '#DC2626',
  surface: '#FFFFFF',
  hairline: 'rgba(0, 0, 0, 0.05)',
  hairlineStrong: 'rgba(0, 0, 0, 0.1)',
  ink: '#111111',
  inkForeground: '#FFFFFF',
  muted: '#9CA3AF',
  mapDot: '#e5e5e5',
  mapLand: '#F8F9F2',
  mapWater: '#DCE4FF',
  mapLandAccent: '#E7F8D1',
  mapSpace: '#EEF2FF',
  mapFog: '#D5DEFF',
  mapFogHigh: BRAND_PRIMARY,
  mapLabel: BRAND_PRIMARY,
  mapLabelHalo: '#F8F9F2',
};

export const darkPalette: ThemePalette = {
  warmWhite: '#0D0F13',
  secondaryBg: '#191D24',
  primaryText: '#F3F4F6',
  secondaryText: '#9AA4AF',
  brandPrimary: BRAND_PRIMARY,
  brandSecondary: BRAND_SECONDARY,
  brandPrimaryForeground: BRAND_PRIMARY_FG,
  brand: BRAND_SECONDARY,
  brandDeep: BRAND_PRIMARY,
  brandDeepForeground: BRAND_PRIMARY_FG,
  brandSoft: '#1E2A44',
  accent: BRAND_SECONDARY,
  success: '#22C55E',
  danger: '#EF4444',
  surface: '#14181F',
  hairline: 'rgba(255, 255, 255, 0.09)',
  hairlineStrong: 'rgba(255, 255, 255, 0.16)',
  ink: '#F3F4F6',
  inkForeground: '#0D0F13',
  muted: '#6B7280',
  mapDot: 'rgba(255, 255, 255, 0.06)',
  mapLand: '#0A1024',
  mapWater: '#142765',
  mapLandAccent: '#24351A',
  mapSpace: '#020615',
  mapFog: '#101D4F',
  mapFogHigh: BRAND_PRIMARY,
  mapLabel: BRAND_SECONDARY,
  mapLabelHalo: '#0A1024',
};

/**
 * Géométrie des markers et contrôles de carte — identique web/mobile.
 * Les valeurs web sont émises en variables CSS par `scripts/gen-tokens.mjs`;
 * React Native consomme directement cet objet.
 */
export const mapUi = {
  artistPinDiameter: 36,
  markerTouchWidth: 72,
  markerTouchHeight: 82,
  clusterMinWidth: 68,
  clusterRadius: 17,
  clusterPaddingX: 13,
  clusterPaddingY: 7,
  /**
   * Sous-cluster : un DISQUE, pas une pilule.
   *
   * Il valait `minWidth 44` + padding 11/6 pour un contenu d'un seul nombre,
   * soit une boîte de 44 × 26. Le rayon de 17 px étant plafonné à la moitié
   * de la hauteur par le moteur de rendu, les bouts devenaient entièrement
   * arrondis sur une boîte plus large que haute : un ovale. Une largeur et
   * une hauteur égales donnent le rond attendu.
   */
  subclusterDiameter: 40,
  selectedPinScale: 1.28,
  pinLabelWidth: 200,
  placeControlSize: 36,
} as const;

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

/**
 * Rayons de bordure, en pixels. Échelle de référence = celle du web
 * (Tailwind), où elle est déjà respectée : `rounded-full` 224 usages,
 * `2xl` 52, `3xl` 34, `xl` 26, `lg` 16, `md` 19, `sm` 5.
 *
 * ⚠️ Le mobile ne consomme pas encore cette échelle : il utilise sept
 * valeurs arbitraires hors grille (18, 20, 22, 23, 26, 27, 28 px) à côté
 * de celles qui correspondent (16 = 2xl, 24 = 3xl, 999 = full). Les
 * aligner change des pixels sur ~100 sites d'appel : c'est une tâche
 * d'alignement visuel à part, pas un partage de token.
 */
export const radii = {
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
  '2xl': 16,
  '3xl': 24,
  full: 9999,
} as const;

/**
 * Échelle d'espacement, en pixels — grille de 4, comme le web.
 *
 * ⚠️ Même remarque que pour `radii` : le mobile est hors grille (il emploie
 * 5, 7, 9, 11, 13, 15 px aussi bien que 4, 8, 12, 16, 20). À aligner dans
 * une passe visuelle dédiée.
 */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 48,
} as const;

export const palettes = { light: lightPalette, dark: darkPalette } as const;

export type ThemeName = keyof typeof palettes;
export type RadiusToken = keyof typeof radii;
export type SpacingToken = keyof typeof spacing;
