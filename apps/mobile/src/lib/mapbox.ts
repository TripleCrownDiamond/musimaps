/**
 * Token Mapbox public — SEUL point de lecture de l'environnement côté mobile.
 *
 * À définir dans `apps/mobile/.env.local` (jamais commité) :
 *   EXPO_PUBLIC_MAPBOX_TOKEN=pk.xxxxx
 *
 * ⚠️ Ne pas relire `process.env.EXPO_PUBLIC_MAPBOX_TOKEN` ailleurs. La valeur
 * était lue dans plusieurs écrans séparément ; le jour où
 * l'une change, l'autre ne suit pas et on obtient une carte qui s'affiche
 * avec une recherche de lieux muette.
 *
 * Pourquoi une constante et pas `getMapboxToken()` du socle partagé : ce
 * module est lu à l'IMPORT (`Mapbox.setAccessToken` au niveau module dans
 * ExploreScreen), donc avant que `App.tsx` ait pu appeler `configureRuntime`.
 * Le socle reste la source pour tout le code partagé ; ici on a besoin de la
 * valeur plus tôt que lui.
 */
export const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;

/** Un token public valide est présent (les clés `sk.` n'ont rien à faire ici). */
export const HAS_MAPBOX = Boolean(MAPBOX_TOKEN?.startsWith('pk.'));
