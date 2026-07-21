/**
 * Token Mapbox public, lu depuis l'environnement Vite.
 * A definir dans musimaps-app/.env.local :
 *   VITE_MAPBOX_TOKEN=pk.xxxxx
 * Ce fichier n'est jamais commite (voir .gitignore).
 */
export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined

export const hasMapboxToken = Boolean(MAPBOX_TOKEN && MAPBOX_TOKEN.startsWith('pk.'))

/** Terre realiste (ocean bleu, relief) comme sur les maquettes. */
export const MAP_STYLE = 'mapbox://styles/mapbox/satellite-streets-v12'

/** Vue globe par defaut : Afrique de l'Ouest centree, globe entier visible. */
export const GLOBE_VIEW = {
  center: [2.4, 8] as [number, number],
  zoom: 0.75,
}

/** Zoom a partir duquel on considere qu'on est passe du globe a la carte. */
export const CITY_ZOOM = 11
