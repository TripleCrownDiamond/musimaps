/**
 * Historique de recherche — récent d'abord, dédupliqué, plafonné.
 *
 * Partagé web + mobile : le stockage sous-jacent est injecté via
 * `configureRuntime` (localStorage côté web, AsyncStorage côté mobile).
 */
import { getStorage, readJson } from '../runtime';

const KEY = 'musimaps.searchHistory';
const MAX = 8;

export async function getSearchHistory(): Promise<string[]> {
  const parsed = await readJson<unknown>(KEY, []);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((x): x is string => typeof x === 'string').slice(0, MAX);
}

/** Ajoute une requête en tête (dédupliquée, insensible à la casse). */
export async function addSearchHistory(query: string): Promise<string[]> {
  const q = query.trim();
  const current = await getSearchHistory();
  if (!q) return current;
  const next = [
    q,
    ...current.filter((item) => item.toLocaleLowerCase('fr') !== q.toLocaleLowerCase('fr')),
  ].slice(0, MAX);
  try {
    await getStorage().set(KEY, JSON.stringify(next));
  } catch {
    /* stockage indisponible : l'historique vit en mémoire pour la session */
  }
  return next;
}

export async function clearSearchHistory(): Promise<void> {
  try {
    await getStorage().remove(KEY);
  } catch {
    /* silencieux */
  }
}
