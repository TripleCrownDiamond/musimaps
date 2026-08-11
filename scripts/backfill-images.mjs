/**
 * Backfill des images : pour chaque artiste de la carte (map_artists) sans
 * photo, on cherche son image sur Wikipedia (résumé REST) et on met à jour
 * le profil via le RPC add_or_update_map_artist (aucune clé service requise).
 *
 * Usage : node scripts/backfill-images.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function loadEnv(file) {
  const out = {}
  if (!existsSync(file)) return out
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return out
}

const webEnv = loadEnv(path.join(root, 'apps', 'web', '.env.local'))
const url = webEnv.VITE_SUPABASE_URL
const key = webEnv.VITE_SUPABASE_ANON_KEY
if (!url || !key) {
  console.error('Manquant : VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (apps/web/.env.local).')
  process.exit(1)
}
const api = `${url.replace(/\/$/, '')}/rest/v1`
const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
}

async function fetchJson(fetchUrl) {
  const res = await fetch(fetchUrl, { headers: { Accept: 'application/json' } })
  if (!res.ok) return null
  return res.json()
}

/** Normalise un titre de page (minuscules, sans accents) pour comparer. */
function normTitle(s) {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .trim()
}

/** Résout l'image Wikipedia d'un artiste. */
async function wikipediaImage(name) {
  try {
    // 1) La page portant exactement le nom de l'artiste (cas le plus fiable).
    const direct = await fetchJson(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`,
    )
    const directImage = direct?.originalimage?.source ?? direct?.thumbnail?.source
    if (directImage) return directImage.split('?')[0]
    if (direct?.type === 'disambiguation') {
      // 2) Homonymie : recherche ciblée « Nom + musicien » en préférant le
      //    titre exact, puis tout article non-disambiguation.
      const q = encodeURIComponent(`${name} musician`)
      const search = await fetchJson(
        `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${q}` +
          `&gsrlimit=8&prop=pageprops%7Cinfo&format=json&origin=*`,
      )
      const pages = Object.values(search?.query?.pages ?? {})
      const ranked =
        pages.find((p) => normTitle(p.title) === normTitle(name)) ??
        pages.find((p) => p.title && !p.pageprops?.disambiguation && p.pageprops?.wikibase_item) ??
        pages.find((p) => p.title && !p.pageprops?.disambiguation)
      if (ranked?.title) {
        const summary = await fetchJson(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(ranked.title)}`,
        )
        const image = summary?.originalimage?.source ?? summary?.thumbnail?.source
        if (image) return image.split('?')[0]
      }
    }
    // 3) Repli : recherche par nom seul, préférence au titre exact.
    const search = await fetchJson(
      `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(name)}` +
        `&gsrlimit=8&prop=pageprops%7Cinfo&format=json&origin=*`,
    )
    const pages = Object.values(search?.query?.pages ?? {})
    const ranked =
      pages.find((p) => normTitle(p.title) === normTitle(name)) ??
      pages.find((p) => p.title && !p.pageprops?.disambiguation && p.pageprops?.wikibase_item) ??
      pages.find((p) => p.title && !p.pageprops?.disambiguation)
    if (!ranked?.title) return null
    const summary = await fetchJson(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(ranked.title)}`,
    )
    const image = summary?.originalimage?.source ?? summary?.thumbnail?.source
    return image ? image.split('?')[0] : null
  } catch {
    return null
  }
}

async function main() {
  const { data, error } = await fetch(`${api}/map_artists?select=id,name,image,lat,lng,city,country&image=is.null&limit=200`, {
    headers,
  })
    .then((r) => r.json())
    .then((d) => ({ data: d, error: null }))
    .catch((e) => ({ data: null, error: e.message }))

  if (error || !Array.isArray(data)) {
    console.error('Échec de la lecture map_artists :', error ?? 'pas de données')
    process.exit(1)
  }
  console.log(`${data.length} artiste(s) sans image.`)

  let done = 0
  let skipped = 0
  for (const artist of data) {
    const image = await wikipediaImage(artist.name)
    if (!image) {
      console.log(`  ✗ ${artist.name} : pas d'image Wikipedia trouvée`)
      skipped += 1
      continue
    }
    // On préserve TOUTES les valeurs existantes (lat/lng/city/country…) : le
    // RPC écrase lat/lng avec le payload, on ne doit donc jamais envoyer 0.
    const payload = {
      id: artist.id,
      name: artist.name,
      genre: '',
      city: artist.city ?? '',
      country: artist.country ?? '',
      flag: '',
      lat: artist.lat ?? 0,
      lng: artist.lng ?? 0,
      bio: '',
      image,
      source: 'musicbrainz',
      platforms: {},
      socials: {},
    }
    const res = await fetch(`${api}/rpc/add_or_update_map_artist`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ p_artist: payload }),
    })
    const body = res.ok ? await res.json().catch(() => null) : null
    if (res.ok && body?.ok) {
      console.log(`  ✓ ${artist.name} → image mise à jour`)
      done += 1
    } else {
      console.log(`  ✗ ${artist.name} : échec de la mise à jour (${res.status})`)
      skipped += 1
    }
    await new Promise((r) => setTimeout(r, 600))
  }
  console.log(`\nTerminé : ${done} mise(s) à jour, ${skipped} ignoré(s).`)
}

main()
