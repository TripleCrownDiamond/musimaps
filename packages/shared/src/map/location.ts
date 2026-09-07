/**
 * Règles partagées de localisation pour le globe web et mobile.
 *
 * Ce module reste pur : les applications injectent leur propre source de
 * position (navigator.geolocation ou expo-location), puis réutilisent les
 * mêmes délais, le même libellé et le même rayon de découverte.
 */
import { distanceKm, isValidCoordinate, type GeoLocatable } from './geo-consistency'

/** Une position de carte ne contient jamais d'adresse : seulement un libellé
 * public (quartier/ville) et les coordonnées nécessaires au centrage local. */
export interface MapLocation {
  coordinates: [longitude: number, latitude: number]
  district?: string
  city?: string
  country?: string
  countryCode?: string | null
  /** Libellé déjà formaté par l'application, si elle en possède un. */
  label?: string
}

/** La permission navigateur/native ne doit jamais bloquer l'écran. */
export const LOCATION_PERMISSION_TIMEOUT_MS = 10_000
/** Position GPS : le globe reste accessible si le capteur ne répond pas. */
export const LOCATION_POSITION_TIMEOUT_MS = 12_000
/** Lecture de la dernière position connue : réponse rapide sur mobile lorsque
 * le fournisseur GPS n'a pas encore livré de nouveau fix (notamment au
 * démarrage d'un émulateur). */
export const LOCATION_LAST_KNOWN_TIMEOUT_MS = 1_500
/** Géocodage inverse : la position reste exploitable même sans réseau. */
export const LOCATION_GEOCODE_TIMEOUT_MS = 6_000
/** Rayon de découverte autour de la position utilisateur. */
export const LOCATION_DISCOVERY_RADIUS_KM = 50

/** Résout une promesse dans un délai borné, avec null en cas de panne/timeout. */
export function resolveWithin<T>(task: Promise<T>, timeoutMs: number): Promise<T | null> {
  return new Promise((resolve) => {
    let settled = false
    const finish = (value: T | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(value)
    }
    const timer = setTimeout(() => finish(null), timeoutMs)
    task.then((value) => finish(value)).catch(() => finish(null))
  })
}

/** Quartier en premier, ville en repli, puis pays si aucun niveau local n'est disponible. */
export function mapLocationLabel(location: Pick<MapLocation, 'district' | 'city' | 'country' | 'label'>): string {
  const explicit = location.label?.trim()
  if (explicit) return explicit
  const parts = [location.district, location.city, location.country]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
  return parts.join(', ')
}

/** Artistes les plus proches dans le rayon de découverte de la position. */
export function artistsNearLocation<T extends GeoLocatable>(
  artists: T[],
  coordinates: [number, number],
  radiusKm: number = LOCATION_DISCOVERY_RADIUS_KM,
): T[] {
  if (!isValidCoordinate(coordinates) || !Number.isFinite(radiusKm) || radiusKm <= 0) return []
  return artists
    .filter((artist) => isValidCoordinate(artist.coordinates))
    .map((artist) => ({ artist, distance: distanceKm(coordinates, artist.coordinates) }))
    .filter(({ distance }) => distance <= radiusKm)
    .sort((a, b) => a.distance - b.distance)
    .map(({ artist }) => artist)
}
