/**
 * Quota quotidien des appels IA (Mistral), commun à ai_verify et
 * ai_artist_agent. Compteurs en base : public.consume_ai_quota (00082).
 *
 * - Compte connecté : AI_DAILY_LIMIT_USER appels par jour.
 * - Visiteur anonyme : AI_DAILY_LIMIT_IP appels par jour et par adresse IP
 *   (plus large : au Bénin, beaucoup d'abonnés mobiles partagent une IP).
 * - Tout le monde confondu : AI_DAILY_LIMIT_GLOBAL appels par jour — le
 *   plafond qui protège le budget quoi qu'il arrive.
 * - Administrateurs : pas de plafond individuel (le global s'applique).
 *
 * Plafonds réglables sans redéployer le code :
 *   npx supabase secrets set AI_DAILY_LIMIT_USER=40 AI_DAILY_LIMIT_IP=60 AI_DAILY_LIMIT_GLOBAL=2000
 *
 * Quota dépassé : la fonction répond 429 et l'app retombe sur sa
 * vérification locale (la recherche marche, sans l'étape IA).
 */
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

function limit(name: string, fallback: number): number {
  const value = Number(Deno.env.get(name))
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback
}

export const AI_DAILY_LIMIT_USER = limit('AI_DAILY_LIMIT_USER', 40)
export const AI_DAILY_LIMIT_IP = limit('AI_DAILY_LIMIT_IP', 60)
export const AI_DAILY_LIMIT_GLOBAL = limit('AI_DAILY_LIMIT_GLOBAL', 2000)

function jwtPayload(token: string): { role?: string; sub?: string } | null {
  try {
    const part = token.split('.')[1] ?? ''
    let payload = part.replace(/-/g, '+').replace(/_/g, '/')
    while (payload.length % 4) payload += '='
    return JSON.parse(atob(payload))
  } catch {
    return null
  }
}

/**
 * Qui appelle ? Un jeton d'utilisateur n'est cru que si PostgREST l'accepte
 * (signature vérifiée) : l'appel à is_admin() sert à la fois de vérification
 * et de test administrateur. Sinon, l'appelant est compté par adresse IP.
 */
/**
 * Adresse du visiteur. cf-connecting-ip est posé par Cloudflare devant
 * Supabase et écrase la valeur envoyée par le client ; le premier élément
 * de x-forwarded-for, lui, peut être forgé (un robot changerait d'« IP » à
 * chaque appel et n'aurait plus que le plafond global). Même ordre que
 * public.request_subject (00083).
 */
function clientIp(req: Request): string {
  return (
    req.headers.get('cf-connecting-ip')?.trim() ||
    req.headers.get('x-real-ip')?.trim() ||
    (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() ||
    'inconnue'
  )
}

async function caller(req: Request): Promise<{ subject: string; admin: boolean; anonymous: boolean }> {
  const ip = clientIp(req)
  const anonymous = { subject: `ip:${ip}`, admin: false, anonymous: true }
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  const payload = jwtPayload(token)
  if (payload?.role !== 'authenticated' || !payload.sub) return anonymous
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_admin`, {
      method: 'POST',
      headers: {
        apikey: req.headers.get('apikey') ?? '',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    })
    if (!res.ok) return anonymous
    return { subject: `user:${payload.sub}`, admin: (await res.json()) === true, anonymous: false }
  } catch {
    return anonymous
  }
}

/**
 * Consomme un appel IA. `true` = autorisé. En cas de panne du compteur
 * (migration absente, base injoignable), on laisse passer : la recherche ne
 * doit pas casser à cause du garde-fou.
 */
export async function consumeAiQuota(req: Request): Promise<boolean> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return true
  const who = await caller(req)
  const subjectLimit = who.admin ? 0 : who.anonymous ? AI_DAILY_LIMIT_IP : AI_DAILY_LIMIT_USER
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/consume_ai_quota`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_subject: who.subject,
        p_subject_limit: subjectLimit,
        p_global_limit: AI_DAILY_LIMIT_GLOBAL,
      }),
    })
    if (!res.ok) {
      console.warn(`consume_ai_quota HTTP ${res.status} : quota non appliqué`)
      return true
    }
    return (await res.json()) === true
  } catch (err) {
    console.warn('consume_ai_quota injoignable : quota non appliqué', err)
    return true
  }
}
