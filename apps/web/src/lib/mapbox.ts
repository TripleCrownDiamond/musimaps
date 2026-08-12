/**
 * Token Mapbox public — SEUL point de lecture de l'environnement côté web.
 *
 * À définir dans `apps/web/.env.local` (jamais commité, voir .gitignore) :
 *   VITE_MAPBOX_TOKEN=pk.xxxxx
 *
 * ⚠️ Ne pas relire `import.meta.env.VITE_MAPBOX_TOKEN` ailleurs. La valeur
 * était lue à trois endroits différents ; le jour où l'un change (renommage,
 * token de dev, repli), les autres ne suivent pas et on se retrouve avec une
 * carte qui s'affiche mais une recherche de villes muette. `main.tsx` injecte
 * cette constante dans le socle partagé, et tout le code commun passe par
 * `getMapboxToken()`.
 */
export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined

export const hasMapboxToken = Boolean(MAPBOX_TOKEN && MAPBOX_TOKEN.startsWith('pk.'))

/** Vue globe par defaut : Afrique de l'Ouest centree, globe entier visible. */
export const GLOBE_VIEW = {
  center: [2.4, 8] as [number, number],
  zoom: 0.75,
}

/** Zoom a partir duquel on considere qu'on est passe du globe a la carte. */
export const CITY_ZOOM = 11
