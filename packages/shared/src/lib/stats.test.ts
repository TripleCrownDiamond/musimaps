/**
 * Reprise des favoris locaux dans le compte connecté.
 *
 * Le mobile a longtemps gardé ses favoris dans AsyncStorage : à la première
 * connexion, ils doivent rejoindre la table `favorites` sans écraser ce qui
 * s'y trouve déjà, et sans jamais rien perdre. La table est simulée ici —
 * aucun appel réseau, aucune base réelle.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { configureRuntime, type Storage } from '../runtime'
import { fetchFavorites, mergeLocalFavorites } from './stats'

/** Lignes de la table `favorites` vues par l'utilisateur courant. */
let rows: { artist_id: string }[] = []
/** Force une erreur d'écriture, pour vérifier le comportement dégradé. */
let insertFails = false
/** Ids passés au dernier insert — pour vérifier qu'on n'écrit pas de doublon. */
let lastInsert: { artist_id: string }[] = []

function fakeSupabase() {
  return {
    from(table: string) {
      if (table !== 'favorites') throw new Error(`table inattendue : ${table}`)
      return {
        select: async () => ({ data: rows, error: null }),
        insert: async (payload: { artist_id: string }[]) => {
          lastInsert = payload
          if (insertFails) return { error: { message: 'insert refusé' } }
          rows = [...rows, ...payload]
          return { error: null }
        },
      }
    },
  }
}

const memoryStorage: Storage = {
  async get() {
    return null
  },
  async set() {},
  async remove() {},
}

beforeEach(() => {
  rows = []
  lastInsert = []
  insertFails = false
  // `fakeSupabase` n'implémente que la surface utilisée par ces fonctions.
  configureRuntime({
    supabase: fakeSupabase() as never,
    storage: memoryStorage,
  })
})

describe('mergeLocalFavorites', () => {
  it('pousse en base les favoris posés hors ligne', async () => {
    const merged = await mergeLocalFavorites(['a', 'b'])
    expect(merged).toEqual(['a', 'b'])
    expect(await fetchFavorites()).toEqual(['a', 'b'])
  })

  it('conserve les favoris déjà en base et ajoute les manquants', async () => {
    rows = [{ artist_id: 'web-1' }]
    const merged = await mergeLocalFavorites(['mobile-1'])
    expect(merged).toEqual(['web-1', 'mobile-1'])
  })

  it('n’écrit jamais un favori déjà présent', async () => {
    rows = [{ artist_id: 'a' }]
    await mergeLocalFavorites(['a'])
    expect(lastInsert).toEqual([])
    expect(await fetchFavorites()).toEqual([{ artist_id: 'a' }].map((r) => r.artist_id))
  })

  it('est idempotente — deux passages ne dupliquent rien', async () => {
    await mergeLocalFavorites(['a', 'b'])
    const second = await mergeLocalFavorites(['a', 'b'])
    expect(second).toEqual(['a', 'b'])
    expect(rows).toHaveLength(2)
  })

  it('ignore les ids vides', async () => {
    await mergeLocalFavorites(['', 'a'])
    expect(lastInsert).toEqual([{ artist_id: 'a' }])
  })

  it('sans favori local, ne touche pas à la base', async () => {
    rows = [{ artist_id: 'web-1' }]
    expect(await mergeLocalFavorites([])).toEqual(['web-1'])
    expect(lastInsert).toEqual([])
  })

  it('si l’écriture échoue, rend quand même l’union sans rien perdre', async () => {
    rows = [{ artist_id: 'web-1' }]
    insertFails = true
    const merged = await mergeLocalFavorites(['mobile-1'])
    // L'utilisateur garde ses favoris à l'écran ; la reprise sera retentée.
    expect(merged.sort()).toEqual(['mobile-1', 'web-1'])
  })

  it('sans Supabase, rend les favoris locaux inchangés', async () => {
    configureRuntime({ supabase: null, storage: memoryStorage })
    expect(await mergeLocalFavorites(['a'])).toEqual(['a'])
  })
})
