/**
 * Géolocalisation navigateur — reste côté web.
 *
 * `navigator.geolocation` n'existe pas en React Native natif : le mobile natif
 * passe par `expo-location`, tandis que son build web utilise le même
 * navigateur que cette surface. La permission reste donc propre à l'app.
 */
import {
  getMapboxToken,
  LOCATION_GEOCODE_TIMEOUT_MS,
  LOCATION_POSITION_TIMEOUT_MS,
  reverseGeocodeCoordinates,
  resolveWithin,
  type GeocodeReverseResult,
} from '@musimaps/shared'


export async function reverseGeocodeBrowser(): Promise<GeocodeReverseResult | null> {
  // Token pris dans le socle partagé, pas relu depuis l'environnement.
  type PosResult = GeolocationPosition | { denied: true } | null
  const pos = await resolveWithin<PosResult>(new Promise<PosResult>((resolve) => {
    if (!('geolocation' in navigator)) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      (p) => resolve(p),
      (err) => resolve(err && err.code === 1 ? { denied: true } : null),
      {
        enableHighAccuracy: true,
        timeout: LOCATION_POSITION_TIMEOUT_MS,
        maximumAge: 60_000,
      },
    )
  }), LOCATION_POSITION_TIMEOUT_MS + 1_000)
  if (!pos) return null
  if ('denied' in pos) return { city: '', countryCode: null, denied: true }
  const coordinates: [number, number] = [pos.coords.longitude, pos.coords.latitude]
  return resolveWithin(
    reverseGeocodeCoordinates(coordinates, getMapboxToken()),
    LOCATION_GEOCODE_TIMEOUT_MS,
  ) ?? { city: '', countryCode: null, coordinates }
}
