import type { SupabaseClient } from '@supabase/supabase-js'
import { afterEach, describe, expect, it } from 'vitest'
import { configureRuntime, type Storage } from '../runtime'
import { submitWaitlistEntry } from './waitlistSubmit'

const memoryStorage = (): Storage => {
  const data = new Map<string, string>()
  return {
    get: async (key) => data.get(key) ?? null,
    set: async (key, value) => void data.set(key, value),
    remove: async (key) => void data.delete(key),
  }
}

type Call = { kind: 'rpc' | 'upsert'; name: string; payload: Record<string, unknown> }

function fakeSupabase(rpcResult: { data?: unknown; error?: { code?: string; message: string } | null }, upsertErrors: Array<string | null> = []) {
  const calls: Call[] = []
  const client = {
    rpc: async (name: string, args: { p_entry: Record<string, unknown> }) => {
      calls.push({ kind: 'rpc', name, payload: args.p_entry })
      return { data: rpcResult.data ?? null, error: rpcResult.error ?? null }
    },
    from: (name: string) => ({
      upsert: async (row: Record<string, unknown>) => {
        calls.push({ kind: 'upsert', name, payload: row })
        const message = upsertErrors.shift() ?? null
        return { error: message ? { message } : null }
      },
    }),
  }
  configureRuntime({ supabase: client as unknown as SupabaseClient, storage: memoryStorage() })
  return calls
}

const entry = { email: 'awa@ex.com', profile: 'artiste', artist_name: 'Awa', country: 'Bénin', user_id: 'u-1' }

describe('submitWaitlistEntry', () => {
  afterEach(() => configureRuntime({ supabase: null, storage: memoryStorage() }))

  it('passe par le RPC sans transmettre de compte : le serveur prend la session', async () => {
    const calls = fakeSupabase({ data: { ok: true, duplicate: false } })
    await expect(submitWaitlistEntry(entry)).resolves.toEqual({ ok: true, duplicate: false })
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({ kind: 'rpc', name: 'submit_waitlist' })
    expect(calls[0].payload).not.toHaveProperty('user_id')
  })

  it('relaie les refus du serveur (quota, email invalide) sans repli', async () => {
    const calls = fakeSupabase({ data: { ok: false, error: 'rate_limited' } })
    await expect(submitWaitlistEntry(entry)).resolves.toEqual({ ok: false, error: 'rate_limited' })
    expect(calls).toHaveLength(1)
  })

  it('retombe sur l’upsert tant que la migration 00083 manque', async () => {
    const calls = fakeSupabase(
      { error: { code: 'PGRST202', message: 'Could not find the function public.submit_waitlist' } },
      ['column "country" does not exist'],
    )
    await expect(submitWaitlistEntry(entry)).resolves.toEqual({ ok: true, duplicate: false })
    expect(calls.map((c) => c.kind)).toEqual(['rpc', 'upsert', 'upsert'])
    expect(calls[1].payload).toMatchObject({ user_id: 'u-1', country: 'Bénin' })
    expect(calls[2].payload).not.toHaveProperty('country')
  })

  it('ne masque pas une autre erreur du RPC derrière le repli', async () => {
    const calls = fakeSupabase({ error: { code: '42501', message: 'permission denied' } })
    await expect(submitWaitlistEntry(entry)).resolves.toEqual({ ok: false, error: 'permission denied' })
    expect(calls).toHaveLength(1)
  })
})
