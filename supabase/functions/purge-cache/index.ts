/**
 * purge-cache — Purge le cache Hostinger (serveur + hCDN).
 *
 * Appelée depuis la page « Cache » de l'admin. Vérifie que l'appelant est un
 * administrateur (table admins), puis appelle l'API Hostinger.
 *
 * Déploiement (une fois) :
 *   npx supabase functions deploy purge-cache
 *   npx supabase secrets set HOSTINGER_API_TOKEN=xxx HOSTINGER_ACCOUNT_USERNAME=u123456789
 *     (HOSTINGER_DOMAIN optionnel, défaut musimaps.app)
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const TOKEN = Deno.env.get('HOSTINGER_API_TOKEN') ?? ''
const ACCOUNT = Deno.env.get('HOSTINGER_ACCOUNT_USERNAME') ?? ''
const DOMAIN = Deno.env.get('HOSTINGER_DOMAIN') ?? 'musimaps.app'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (!jwt) return json({ ok: false, error: 'Non connecté' }, 401)

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    const { data: userData } = await supabase.auth.getUser(jwt)
    const email = userData?.user?.email
    if (!email) return json({ ok: false, error: 'Session invalide' }, 401)

    const { data: admin } = await supabase
      .from('admins')
      .select('email')
      .eq('email', email)
      .maybeSingle()
    if (!admin) return json({ ok: false, error: 'Accès refusé : compte non administrateur' }, 403)

    if (!TOKEN || !ACCOUNT) {
      return json({
        ok: false,
        configured: false,
        error:
          'Jeton API Hostinger non configuré. Créez un jeton dans hPanel (en bas à gauche → API), puis : ' +
          'npx supabase secrets set HOSTINGER_API_TOKEN=… HOSTINGER_ACCOUNT_USERNAME=…',
      })
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
        502,
      )
    }
    return json({ ok: true, purged: true, detail: body.slice(0, 200) })
  } catch (err) {
    return json({ ok: false, error: err instanceof Error ? err.message : 'Erreur inconnue' }, 500)
  }
})
