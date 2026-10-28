/**
 * Cache « versionné » d'une liste lue en base : on ne retélécharge la liste
 * que si son numéro de version a changé.
 *
 * Coût par ouverture d'écran :
 *   - dans la fenêtre de fraîcheur (mémoire) : rien ;
 *   - sinon : une petite requête de version (quelques octets) ;
 *   - la liste complète seulement si la version a changé, ou au tout
 *     premier lancement.
 * Hors ligne (ou base injoignable), on rend la dernière liste gardée.
 *
 * Module pur : le stockage persistant et les deux requêtes sont injectés.
 */
import type { Storage } from '../runtime'

/** Une liste chargée reste fraîche ce temps-là sans même vérifier sa version. */
export const VERSIONED_CACHE_FRESH_MS = 5 * 60 * 1000

interface Persisted<T> {
  version: number | null
  rows: T[]
}

interface Entry<T> extends Persisted<T> {
  checkedAt: number
}

export interface VersionedCacheSource<T> {
  /** Clé de stockage persistant. */
  key: string
  /** Version courante, `null` si indisponible (RPC absent, hors ligne…). */
  fetchVersion: () => Promise<number | null>
  /** Liste complète, `null` en cas d'échec (≠ liste vide). */
  fetchRows: () => Promise<T[] | null>
}

export interface VersionedCache<T> {
  get(): Promise<T[]>
  /** Oublie la mémoire : le prochain `get` revérifie la version. */
  invalidate(): void
}

export function createVersionedCache<T>(
  source: VersionedCacheSource<T>,
  deps: { storage: () => Storage; now?: () => number; freshMs?: number },
): VersionedCache<T> {
  const now = deps.now ?? Date.now
  const freshMs = deps.freshMs ?? VERSIONED_CACHE_FRESH_MS
  let memory: Entry<T> | null = null
  // Plusieurs écrans montés ensemble (carte, découverte…) partagent le même
  // chargement au lieu de lancer chacun ses requêtes.
  let inflight: Promise<T[]> | null = null

  async function readPersisted(): Promise<Persisted<T> | null> {
    try {
      const raw = await deps.storage().get(source.key)
      if (!raw) return null
      const parsed = JSON.parse(raw) as Persisted<T>
      return Array.isArray(parsed?.rows) ? parsed : null
    } catch {
      return null
    }
  }

  async function persist(value: Persisted<T>): Promise<void> {
    try {
      await deps.storage().set(source.key, JSON.stringify(value))
    } catch {
      /* stockage plein ou refusé : la mémoire suffit pour la session */
    }
  }

  async function load(): Promise<T[]> {
    const version = await source.fetchVersion().catch(() => null)
    const known = memory ?? (await readPersisted())

    if (version !== null && known && known.version === version) {
      memory = { ...known, checkedAt: now() }
      return known.rows
    }

    const rows = await source.fetchRows().catch(() => null)
    if (rows === null) {
      // Base injoignable : dernière liste connue plutôt qu'une carte vide.
      // Pas de checkedAt : on retentera au prochain appel.
      return known?.rows ?? []
    }
    memory = { version, rows, checkedAt: now() }
    await persist({ version, rows })
    return rows
  }

  return {
    async get() {
      if (memory && now() - memory.checkedAt < freshMs) return memory.rows
      if (!inflight) {
        inflight = load().finally(() => {
          inflight = null
        })
      }
      return inflight
    },
    invalidate() {
      if (memory) memory = { ...memory, checkedAt: Number.NEGATIVE_INFINITY }
    },
  }
}
