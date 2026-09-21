/**
 * Règles partagées de localisation pour le globe web et mobile.
 *
 * Ce module reste pur : les applications injectent leur propre source de
 * position (navigator.geolocation ou expo-location), puis réutilisent les
 * mêmes délais, le même libellé et le même rayon de découverte.
 */
import { distanceKm, isValidCoordinate, type GeoLocatable } from './geo-consistency'
import type { Artist } from '../index'
import { countryByCode, countryByName, countryName, flagFor, geoCountryOf } from '../geo'

/** The same local navigation context backs both platform-specific panels. */
export interface MapPlace {
  kind: 'country' | 'city'
  name: string
  code: string
  flag: string
  artists: Artist[]
}

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

/**
 * Quartier en premier, ville en repli, puis pays si aucun niveau local n'est disponible.
 *
 * Un artiste porte un code ISO (« NG ») là où la recherche de lieu porte un
 * nom (« Nigeria ») : sans conversion, le même Lagos s'affichait
 * « Lagos, Nigeria » puis « Lagos, NG » selon le chemin emprunté.
 */
export function mapLocationLabel(
  location: Pick<MapLocation, 'district' | 'city' | 'country' | 'label'>,
  lang: 'fr' | 'en' = 'fr',
): string {
  const explicit = location.label?.trim()
  if (explicit) return explicit
  const country = location.country?.trim()
  const parts = [
    location.district,
    location.city,
    country && /^[A-Za-z]{2}$/.test(country) ? countryName(country.toUpperCase(), lang) : country,
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
  return parts.join(', ')
}

/**
 * Une destination musicale n'est jamais la position GPS de l'appareil.
 *
 * Le pays affiché est celui où se trouve la ville, comme le regroupement du
 * globe : un artiste de nationalité française posé à Dakar s'affichait
 * « Dakar, France » alors que la barre de lieu disait « Sénégal ». Le pays
 * déclaré reste utilisé quand la ville ne le contredit pas.
 */
export function artistMapLocation(artist: Artist): MapLocation {
  const declared = artist.country?.trim() ?? ''
  const geo = geoCountryOf(artist.city, declared)
  const declaredCode =
    declared.length === 2 ? declared.toUpperCase() : (countryByName(declared)?.code ?? countryByCode(declared)?.code)
  const country = geo && geo !== declaredCode ? geo : artist.country
  return { coordinates: artist.coordinates, district: artist.district, city: artist.city, country }
}

/** Contexte conservé après fermeture de fiche, commun aux deux écrans carte. */
export function mapLocationHeading(
  device: MapLocation | null,
  exploration: MapLocation | null,
  lang: 'fr' | 'en' = 'fr',
) {
  const location = exploration ?? device
  if (!location) return null
  // Un géocodage inverse en échec laisse une position sans ville ni pays.
  // L'en-tête disparaissait alors de l'écran, alors que la carte connaît la
  // position : on le garde, et l'app pose son propre libellé de repli.
  const label = mapLocationLabel(location, lang)
  return {
    label,
    captionKey: exploration ? 'globe.discovering' as const : 'loc.here' as const,
    descriptionKey: exploration ? 'globe.discoveringLocation' as const : 'loc.detected' as const,
  }
}

/** À la fermeture d'une fiche on conserve l'artiste et les voisins de SA zone. */
export function artistsInExploration(artists: Artist[], selected: Artist): Artist[] {
  const nearby = artistsNearLocation(artists, selected.coordinates)
  return [selected, ...nearby.filter((artist) => artist.id !== selected.id)]
}

/** Closing a Discover/search artist sheet restores a navigable area, not just
 * visible pins. Existing city/country routes keep their order and current index.
 * This pure transition has no GPS/camera side effect. */
export function explorationAfterArtistClose(artists: Artist[], selected: Artist, currentPlace: MapPlace | null) {
  const currentIndex = currentPlace?.artists.findIndex((artist) => artist.id === selected.id) ?? -1
  if (currentPlace && currentIndex >= 0) return { place: currentPlace, index: currentIndex }

  const code = geoCountryOf(selected.city, selected.country)
  const place: MapPlace = {
    kind: selected.city.trim() ? 'city' : 'country',
    name: selected.city.trim() || selected.country.trim(),
    code,
    flag: flagFor(code),
    artists: artistsInExploration(artists, selected),
  }
  return { place, index: 0 }
}

/**
 * Zone « autour de moi » : les artistes du rayon de découverte, du plus proche
 * au plus lointain. La découverte s'ouvre sur le premier, et les flèches de la
 * barre de lieu parcourent les suivants. `null` quand personne n'est à portée.
 */
export function nearbyExploration(artists: Artist[], location: MapLocation): MapPlace | null {
  const nearby = artistsNearLocation(artists, location.coordinates)
  const first = nearby[0]
  if (!first) return null
  const code = location.countryCode?.toUpperCase() || geoCountryOf(first.city, first.country)
  return {
    kind: 'city',
    name: location.city?.trim() || location.district?.trim() || first.city.trim(),
    code,
    flag: flagFor(code),
    artists: nearby,
  }
}

/** Zone d'une ville choisie dans Découvrir, ouverte sur son premier artiste. */
export function cityExploration(artists: Artist[], city: string): MapPlace | null {
  const wanted = city.trim().toLowerCase()
  const inCity = wanted ? artists.filter((artist) => artist.city.trim().toLowerCase() === wanted) : []
  const first = inCity[0]
  if (!first) return null
  const code = geoCountryOf(first.city, first.country)
  return { kind: 'city', name: first.city.trim(), code, flag: flagFor(code), artists: inCity }
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
