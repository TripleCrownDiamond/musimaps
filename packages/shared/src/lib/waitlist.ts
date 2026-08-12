/**
 * Position d'attente stable affichée après une inscription.
 *
 * Cette valeur était calculée uniquement côté web. La garder dans le socle
 * assure qu'un même email reçoit le même numéro sur le web et le mobile.
 */
export function waitlistPositionFor(email: string): number {
  const base = 1247;
  let hash = 0;
  for (const char of email) {
    hash = (hash * 31 + char.charCodeAt(0)) % 500;
  }
  return base + hash;
}
