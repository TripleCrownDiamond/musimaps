import { beforeEach, describe, expect, it } from 'vitest'
import { configureRuntime, type Storage } from '../runtime'
import {
  DEFAULT_LLM_CONFIG,
  fetchLlmConfig,
  normalizeLlmConfig,
  resetLlmConfigCache,
} from './llm'

const memoryStorage: Storage = {
  async get() {
    return null
  },
  async set() {},
  async remove() {},
}

beforeEach(() => {
  resetLlmConfigCache()
  configureRuntime({ supabase: null, storage: memoryStorage })
})

describe('normalizeLlmConfig', () => {
  it('applique les défauts et borne les étapes', () => {
    expect(normalizeLlmConfig({ enabled: false, model: '  mistral-large-latest  ', maxSteps: 99 })).toEqual({
      enabled: false,
      provider: 'mistral',
      model: 'mistral-large-latest',
      maxSteps: 12,
    })
  })

  it('ignore les valeurs invalides sans désactiver le moteur', () => {
    expect(normalizeLlmConfig({ provider: 'openai', model: '', maxSteps: 'nope' })).toEqual(
      DEFAULT_LLM_CONFIG,
    )
  })
})

describe('fetchLlmConfig', () => {
  it('retombe sur la configuration par défaut sans Supabase', async () => {
    await expect(fetchLlmConfig()).resolves.toEqual(DEFAULT_LLM_CONFIG)
  })

  it('lit la configuration publiée du CMS', async () => {
    const fakeSupabase = {
      from(table: string) {
        expect(table).toBe('site_content_public')
        return {
          select() {
            return {
              eq() {
                return {
                  async maybeSingle() {
                    return {
                      data: {
                        content: {
                          llm: { enabled: false, model: 'mistral-medium-latest', maxSteps: 4 },
                        },
                      },
                      error: null,
                    }
                  },
                }
              },
            }
          },
        }
      },
    }
    configureRuntime({ supabase: fakeSupabase as never, storage: memoryStorage })

    await expect(fetchLlmConfig()).resolves.toEqual({
      enabled: false,
      provider: 'mistral',
      model: 'mistral-medium-latest',
      maxSteps: 4,
    })
  })
})
