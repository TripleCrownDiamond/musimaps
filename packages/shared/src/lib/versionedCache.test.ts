import { describe, expect, it } from 'vitest'
import type { Storage } from '../runtime'
import { createVersionedCache } from './versionedCache'

function memoryStorage(): Storage & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    async get(k) {
      return data.get(k) ?? null
    },
    async set(k, v) {
      data.set(k, v)
    },
    async remove(k) {
      data.delete(k)
    },
  }
}

function setup(opts: { version?: number | null; rows?: string[] | null; storage?: Storage } = {}) {
  const state = {
    version: opts.version === undefined ? 1 : opts.version,
    rows: opts.rows === undefined ? ['a', 'b'] : opts.rows,
    clock: 0,
    versionCalls: 0,
    rowCalls: 0,
  }
  const storage = opts.storage ?? memoryStorage()
  const cache = createVersionedCache<string>(
    {
      key: 'k',
      fetchVersion: async () => {
        state.versionCalls += 1
        return state.version
      },
      fetchRows: async () => {
        state.rowCalls += 1
        return state.rows
      },
    },
    { storage: () => storage, now: () => state.clock, freshMs: 1000 },
  )
  return { cache, state, storage }
}

describe('createVersionedCache', () => {
  it('premier chargement : version puis liste, gardée en stockage', async () => {
    const { cache, state, storage } = setup()
    expect(await cache.get()).toEqual(['a', 'b'])
    expect(state).toMatchObject({ versionCalls: 1, rowCalls: 1 })
    expect(JSON.parse((await storage.get('k'))!)).toEqual({ version: 1, rows: ['a', 'b'] })
  })

  it('dans la fenêtre de fraîcheur : aucune requête', async () => {
    const { cache, state } = setup()
    await cache.get()
    state.clock = 999
    await cache.get()
    expect(state).toMatchObject({ versionCalls: 1, rowCalls: 1 })
  })

  it('version inchangée : seule la version est redemandée', async () => {
    const { cache, state } = setup()
    await cache.get()
    state.clock = 5000
    state.rows = ['changé mais même version']
    expect(await cache.get()).toEqual(['a', 'b'])
    expect(state).toMatchObject({ versionCalls: 2, rowCalls: 1 })
  })

  it('version changée : liste retéléchargée', async () => {
    const { cache, state } = setup()
    await cache.get()
    state.clock = 5000
    state.version = 2
    state.rows = ['c']
    expect(await cache.get()).toEqual(['c'])
    expect(state.rowCalls).toBe(2)
  })

  it('nouvelle ouverture de l’app : la liste vient du stockage si la version est la même', async () => {
    const storage = memoryStorage()
    await setup({ storage }).cache.get()
    const relaunch = setup({ storage, rows: ['ne doit pas être lu'] })
    expect(await relaunch.cache.get()).toEqual(['a', 'b'])
    expect(relaunch.state.rowCalls).toBe(0)
  })

  it('hors ligne : dernière liste connue', async () => {
    const storage = memoryStorage()
    await setup({ storage }).cache.get()
    const offline = setup({ storage, version: null, rows: null })
    expect(await offline.cache.get()).toEqual(['a', 'b'])
  })

  it('hors ligne au premier lancement : liste vide', async () => {
    expect(await setup({ version: null, rows: null }).cache.get()).toEqual([])
  })

  it('version indisponible (migration absente) : liste lue comme avant', async () => {
    const { cache, state } = setup({ version: null })
    expect(await cache.get()).toEqual(['a', 'b'])
    state.clock = 5000
    await cache.get()
    expect(state.rowCalls).toBe(2)
  })

  it('invalidate : la version est revérifiée tout de suite', async () => {
    const { cache, state } = setup()
    await cache.get()
    state.version = 2
    state.rows = ['nouveau']
    cache.invalidate()
    expect(await cache.get()).toEqual(['nouveau'])
  })

  it('appels simultanés : un seul chargement', async () => {
    const { cache, state } = setup()
    await Promise.all([cache.get(), cache.get(), cache.get()])
    expect(state).toMatchObject({ versionCalls: 1, rowCalls: 1 })
  })

  it('stockage corrompu ou en panne : ignoré', async () => {
    const storage = memoryStorage()
    storage.data.set('k', '{pas du json')
    expect(await setup({ storage }).cache.get()).toEqual(['a', 'b'])
    const broken: Storage = {
      get: async () => {
        throw new Error('quota')
      },
      set: async () => {
        throw new Error('quota')
      },
      remove: async () => undefined,
    }
    expect(await setup({ storage: broken }).cache.get()).toEqual(['a', 'b'])
  })
})
