/**
 * purge-cache — Purge le cache Hostinger (serveur + hCDN).
 *
 * Appelée depuis la page « Cache » de l'admin. Vérifie que l'appelant est un
 * administrateur (table admins), puis appelle l'API Hostinger.
 *
 * Déploiement (une fois) :
 *   npx supabase functions deploy purge-cache
 *   npx supabase secrets set HOSTINGER_API_TOKEN=xxx HOSTINGER_ACCOUNT_USERNAME=u123456789
 *     (HOSTINGER_DOMAIN optionnel, défaut musimaps.com)
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const TOKEN = Deno.env.get('HOSTINGER_API_TOKEN') ?? ''
const ACCOUNT = Deno.env.get('HOSTINGER_ACCOUNT_USERNAME') ?? ''
const DOMAIN = Deno.env.get('HOSTINGER_DOMAIN') ?? 'musimaps.com'

const ALLOWED_ORIGIN = 'https://musimaps.com'

/**
 * CORS strict : le web (`https://musimaps.com`) est la seule origine acceptée
 * quand le navigateur envoie un en-tête Origin. Les appels mobiles (React
 * Native) n'envoient pas Origin — la vérification admin JWT suffit.
 */
function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const allowed = origin === ALLOWED_ORIGIN ? origin : ''
  return {
    ...(allowed ? { 'Access-Control-Allow-Origin': allowed } : {}),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

function json(payload: Record<string, unknown>, status = 200, cors: Record<string, string> = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  })
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (!jwt) return json({ ok: false, error: 'Non connecté' }, 401, cors)

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    const { data: userData } = await supabase.auth.getUser(jwt)
    const email = userData?.user?.email
    if (!email) return json({ ok: false, error: 'Session invalide' }, 401, cors)

    const { data: admin } = await supabase
      .from('admins')
      .select('email')
      .eq('email', email)
      .maybeSingle()
    if (!admin) return json({ ok: false, error: 'Accès refusé : compte non administrateur' }, 403, cors)

    if (!TOKEN || !ACCOUNT) {
      return json({
        ok: false,
        configured: false,
        error:
          'Jeton API Hostinger non configuré. Créez un jeton dans hPanel (en bas à gauche → API), puis : ' +
          'npx supabase secrets set HOSTINGER_API_TOKEN=… HOSTINGER_ACCOUNT_USERNAME=…',
      }, 200, cors)
    }

    const url =
      `https://api.hostinger.com/api/hosting/v1/accounts/${encodeURIComponent(ACCOUNT)}` +
      `/websites/${encodeURIComponent(DOMAIN)}/cache/clear`

    const res = await fetch(url, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    })
    const body = await res.text().catch(() => '')
    if (!res.ok) {
      return json(
        { ok: false, error: `Échec (HTTP ${res.status}) : ${body.slice(0, 300)}` },
        502, cors,
      )
    }
    return json({ ok: true, purged: true, detail: body.slice(0, 200) }, 200, cors)
  } catch (err) {
    return json({ ok: false, error: err instanceof Error ? err.message : 'Erreur inconnue' }, 500, cors)
  }
})
