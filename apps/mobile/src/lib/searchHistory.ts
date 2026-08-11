import AsyncStorage from '@react-native-async-storage/async-storage';

/** Historique de recherche (mobile) — récent d'abord, dédupliqué, max 8. */
const KEY = 'musimaps.searchHistory';
const MAX = 8;

export async function getSearchHistory(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === 'string').slice(0, MAX);
  } catch {
    return [];
  }
}

export async function addSearchHistory(query: string): Promise<string[]> {
  const q = query.trim();
  const current = await getSearchHistory();
  if (!q) return current;
  const next = [
    q,
    ...current.filter((item) => item.toLocaleLowerCase('fr') !== q.toLocaleLowerCase('fr')),
  ].slice(0, MAX);
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* stockage indisponible : historique en mémoire pour la session */
  }
  return next;
}

export async function clearSearchHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    /* silencieux */
  }
}
