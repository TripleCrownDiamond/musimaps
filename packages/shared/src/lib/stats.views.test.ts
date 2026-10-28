import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { configureRuntime } from '../runtime'
import {
  flushArtistViews,
  recordPinView,
  recordProfileView,
  VIEW_FLUSH_DELAY_MS,
  VIEW_FLUSH_MAX_PENDING,
} from './stats'

type Call = { fn: string; args: Record<string, unknown> }

function fakeSupabase(batchError: { code?: string; message: string } | null = null) {
  const calls: Call[] = []
  const client = {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args })
      return { data: null, error: fn === 'record_artist_views' ? batchError : null }
    },
  }
  const storage = new Map<string, string>()
  configureRuntime({
    supabase: client as unknown as SupabaseClient,
    storage: {
      get: async (k) => storage.get(k) ?? null,
      set: async (k, v) => void storage.set(k, v),
      remove: async (k) => void storage.delete(k),
    },
  })
  return calls
}

afterEach(() => {
  vi.useRealTimers()
})

describe('vues groupées', () => {
  it('rien n’est envoyé avant le délai, puis un seul appel regroupé', async () => {
    vi.useFakeTimers()
    const calls = fakeSupabase()
    await recordPinView('a1', { viewerKey: 'dev' })
    await recordPinView('a1', { viewerKey: 'dev' })
    await recordProfileView('a1', { viewerKey: 'dev' })
    await recordPinView('a2', { viewerKey: 'dev' })
    expect(calls).toHaveLength(0)

    await vi.advanceTimersByTimeAsync(VIEW_FLUSH_DELAY_MS)
    expect(calls).toHaveLength(1)
    expect(calls[0].fn).toBe('record_artist_views')
    expect(calls[0].args.p_viewer_key).toBe('dev')
    expect(calls[0].args.p_events).toEqual(
      expect.arrayContaining([
        { artist_id: 'a1', kind: 'pin', count: 2 },
        { artist_id: 'a1', kind: 'profile', count: 1 },
        { artist_id: 'a2', kind: 'pin', count: 1 },
      ]),
    )
  })

  it('un lot par pays de visiteur', async () => {
    const calls = fakeSupabase()
    await recordProfileView('a1', { viewerKey: 'dev', country: 'Benin' })
    await recordProfileView('a1', { viewerKey: 'dev', country: 'Togo' })
    await flushArtistViews()
    expect(calls.map((c) => c.args.p_country).sort()).toEqual(['Benin', 'Togo'])
  })

  it('envoi immédiat au-delà du plafond de vues en attente', async () => {
    const calls = fakeSupabase()
    for (let i = 0; i < VIEW_FLUSH_MAX_PENDING; i += 1) await recordPinView(`a${i}`, { viewerKey: 'dev' })
    await vi.waitFor(() => expect(calls).toHaveLength(1))
    expect((calls[0].args.p_events as unknown[]).length).toBe(VIEW_FLUSH_MAX_PENDING)
  })

  it('flush sans vue en attente : aucun appel', async () => {
    const calls = fakeSupabase()
    await flushArtistViews()
    expect(calls).toHaveLength(0)
  })

  // En dernier : le repli est mémorisé pour la session.
  it('RPC groupé absent (migration non appliquée) : repli vue par vue', async () => {
    const calls = fakeSupabase({ code: 'PGRST202', message: 'Could not find the function public.record_artist_views' })
    await recordPinView('a1', { viewerKey: 'dev' })
    await recordPinView('a1', { viewerKey: 'dev' })
    await flushArtistViews()
    expect(calls.map((c) => c.fn)).toEqual(['record_artist_views', 'record_artist_view', 'record_artist_view'])
    expect(calls[1].args).toEqual({ p_artist_id: 'a1', p_kind: 'pin', p_viewer_key: 'dev', p_country: null })

    await recordProfileView('a2', { viewerKey: 'dev' })
    await flushArtistViews()
    expect(calls.slice(3).map((c) => c.fn)).toEqual(['record_artist_view'])
  })
})
