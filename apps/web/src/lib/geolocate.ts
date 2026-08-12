/**
 * Géolocalisation navigateur — reste côté web.
 *
 * `navigator.geolocation` n'existe pas en React Native : le mobile passe par
 * `expo-location`. C'est la seule partie de `discovery` qui ne pouvait pas
 * remonter dans `@musimaps/shared`.
 */
import { countryCodeOfFeature, getMapboxToken, type GeocodeReverseResult } from '@musimaps/shared'


export async function reverseGeocodeBrowser(): Promise<GeocodeReverseResult | null> {
  // Token pris dans le socle partagé, pas relu depuis l'environnement.
  const token = getMapboxToken()
  type PosResult = GeolocationPosition | { denied: true } | null
  const pos = await new Promise<PosResult>((resolve) => {
    if (!('geolocation' in navigator)) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      (p) => resolve(p),
      (err) => resolve(err && err.code === 1 ? { denied: true } : null),
      { enableHighAccuracy: true, timeout: 8000 },
    )
  })
  if (!pos || !token) return null
  if ('denied' in pos) return { city: '', countryCode: null, denied: true }
  try {
    const [lng, lat] = [pos.coords.longitude, pos.coords.latitude]
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&limit=1&types=place,locality`,
    )
    if (!res.ok) return null
    const data = (await res.json()) as {
      features?: Array<{
        text?: string
        context?: Array<{ id?: string; short_code?: string }>
      }>
    }
    const feature = (data.features ?? [])[0]
    if (!feature?.text) return null
    return {
      city: feature.text,
      countryCode: countryCodeOfFeature(feature),
    }
  } catch {
    return null
  }
}