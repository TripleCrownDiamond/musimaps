/**
 * Comparaison de versions et décision de mise à jour.
 *
 * Deux besoins distincts, souvent confondus :
 *   - INVITER à mettre à jour (une version plus récente existe) ;
 *   - EXIGER la mise à jour (la version installée n'est plus compatible —
 *     schéma de base changé, API retirée, faille corrigée).
 *
 * La différence se joue sur `minimum` : en dessous, l'app ne peut plus
 * fonctionner correctement et l'écran doit bloquer. Au-dessus mais en dessous
 * de `latest`, on propose sans jamais forcer.
 *
 * Aucune dépendance : `semver` pèse plus que les vingt lignes utiles ici, et
 * le socle doit rester pur. On accepte « 1.2.3 », « 1.2 », « 1 », et tolère un
 * suffixe (« 1.2.3-beta.1 ») en l'ignorant pour la comparaison.
 */

export type UpdateRequirement = 'none' | 'optional' | 'required';

/** Découpe une version en nombres, en ignorant un éventuel suffixe. */
function parts(version: string): number[] {
  const core = String(version ?? '')
    .trim()
    .split(/[-+]/)[0];
  if (!core) return [];
  return core.split('.').map((n) => {
    const value = Number.parseInt(n, 10);
    return Number.isFinite(value) ? value : 0;
  });
}

/**
 * Compare deux versions : négatif si `a < b`, zéro si égales, positif si
 * `a > b`. Les segments manquants valent 0 — « 1.2 » égale « 1.2.0 ».
 */
export function compareVersions(a: string, b: string): number {
  const left = parts(a);
  const right = parts(b);
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i += 1) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff < 0 ? -1 : 1;
  }
  return 0;
}

/** Vrai si `version` est une chaîne de version exploitable. */
export function isValidVersion(version: string): boolean {
  return /^\d+(\.\d+)*([-+].*)?$/.test(String(version ?? '').trim());
}

export interface UpdateCheck {
  /** Version installée sur l'appareil. */
  current: string;
  /** Dernière version publiée. Vide = aucune invitation. */
  latest?: string;
  /** En dessous, l'app doit bloquer. Vide = jamais bloquant. */
  minimum?: string;
}

/**
 * Décide s'il faut inviter ou contraindre à mettre à jour.
 *
 * Prudence délibérée : toute donnée douteuse rend `'none'`. Une version
 * distante mal saisie dans l'admin ne doit JAMAIS bloquer une app installée —
 * ce serait une panne totale déclenchée par une faute de frappe.
 */
export function updateRequirement({ current, latest, minimum }: UpdateCheck): UpdateRequirement {
  if (!isValidVersion(current)) return 'none';
  if (minimum && isValidVersion(minimum) && compareVersions(current, minimum) < 0) {
    return 'required';
  }
  if (latest && isValidVersion(latest) && compareVersions(current, latest) < 0) {
    return 'optional';
  }
  return 'none';
}
