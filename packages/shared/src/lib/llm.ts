import { getSupabase } from '../runtime'

/** Fournisseur actuellement exécuté par les Edge Functions Musimaps. */
export type LlmProvider = 'mistral'

/** Bornes partagées de la boucle de deep-search. */
export const LLM_MIN_STEPS = 1
export const LLM_MAX_STEPS = 12

/** Configuration publique du moteur IA (aucune clé secrète). */
export interface LlmConfig {
  /** Interrupteur global lu par le web et l'application mobile. */
  enabled: boolean
  /** Fournisseur utilisé par les Edge Functions. */
  provider: LlmProvider
  /** Identifiant du modèle Mistral, par exemple `mistral-small-latest`. */
  model: string
  /** Nombre maximal d'étapes de l'agent à outils. */
  maxSteps: number
}

export const DEFAULT_LLM_CONFIG: LlmConfig = {
  enabled: true,
  provider: 'mistral',
  model: 'mistral-small-latest',
  maxSteps: 8,
}

const CONFIG_CACHE_TTL_MS = 60_000
let cached: { at: number; value: LlmConfig } | null = null
let pending: Promise<LlmConfig> | null = null

/** Nettoie une configuration CMS avant de la rendre aux deux apps. */
export function normalizeLlmConfig(raw: unknown): LlmConfig {
  const value = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const model = typeof value.model === 'string' ? value.model.trim().slice(0, 100) : ''
  const parsedSteps = Number(value.maxSteps)
  const maxSteps = Number.isFinite(parsedSteps)
    ? Math.min(LLM_MAX_STEPS, Math.max(LLM_MIN_STEPS, Math.round(parsedSteps)))
    : DEFAULT_LLM_CONFIG.maxSteps

  return {
    enabled: value.enabled !== false,
    // Le routage Mistral est le seul exécuteur disponible aujourd'hui. Une
    // valeur CMS inconnue ne doit jamais désactiver silencieusement l'app.
    provider: 'mistral',
    model: model || DEFAULT_LLM_CONFIG.model,
    maxSteps,
  }
}

/** Indique si cette configuration peut réellement être exécutée en production. */
export function isLlmEnabled(config: LlmConfig): boolean {
  return config.enabled && config.provider === 'mistral' && config.model.length > 0
}

/** Invalide le cache après une publication CMS, principalement utile aux tests. */
export function resetLlmConfigCache(): void {
  cached = null
  pending = null
}

/**
 * Lit la configuration publiée depuis le CMS.
 *
 * Le même helper est appelé par la recherche web et mobile. Les secrets
 * (`MISTRAL_API_KEY`, `MAPBOX_TOKEN`) restent exclusivement dans les Edge
 * Functions et ne transitent jamais par cette configuration publique.
 */
export async function fetchLlmConfig(): Promise<LlmConfig> {
  if (cached && Date.now() - cached.at < CONFIG_CACHE_TTL_MS) return cached.value
  if (pending) return pending

  pending = (async () => {
    const client = getSupabase()
    if (!client) return DEFAULT_LLM_CONFIG
    try {
      const { data, error } = await client
        .from('site_content_public')
        .select('content')
        .eq('key', 'settings')
        .maybeSingle()
      if (error) return DEFAULT_LLM_CONFIG
      const content = data?.content && typeof data.content === 'object'
        ? (data.content as Record<string, unknown>)
        : {}
      return normalizeLlmConfig(content.llm)
    } catch {
      return DEFAULT_LLM_CONFIG
    }
  })()

  try {
    const value = await pending
    cached = { at: Date.now(), value }
    return value
  } finally {
    pending = null
  }
}
