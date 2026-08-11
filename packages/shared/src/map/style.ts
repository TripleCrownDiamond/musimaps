/**
 * Charte visuelle de la carte — recette UNIQUE pour le web et le mobile.
 *
 * Les deux plateformes teintaient les frontières avec le même `rgba(47, 82,
 * 224, …)` recopié à la main, alors que c'est le bleu de marque et qu'il vit
 * dans les tokens. Pire : le web ÉPURAIT la carte (routes et labels
 * secondaires masqués) et le mobile non — la même carte n'avait pas du tout
 * la même densité selon la plateforme.
 *
 * Ce module ne dépend d'aucun moteur de rendu : il décrit quelles couches
 * garder, lesquelles masquer, et de quelle couleur peindre les frontières.
 * Chaque plateforme applique la recette avec son API (`setPaintProperty` /
 * `setLayoutProperty` côté mapbox-gl, mutation du styleJSON côté @rnmapbox).
 */
import { darkPalette, lightPalette } from '../design/tokens';
import { hexToRgba } from './index';

export type MapTheme = 'light' | 'dark';

/**
 * Seules lignes conservées : les frontières nationales. Tout le reste
 * (routes, rails, cours d'eau, limites administratives internes) est masqué
 * en dessous du zoom rue — la musique doit rester au premier plan.
 */
export const KEEP_LINE_RE = /^admin-0-boundary(-bg|-disputed)?$/i;

/** Seuls labels conservés : pays, continents, états et grandes villes. */
export const KEEP_SYMBOL_RE =
  /^(country-label|continent-label|state-label|settlement-major-label)$/i;

/** Frontières nationales à peindre aux couleurs de la marque. */
export const BOUNDARY_RE = /^admin-0-boundary(-disputed)?$/i;

/** Zoom à partir duquel les lignes masquées (routes…) réapparaissent. */
export const DETAIL_LINES_ZOOM = 12;

/**
 * Couleur des frontières — dérivée du token de marque PRINCIPALE, plus
 * opaque en thème sombre pour rester lisible sur fond noir.
 */
export function boundaryColor(theme: MapTheme): string {
  const palette = theme === 'dark' ? darkPalette : lightPalette;
  return hexToRgba(palette.brandPrimary, theme === 'dark' ? 0.75 : 0.5);
}

/**
 * Halo atmosphérique du globe. Volontairement neutre (gris) : la carte reste
 * monochrome, seules les frontières portent l'identité.
 */
export const FOG: Record<MapTheme, Record<string, string | number>> = {
  light: {
    color: 'rgb(228, 231, 235)',
    'high-color': 'rgb(190, 197, 205)',
    'horizon-blend': 0.08,
    'space-color': 'rgb(240, 242, 245)',
    'star-intensity': 0,
  },
  dark: {
    color: 'rgb(12, 14, 18)',
    'high-color': 'rgb(28, 33, 40)',
    'horizon-blend': 0.06,
    'space-color': 'rgb(4, 5, 8)',
    'star-intensity': 0.15,
  },
};

/** Style Mapbox de base par thème. */
export const MAP_STYLE: Record<MapTheme, string> = {
  light: 'mapbox://styles/mapbox/light-v11',
  dark: 'mapbox://styles/mapbox/dark-v11',
};

/** Identifiant du style pour l'API REST (récupération du styleJSON). */
export const MAP_STYLE_ID: Record<MapTheme, string> = {
  light: 'light-v11',
  dark: 'dark-v11',
};

export interface StyleLayer {
  id: string;
  type: string;
  paint?: Record<string, unknown>;
  layout?: Record<string, unknown>;
  minzoom?: number;
}

export type LayerAction =
  | { kind: 'hide'; id: string; /** true si la couche revient au zoom détail. */ detail: boolean }
  | { kind: 'boundary'; id: string; color: string };

/**
 * Décide, pour chaque couche du style, ce qu'il faut en faire.
 *
 * Retourne des instructions plutôt que d'agir : le web les applique via
 * `setLayoutProperty` / `setPaintProperty`, le mobile en mutant le JSON
 * avant de le passer à la MapView. Une seule règle, deux applications.
 */
export function planStyleActions(layers: StyleLayer[], theme: MapTheme): LayerAction[] {
  const color = boundaryColor(theme);
  const actions: LayerAction[] = [];
  for (const layer of layers) {
    if (layer.type === 'line' && !KEEP_LINE_RE.test(layer.id)) {
      actions.push({ kind: 'hide', id: layer.id, detail: true });
    } else if (layer.type === 'symbol' && !KEEP_SYMBOL_RE.test(layer.id)) {
      actions.push({ kind: 'hide', id: layer.id, detail: false });
    }
    if (layer.type === 'line' && BOUNDARY_RE.test(layer.id)) {
      actions.push({ kind: 'boundary', id: layer.id, color });
    }
  }
  return actions;
}

/**
 * Applique la charte directement sur un styleJSON (chemin mobile).
 * Mute les couches et renvoie le style.
 */
export function applyBrandStyle(
  style: { layers?: StyleLayer[] },
  theme: MapTheme,
): { layers?: StyleLayer[] } {
  const layers = style.layers ?? [];
  for (const action of planStyleActions(layers, theme)) {
    const layer = layers.find((l) => l.id === action.id);
    if (!layer) continue;
    if (action.kind === 'boundary') {
      layer.paint = { ...layer.paint, 'line-color': action.color };
    } else if (action.detail) {
      // Lignes de détail (routes, rails, cours d'eau) : elles réapparaissent
      // au zoom rue, exactement comme côté web. `visibility` n'accepte pas
      // d'expression de zoom dans un styleJSON statique — `minzoom` le fait.
      layer.minzoom = Math.max(layer.minzoom ?? 0, DETAIL_LINES_ZOOM);
    } else {
      // Labels secondaires : masqués à tous les zooms.
      layer.layout = { ...layer.layout, visibility: 'none' };
    }
  }
  return style;
}
