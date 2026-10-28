/**
 * Test de charge k6 : des utilisateurs qui ouvrent l'app en même temps.
 *
 * Une itération = une ouverture de l'app par un utilisateur :
 *   - MODE=avant : comme les versions déjà installées — liste complète de
 *     la carte + scores de popularité à chaque ouverture ;
 *   - MODE=apres : avec le cache (00082) — numéro de version seulement ;
 *     la liste complète pour CACHE_MISS (5 %) des ouvertures (premier
 *     lancement, carte modifiée).
 * Puis une pause (l'utilisateur regarde la carte) avant la suivante.
 *
 * LECTURE SEULE : aucune vue, aucun appel IA — le test n'écrit rien en base
 * et ne coûte rien chez Mistral. Il consomme en revanche du quota de
 * données sortantes Supabase : rester sur des paliers modestes en gratuit.
 *
 * Lancement : `npm run load:test` (voir scripts/load-test/run.mjs).
 */
import http from 'k6/http'
import { check, sleep } from 'k6'
import { Trend } from 'k6/metrics'

const BASE = __ENV.SUPABASE_URL
const KEY = __ENV.SUPABASE_ANON_KEY
const MODE = __ENV.MODE === 'apres' ? 'apres' : 'avant'
const PEAK = Number(__ENV.PEAK || 100)
const CACHE_MISS = Number(__ENV.CACHE_MISS || 0.05)

const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Accept-Encoding': 'gzip',
  'Content-Type': 'application/json',
}

const RICH_SELECT =
  'id,name,genre,city,district,birthplace,country,flag,lat,lng,bio,image,source,platforms,socials,verified,claimed_by,events,followers,slug'

const openTime = new Trend('ouverture_app_ms', true)

export const options = {
  scenarios: {
    lancement: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: Math.round(PEAK / 4) },
        { duration: '60s', target: PEAK },
        { duration: '60s', target: PEAK },
        { duration: '20s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    ouverture_app_ms: ['p(95)<2000'],
  },
  summaryTrendStats: ['avg', 'med', 'p(95)', 'max'],
}

function mapArtists() {
  return http.get(
    `${BASE}/rest/v1/map_artists?select=${RICH_SELECT}&order=created_at.desc&limit=500`,
    { headers, tags: { requete: 'map_artists' } },
  )
}

export default function () {
  const started = Date.now()
  const responses = []

  if (MODE === 'apres') {
    responses.push(
      http.post(`${BASE}/rest/v1/rpc/map_artists_version`, '{}', { headers, tags: { requete: 'version' } }),
    )
    if (Math.random() < CACHE_MISS) responses.push(mapArtists())
  } else {
    responses.push(mapArtists())
  }
  responses.push(
    http.get(`${BASE}/rest/v1/artist_stats?select=artist_id,profile_views,pin_views`, {
      headers,
      tags: { requete: 'popularite' },
    }),
  )

  openTime.add(Date.now() - started)
  for (const res of responses) check(res, { 'HTTP 200': (r) => r.status === 200 })

  // L'utilisateur explore la carte avant de rouvrir / rafraîchir.
  sleep(5 + Math.random() * 10)
}
