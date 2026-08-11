/**
 * Validation des coordonnées géographiques.
 *
 * Une coordonnée est utilisable si et seulement si elle est finie et dans les
 * bornes géographiques. [0, 0] (golfe de Guinée) est volontairement rejeté
 * quand il ne correspond à rien : c'est la valeur de repli des artistes sans
 * localisation, et elle projetait les pins en haut à gauche de l'écran.
 */
export function isValidCoordinate(c: unknown): c is [number, number] {
  if (!Array.isArray(c) || c.length !== 2) return false
  const [lng, lat] = c
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return false
  if (lat < -90 || lat > 90) return false
  if (lng < -180 || lng > 180) return false
  // [0,0] exact : coordonnée « par défaut », jamais un vrai lieu.
  if (lng === 0 && lat === 0) return false
  return true
}
