/**
 * Décision pure du réparateur géographique.
 *
 * Le reverse-géocodage ne suffit pas : quand les coordonnées pointent vers
 * un homonyme lointain, il décrit fidèlement le mauvais pin. La preuve de
 * l'audit (`isOutlier`) est donc prioritaire sur le pays renvoyé par Mapbox.
 */
export function planGeoRepair({
  declaredCountry,
  reverseCountry,
  isOutlier,
  forwardDeclared,
  forwardReverse,
}) {
  const declared = normalizeCountry(declaredCountry);
  const reverse = normalizeCountry(reverseCountry);

  if (isOutlier) {
    if (
      declared &&
      forwardDeclared?.country === declared &&
      Array.isArray(forwardDeclared.coords) &&
      forwardDeclared.coords.length === 2 &&
      forwardDeclared.coords.every(Number.isFinite)
    ) {
      return { kind: 'coordinates', coords: forwardDeclared.coords };
    }
    return { kind: 'refuse', reason: 'outlier-without-safe-target' };
  }

  if (!reverse) return { kind: 'refuse', reason: 'reverse-geocoding-failed' };
  if (reverse === declared) return { kind: 'none' };
  if (forwardReverse?.country === reverse) return { kind: 'country', country: reverse };
  return { kind: 'refuse', reason: 'country-evidence-conflict' };
}

function normalizeCountry(value) {
  const code = String(value ?? '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}
