#!/usr/bin/env node
/**
 * Conversion batch waitlist → carte / compte (après lancement).
 *
 * Lit les entrées non converties de `waitlist` :
 *   - profil artiste → géocodage Mapbox de la ville + ajout/mise à jour du pin
 *     sur la carte (RPC add_or_update_map_artist), puis marquage converted_at
 *     et map_artist_id.
 *   - profil amateur → envoi d'un email d'invitation (SMTP Hostinger) avec le
 *     lien de création de compte (Signup ?email=&role=melomane), puis marquage
 *     converted_at.
 *
 * Configuration : apps/web/.env.local (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY,
 * VITE_MAPBOX_TOKEN) + .env racine (SMTP_HOST, SMTP_USER, SMTP_PASS, MAIL_*).
 *
 * Usage :
 *   node scripts/waitlist-to-map.mjs            # exécute tout
 *   node scripts/waitlist-to-map.mjs --dry-run  # liste sans rien modifier
 *   node scripts/waitlist-to-map.mjs --no-email # convertit sans envoyer d'emails
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
const env = loadEnv(path.join(root, '.env'))

const supabaseUrl = webEnv.VITE_SUPABASE_URL
const anonKey = webEnv.VITE_SUPABASE_ANON_KEY
const mapboxToken = webEnv.VITE_MAPBOX_TOKEN
const dbPassword = env.DATABASE_PASSWORD

if (!supabaseUrl || !anonKey) {
  console.error('Manquant : VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (apps/web/.env.local).')
  process.exit(1)
}
if (!dbPassword) {
  console.error('Manquant : DATABASE_PASSWORD (racine .env) — lecture de la waitlist impossible (RLS admin).')
  process.exit(1)
}

// Lecture via le pooler Postgres (la table waitlist est en lecture admin-only).
const ref = supabaseUrl.replace(/^https:\/\/([a-z0-9]+)\..*$/, '$1')
const dbUrl = `postgresql://postgres.${ref}:${dbPassword}@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`

async function readWaitlist() {
  const pg = await import('pg')
  const client = new pg.default.Client({ connectionString: dbUrl })
  await client.connect()
  try {
    const { rows } = await client.query(
      `SELECT id::text AS id, email, profile, artist_name, city, genre, link,
              bio, photo, spotify, youtube, instagram, user_id,
              converted_at, map_artist_id, created_at
         FROM public.waitlist
        WHERE converted_at IS NULL
        ORDER BY created_at ASC`,
    )
    return rows
  } finally {
    await client.end()
  }
}

const dryRun = process.argv.includes('--dry-run')
const sendEmail = !process.argv.includes('--no-email')

async function api(pathname, options = {}) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${pathname}`, {
    ...options,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }
  if (!res.ok) {
    throw new Error(`${pathname} → ${res.status} ${text.slice(0, 300)}`)
  }
  return json
}

async function geocodeCity(place) {
  if (!mapboxToken || !place?.trim()) return null
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(place)}.json` +
    `?access_token=${mapboxToken}&limit=1&types=place,region,locality`
  const res = await fetch(url)
  if (!res.ok) return null
  const data = await res.json()
  const feature = data?.features?.[0]
  const center = feature?.center
  if (!center || center.length !== 2) return null
  const context = feature?.context ?? []
  const countryItem = context.find((c) => String(c.id ?? '').startsWith('country'))
  const country = String(countryItem?.short_code ?? '').toUpperCase()
  return { lng: center[0], lat: center[1], country, flag: country ? flagFor(country) : '🌍' }
}

function flagFor(code) {
  if (!code || code.length !== 2) return '🌍'
  const base = 0x1f1e6
  return String.fromCodePoint(base + code.charCodeAt(0) - 65, base + code.charCodeAt(1) - 65)
}

async function linkPinToAccount(pinId, email, userId) {
  try {
    const pg = await import('pg')
    const client = new pg.default.Client({ connectionString: dbUrl })
    await client.connect()
    try {
      // Rattache le pin : si la ligne waitlist a déjà un user_id, on l'utilise
      // directement ; sinon on résout l'uid du compte par email (auth.users).
      const { rows } = await client.query(
        `UPDATE public.map_artists m
            SET claimed_by = COALESCE($2::uuid, u.id),
                claimed_at = COALESCE(m.claimed_at, now())
           FROM auth.users u
          WHERE m.id = $1
            AND lower(u.email) = lower($3)
            AND m.claimed_by IS NULL
          RETURNING m.id`,
        [pinId, userId, email],
      )
      if (rows.length) {
        console.log(`     🔗 pin ${pinId} rattaché au compte ${email}`)
      }
      // Met aussi à jour user_id sur la ligne waitlist (tracé 00044).
      await client.query(
        `UPDATE public.waitlist w
            SET user_id = u.id
           FROM auth.users u
          WHERE lower(w.email) = lower($1)
            AND w.user_id IS NULL`,
        [email],
      )
    } finally {
      await client.end()
    }
  } catch (err) {
    // Best-effort : ne fait pas échouer la conversion.
    console.log(`     (lien compte ignoré : ${err.message})`)
  }
}

async function sendInviteEmail(to, link) {
  const subject = 'Votre compte Musimaps vous attend'
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto">
      <h2 style="color:#0a0a0a">Bienvenue sur Musimaps 🎵</h2>
      <p style="color:#333">Vous étiez sur notre liste d'attente : votre place est réservée.</p>
      <p style="color:#333">Créez votre compte pour retrouver vos artistes et votre univers :</p>
      <p style="margin:24px 0">
        <a href="${link}" style="background:#2f52e0;color:#fff;padding:14px 28px;border-radius:999px;text-decoration:none;font-weight:600">
          Créer mon compte
        </a>
      </p>
      <p style="color:#666;font-size:13px">Si le bouton ne fonctionne pas : <a href="${link}">${link}</a></p>
    </div>`
  const text = `Bienvenue sur Musimaps 🎵\n\nVous étiez sur notre liste d'attente : votre place est réservée.\nCréez votre compte ici : ${link}`

  const nodemailer = await import('nodemailer')
  const transport = nodemailer.default.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT ?? 465),
    secure: String(env.SMTP_PORT ?? '465') === '465',
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    tls: { rejectUnauthorized: false },
  })
  await transport.sendMail({
    from: `"${env.MAIL_FROM_NAME ?? 'Musimaps'}" <${env.MAIL_FROM ?? env.SMTP_USER}>`,
    to,
    subject,
    text,
    html,
  })
  await transport.close()
}

async function main() {
  console.log(dryRun ? '🔎 DRY RUN — aucune modification.' : '🚀 Conversion waitlist → carte / compte…')
  if (!sendEmail) console.log('📧 Emails désactivés (--no-email).')

  const rows = await readWaitlist()
  console.log(`\n${rows.length} entrée(s) non convertie(s).`)

  let artists = 0
  let amateurs = 0
  let failed = 0
  const now = new Date().toISOString()

  for (const row of rows) {
    const isArtist = row.profile === 'artiste' || row.profile === 'artist'
    const label = `${row.artist_name ?? row.email}`

    if (isArtist) {
      const name = (row.artist_name ?? '').trim()
      const city = (row.city ?? '').trim()
      if (!name || !city) {
        console.log(`  ⚠️  [artiste] ${row.email} — nom/ville manquants, ignoré`)
        failed += 1
        continue
      }
      const located = await geocodeCity(city)
      if (!located) {
        console.log(`  ⚠️  [artiste] ${label} — ville introuvable (« ${city} »), ignoré`)
        failed += 1
        continue
      }
      // Id stable : on retire d'abord le suffixe +alias (plus-addressing) pour
      // éviter la collision avec une adresse sans alias.
      const baseEmail = String(row.email).toLowerCase().split('+')[0]
      const stableId = `waitlist-${baseEmail.replace(/[^a-z0-9@.\-_]/g, '-')}`
      const platforms = {}
      if (row.spotify) platforms.spotify = row.spotify
      if (row.youtube) platforms.youtube = row.youtube
      const socials = {}
      if (row.instagram) socials.instagram = row.instagram

      if (dryRun) {
        console.log(`  ➜ [artiste] ${label} → ${city} (${located.lat.toFixed(3)}, ${located.lng.toFixed(3)})`)
        artists += 1
        continue
      }

      try {
        const result = await api('rpc/add_or_update_map_artist', {
          method: 'POST',
          body: JSON.stringify({
            p_artist: {
              id: stableId,
              name,
              genre: row.genre ?? '',
              city,
              country: located.country,
              flag: located.flag,
              lat: located.lat,
              lng: located.lng,
              bio: row.bio ?? '',
              image: row.photo ?? null,
              source: 'waitlist',
              platforms,
              socials,
            },
          }),
        })
        if (!result?.ok) {
          console.log(`  ⚠️  [artiste] ${label} — RPC refusé : ${result?.error ?? 'inconnu'}`)
          failed += 1
          continue
        }
        try {
          await api(`waitlist?id=eq.${encodeURIComponent(row.id)}`, {
            method: 'PATCH',
            body: JSON.stringify({ converted_at: now, map_artist_id: stableId }),
          })
        } catch (patchErr) {
          // Colonnes 00044 absentes : le pin existe, on continue.
          console.log(`     (marquage ignoré : ${patchErr.message})`)
        }
        // Lien compte ↔ carte : si la ligne a un user_id (ou qu'un compte
        // existe avec cet email), on rattache le pin au compte (claimed_by)
        // directement en SQL (le RPC add_or_update n'accepte claimed_by que
        // pour l'utilisateur lui-même ou un admin — le script est anon).
        await linkPinToAccount(stableId, String(row.email), row.user_id ?? null)
        console.log(`  ✅ [artiste] ${label} → pin ${stableId} (${city})`)
        artists += 1
      } catch (err) {
        console.log(`  ⚠️  [artiste] ${label} — ${err.message}`)
        failed += 1
      }
    } else {
      // Le lien doit pointer vers le site public, pas vers le projet Supabase.
      const invite = `https://musimaps.app/signup?email=${encodeURIComponent(row.email)}&role=melomane`
      if (dryRun) {
        console.log(`  ➜ [amateur] ${row.email} → invitation ${invite}`)
        amateurs += 1
        continue
      }
      try {
        if (sendEmail) {
          if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
            console.log(`  ⚠️  [amateur] ${row.email} — SMTP non configuré, lien : ${invite}`)
          } else {
            await sendInviteEmail(row.email, invite)
            console.log(`  ✅ [amateur] ${row.email} — invitation envoyée`)
          }
        } else {
          console.log(`  ➜ [amateur] ${row.email} — lien : ${invite}`)
        }
        try {
          await api(`waitlist?id=eq.${encodeURIComponent(row.id)}`, {
            method: 'PATCH',
            body: JSON.stringify({ converted_at: now }),
          })
        } catch {
          /* colonnes absentes */
        }
        amateurs += 1
      } catch (err) {
        console.log(`  ⚠️  [amateur] ${row.email} — ${err.message}`)
        failed += 1
      }
    }
  }

  console.log(`\n📊 Bilan : ${artists} artiste(s) → carte, ${amateurs} compte(s) invité(s), ${failed} échec(s).`)
  if (dryRun) console.log('(dry-run : rien n’a été modifié)')
}

main().catch((err) => {
  console.error('Échec :', err.message)
  process.exit(1)
})
