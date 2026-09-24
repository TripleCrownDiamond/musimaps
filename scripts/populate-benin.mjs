#!/usr/bin/env node
/**
 * Peuplement « scène béninoise » de la carte Musimaps.
 *
 * Sources de vérité (tout est VÉRIFIÉ par API avant insertion) :
 *   - Deezer API        → photo HD (1000×1000), lien artiste, nb de fans ;
 *   - iTunes Search/Lookup → lien Apple Music de l'artiste (artistLinkUrl) ;
 *   - Spotify oEmbed    → valide les URL d'artiste fournies (titre = nom) ;
 *   - Wikipédia (fr, puis en) → bio + photo de secours.
 *
 * Règles demandées :
 *   - JAMAIS d'ajout sans image (refus + rapport) ;
 *   - JAMAIS de lien de plateforme non vérifié par une API ;
 *   - villes : Cotonou partout SAUF Ouidah / Abomey / Porto-Novo / Parakou,
 *     défaut Cotonou quand la ville n'est pas dans ces 4 exceptions ;
 *   - aucun empilement de pins : district réel quand il est documenté
 *     (Vèdoko…), sinon le dés-empilement spirale du front répartit
 *     (packages/shared/src/map — ancrage district + séparation dense).
 *
 * Idempotent : relancer ne duplique rien (dédupe par nom normalisé et id
 * bj-<slug>) ; le RPC n'enrichit que les champs vides d'une ligne existante.
 *
 * Usage :
 *   node scripts/populate-benin.mjs            # tout
 *   node scripts/populate-benin.mjs --dry-run  # simulation sans écriture
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/* ---------------------------------------------------------------- */
/* Env                                                               */
/* ---------------------------------------------------------------- */
function loadEnv(file) {
  const out = {}
  if (!existsSync(file)) return out
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
  }
  return out
}
const envRoot = loadEnv(path.join(root, '.env'))
const webEnv = loadEnv(path.join(root, 'apps', 'web', '.env.local'))
const SUPABASE_URL = webEnv.VITE_SUPABASE_URL
const SUPABASE_KEY = webEnv.VITE_SUPABASE_ANON_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Manquant : VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (apps/web/.env.local).')
  process.exit(1)
}
const REST = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1`
const HEADERS = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' }
const UA = 'MusiMaps/1.0 (https://musimaps.com; benin curation script)'

const DRY_RUN = process.argv.includes('--dry-run')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/* ---------------------------------------------------------------- */
/* Données : 98 artistes (Kidjo + Zeynab déjà en base → enrichies)  */
/* Clés : COT Cotonou · PN Porto-Novo · OUI Ouidah · ABO Abomey · PAR Parakou */
/* ---------------------------------------------------------------- */
const CITIES = {
  COT: { city: 'Cotonou', lat: 6.373391, lng: 2.4401 },
  PN: { city: 'Porto-Novo', lat: 6.4969, lng: 2.6051 },
  OUI: { city: 'Ouidah', lat: 6.3611, lng: 2.0858 },
  ABO: { city: 'Abomey', lat: 7.1829, lng: 1.9919 },
  PAR: { city: 'Parakou', lat: 9.3372, lng: 2.6303 },
  POB: { city: 'Pobè', lat: 8.7833, lng: 3.5 },
  BOH: { city: 'Bohicon', lat: 7.1667, lng: 2.0833 },
  APL: { city: 'Aplahoué', lat: 7.1833, lng: 1.6833 },
  DJG: { city: 'Djougou', lat: 9.4667, lng: 1.6667 },
  COU: { city: 'Dogbo', lat: 6.9333, lng: 1.8167 },
}

const ARTISTS = [
  { name: 'Fanicko', key: 'COT', genre: 'R&B / Hip-hop / Afro-pop' },
  { name: 'Vano Baby', key: 'COT', genre: 'Hip-hop / Rap' },
  { name: 'Tyaf', key: 'COT', genre: 'Hip-hop / Rap' },
  { name: 'Bobo Wè', key: 'COT', genre: 'Gangan Trap / Rap' },
  { name: 'Yaaly Yakuza', key: 'COT', genre: 'Afrobeat / Afro-trap' },
  { name: 'Axel Merryl', key: 'COT', genre: 'Afro-pop / Afrobeat' },
  { name: 'Jospinto', key: 'OUI', genre: 'Salsa / Afro-cubain' },
  { name: 'D-Blue', key: 'COT', genre: 'Afro-urban / Rap' },
  { name: 'Sessimè', key: 'COT', genre: 'Afro-pop / World' },
  { name: 'Rabby Slo', key: 'OUI', genre: 'R&B / Afro-pop' },
  { name: 'Wily Mignon', key: 'PAR', genre: 'Noudjihou / Afrobeat', aliases: ['Willy Mignon'] },
  { name: 'Kiri Kanta', key: 'PAR', genre: 'Traditionnel / World' },
  { name: 'Mister Kam', key: 'COT', genre: 'Rap / Trap Soul' },
  { name: 'Star Feminine Band', key: 'COT', genre: 'Afro-pop / Highlife / Rock' },
  { name: 'Sagbohan Danialou', key: 'COT', genre: 'Traditionnel / Jazz / Afro' },
  { name: 'Wal Junior', key: 'PN', genre: 'Soukous / Zouk' },
  { name: 'Gaby Yonnah', key: 'PN', genre: 'Gospel / World' },
  { name: 'Ricos Campos', key: 'PN', genre: 'Traditionnel / Afro' },
  { name: 'Nel Oliver', key: 'PN', genre: 'Gospel / Reggae / Traditionnel' },
  { name: 'Wuzimu', key: 'PN', genre: 'Afro-pop / Hip-hop' },
  { name: 'JANIFI', key: 'PN', genre: 'Afro-pop' },
  { name: 'Semostar', key: 'PN', genre: 'Gospel / Afro-pop' },
  { name: 'Polo Orisha', key: 'PN', genre: 'World / Afro-fusion' },
  { name: 'Dénagan Janvier Honfo', key: 'PN', genre: 'Traditionnel / Percussions' },
  { name: 'Albert Hounga', key: 'PN', genre: 'Percussions / Traditionnel' },
  { name: 'Djôgbésè Bénin Band', key: 'PN', genre: 'World / Trad-fusion' },
  { name: 'Assia Brass Benin', key: 'PN', genre: 'Brass / Afrobeat' },
  { name: 'Chedrack Chacha', key: 'PN', genre: 'Rap / Urbain' },
  { name: 'Gopal Das', key: 'PN', genre: 'Slam / Spoken Word' },
  { name: 'Billy King', key: 'PN', genre: 'Pop' },
  { name: 'Horace Tempo', key: 'PN', genre: 'Électro / House' },
  { name: "Pépit'Arts", key: 'COT', genre: 'Percussions / Traditionnel' },
  { name: 'Don Bridoq', key: 'COT', genre: 'Rap' },
  { name: 'Sona', key: 'ABO', genre: 'Hip-hop' },
  { name: 'Bradley', key: 'COT', genre: 'Pop' },
  { name: 'JH2N', key: 'COT', genre: 'Musique urbaine' },
  { name: 'Kotafboy', key: 'COT', genre: 'Rap / Afro-trap' },
  { name: 'Miguel du Ciel', key: 'COT', genre: 'Gospel' },
  { name: 'Israël Fiogbe', key: 'COT', genre: 'Fusion' },
  { name: 'Mintonou Folksong du Bénin', key: 'COT', genre: 'Folk / World' },
  { name: 'Amiral Bass', key: 'COT', genre: 'Hip-hop' },
  { name: 'Faty', key: 'COT', genre: 'Afro-pop / World' },
  { name: 'Anna Tèko', key: 'COT', genre: 'Gospel / World' },
  { name: 'Oluwa Kêmy', key: 'COT', genre: 'Afro / Traditionnel' },
  { name: 'Stan Tohon', key: 'ABO', genre: 'Tchink System', aliases: ['Stan Tohon & The Tchink System'] },
  { name: 'Riss Cool', key: 'ABO', genre: 'Tchink System' },
  { name: 'Alèkpéhanhou', key: 'ABO', genre: 'Zinli / Traditionnel' },
  { name: 'First King', key: 'COT', genre: 'Rap' },
  { name: 'Blaaz', key: 'COT', genre: 'Rap / Hip-hop' },
  { name: 'Dibi Dobo', key: 'COT', genre: 'R&B / Hip-hop / Afro-pop' },
  { name: 'Nikanor', key: 'COT', genre: 'Afro-pop / R&B' },
  { name: 'Nasty Nesta', key: 'COT', genre: 'Hip-hop / R&B' },
  { name: 'Diamant Noir', key: 'COT', genre: 'Rap / Hip-hop' },
  { name: 'Cotonou City Crew', key: 'COT', genre: 'Rap / Hip-hop / R&B' },
  { name: 'Trio Teriba', key: 'COT', genre: 'Traditionnel / World' },
  { name: 'Gangbé Brass Band', key: 'COT', genre: 'Jazz / Afrobeat / Brass' },
  { name: 'Sakpata Boys', key: 'COT', district: 'Vèdoko', genre: 'Hip-hop / Afro-rap / Vodoun / Reggae' },
  { name: 'Kmal Radji', key: 'COT', genre: 'Slam / Rap' },
  { name: 'Kemtaan', key: 'COT', genre: 'R&B / Hip-hop' },
  { name: 'Serge Ananou', key: 'COT', genre: 'Afro-jazz / Funk / World' },
  { name: 'Dossi', key: 'COT', genre: 'Afro-soul / Noudjihou' },
  { name: 'Enod', key: 'COT', genre: 'Rap / Hip-hop' },
  { name: 'Levinx', key: 'COT', genre: 'Rap / Afro-trap' },
  { name: 'Chaarlity', key: 'COT', genre: 'Afro-pop' },
  { name: 'B-Winzo', key: 'COT', genre: 'Rap / Hip-hop' },
  { name: 'Enock Assou', key: 'COT', genre: 'Hip-hop / Fusion' },
  { name: 'Didi Soddy', key: 'COT', genre: 'Rap' },
  { name: 'Itihé', key: 'COT', genre: 'Fusion / World' },
  { name: 'Yéwhé Yéton', key: 'COT', genre: 'Rap / Vodun Rock' },
  { name: 'Kènu Xhèviosso', key: 'COT', genre: 'Orijazz / Fusion' },
  { name: 'The Zioners', key: 'COT', genre: 'Reggae / Afrobeat' },
  { name: 'Gnonnas Pedro', key: 'COT', genre: 'Salsa / Agbadja / Highlife' },
  { name: 'G. G. Vikey', key: 'COT', genre: 'Folk / Chanson africaine' },
  { name: 'Lionel Loueke', key: 'COT', genre: 'Jazz / Jazz fusion' },
  { name: 'Don Métok', key: 'COT', genre: 'Tradi-pop', appleId: 1691638143 },
  { name: 'Patrick Ruffino', key: 'COT', genre: 'World / Afro-fusion' },
  { name: 'Koudy Fagbemi', key: 'COT', genre: 'Tradi-jazz / Blues / Soul / Rock' },
  { name: 'Tina Seglé', key: 'ABO', genre: 'Tradi-moderne' },
  { name: 'Black Dash', key: 'COT', genre: 'Hip-hop / Urbain' },
  { name: 'Fat-B', key: 'COT', genre: 'Rap', spotifyUrl: 'https://open.spotify.com/artist/1eqelTHd9mT0rXzglh4eF0' },
  { name: 'Naldo', key: 'COT', genre: 'Rap / Hip-hop', spotifyUrl: 'https://open.spotify.com/artist/1hG8vOPd9xZD1wKtoRxkUL' },
  { name: 'Sol Joyce', key: 'COT', genre: 'Reggae' },
  { name: 'Jean Adagbénon', key: 'COT', genre: 'Jazz / Mass-Go / Fusion', appleId: 1860767957 },
  { name: 'El Rego', key: 'PN', genre: 'Funk / Highlife / Afro-soul', aliases: ['El Rego et ses Commandos'] },
  { name: 'Antoine Dougbé', key: 'ABO', genre: 'Afro-Cavacha / Afrobeat / Funk', appleId: 323014159 },
  { name: 'Sahel La Cip', key: 'COT', genre: 'Rap / R&B', spotifyUrl: 'https://open.spotify.com/artist/1qlcaS1qaF07rpHZojcpmw' },
  { name: 'BMG Yari', key: 'COT', genre: 'Rap traditionnel / Hip-hop' },
  { name: 'Pélagie la Vibreuse', key: 'COT', genre: 'World / Tradi-moderne', spotifyUrl: 'https://open.spotify.com/artist/6QvcTsk7MBIPPHqK34J6Al' },
  { name: 'Afafa', key: 'COT', genre: 'R&B / Tchink System / Soul', spotifyUrl: 'https://open.spotify.com/artist/1S1zCWNqolpxokOU2p2LqI' },
  { name: 'Credo', key: 'COT', genre: 'Rap / Musique urbaine', spotifyUrl: 'https://open.spotify.com/artist/30Gjkjprc2OoADHa9LzBpL' },
  { name: 'Kaysee Edge Montejano', key: 'COT', genre: 'Rap / Hip-hop' },
  { name: 'Pépé Oléka', key: 'COT', genre: 'Afro-soul alternative', spotifyUrl: 'https://open.spotify.com/artist/2eewSwa0SHJGbNbJriawsx' },
  { name: 'Ardiess', key: 'COT', genre: 'Rap / R&B' },
  { name: 'Honoré Avolonto', key: 'ABO', genre: 'Afrobeat / World / Traditionnel', appleId: 323014202, spotifyUrl: 'https://open.spotify.com/artist/12a2wkJPQFbZ2thcv3ltUf' },
  { name: 'Eskill Lohento', key: 'COT', genre: 'Afrobeat / Afro-funk / Vodoun Funk' },
  { name: 'Vincent Ahéhéhinnou', key: 'ABO', genre: 'Afro-funk / Afrobeat / Highlife' },
  { name: 'Black Santiago', key: 'COT', genre: 'Afrobeat / Afro-cubain / Afro-funk' },
  { name: 'Mina Agossi', key: 'COT', genre: 'Jazz / World' },
  // Déjà en base → enrichissement de la ligne existante (id mb-* conservé).
  { name: 'Angélique Kidjo', key: 'COT', genre: 'World / Afro-pop', enrichOnly: true },
  { name: 'Zeynab', key: 'COT', genre: 'Afro-pop / Traditionnel', enrichOnly: true },
  // ----------------------------------------------------------------
  // Lot 102–132 : pôles hors Cotonou (Pobè, Bohicon, Aplahoué, Djougou,
  // Dogbo/Couffo). URL Spotify = uniquement des liens ARTISTE (les liens
  // album/track sont ignorés) ; Apple = id d'artiste vérifié par lookup.
  // ----------------------------------------------------------------
  { name: 'Shirazee', key: 'COT', genre: 'Afropop / Afro-fusion', spotifyUrl: 'https://open.spotify.com/artist/4SbV2TW0KQrpTgx50WicHh' },
  { name: 'Benin International Musical', key: 'COT', genre: 'Vodoun Rock / Rap / Afro-fusion', spotifyUrl: 'https://open.spotify.com/artist/5R1SZbG0GTBNp6p7NX62X9', aliases: ['Benin International Musical (BIM)', 'BIM'] },
  { name: "Eyo'Nlé Brass Band", key: 'PN', genre: 'Brass Band / Afro-groove / Jazz', appleId: 901030115, aliases: ['Eyonle Brass Band', 'Eyo Nle Brass Band'] },
  { name: 'Le Super Borgou de Parakou', key: 'PAR', genre: 'Afrobeat / Funk / Musique du Nord', spotifyUrl: 'https://open.spotify.com/artist/2SC77sECVqarBu8rG76Xgv', appleId: 510203883, aliases: ['Orchestre Super Borgou de Parakou'] },
  { name: "Picoby Band d'Abomey", key: 'ABO', genre: 'Afrobeat / Afro-funk', appleId: 420251424, aliases: ['Picoby Band'] },
  { name: 'Les Sympathics de Porto-Novo', key: 'PN', genre: 'Psychedelic Funk / Afrobeat', appleId: 1620207720 },
  { name: 'Ogassa', key: 'PN', genre: 'Afro-funk / Psychedelic Funk' },
  { name: 'Sêminvo Xlixè', key: 'COT', genre: 'Slam / Spoken Word', aliases: ['Seminvo Xlixe'] },
  { name: 'Ferry Djimmy', key: 'COT', genre: 'Afrobeat / Afro-funk / Funk Rock', appleId: 1609477247 },
  { name: 'Orchestre Les Volcans de Porto-Novo', key: 'PN', genre: 'Soukous / Salsa / Afrobeat', aliases: ['Les Volcans de Porto-Novo', 'Orchestre Les Volcans'] },
  { name: 'Black Dragons de Porto-Novo Dahomey', key: 'PN', genre: 'Afrobeat / Funk / Highlife', appleId: 280659188, aliases: ['Orchestre Black Dragons de Porto-Novo Dahomey'] },
  { name: "Renova-Band d'Abomey", key: 'ABO', genre: 'Rumba / Salsa / Cha-cha / Jerk', aliases: ['Renova Band', 'Renova-Band'] },
  { name: 'Super Star de Ouidah', key: 'OUI', genre: 'Afro-cubain / Boléro / Biguine', aliases: ['Super Star de Ouidah', 'Superstar de Ouidah'] },
  { name: 'Jah Baba', key: 'POB', genre: 'Afro-jazz / Afrobeat / Gospel / Juju', aliases: ['Jah Baba Benin'] },
  { name: 'Michel Pinheiro', key: 'POB', genre: 'Salsa / Afro-cubain / Jazz', aliases: ['Michel Pinheiro African Salsa Orchestra', 'Michel Pinheiro et son African Salsa Orchestra'] },
  { name: 'Ramou', key: 'BOH', genre: 'World / Afrobeat / R&B / Jazz-Blues', aliases: ['Ramou Benin'] },
  { name: 'Johnny Sourou', key: 'PN', genre: 'Gospel' },
  { name: 'Miss Espoir', key: 'PN', genre: 'Afro-pop / Traditionnel', aliases: ['Miss Espoir Benin'] },
  { name: 'Yves Sèdjro', key: 'PN', genre: 'R&B / Zouk / Afro-pop', aliases: ['Yves Sedjro'] },
  { name: 'Ya Salam', key: 'DJG', genre: 'Afro / Reggae / Traditionnel', appleId: 1537556253, aliases: ['Ya Salam Benin'] },
  { name: 'Cyano-Gêne', key: 'COT', genre: 'Rap / Hip-hop', aliases: ['Cyano-Gene', 'Cyano Gene'] },
  { name: 'Shamir MG', key: 'COT', genre: 'Hip-hop / Rap' },
  { name: 'Sèna Noble', key: 'COU', genre: 'Gogohoun / Tradi-moderne', aliases: ['Sena Noble'] },
  { name: 'Edia Sophie', key: 'ABO', genre: "Musique moderne d'inspiration traditionnelle", aliases: ['Sophie Edia'] },
  { name: 'Amy-Mako', key: 'PAR', genre: 'Traditionnel / Dendi / Griotte', aliases: ['Amy Mako'] },
  { name: 'Rabylad', key: 'PAR', genre: 'Afro-pop / Chanson' },
  { name: 'Kinay', key: 'PAR', genre: 'Rap / Afro-urbain', aliases: ['Kinay Benin'] },
  { name: 'Mama Franco', key: 'PAR', genre: 'Traditionnel / Rumba / Orchestre', aliases: ['Mama Franco Benin'] },
  { name: 'Dahouè Doto', key: 'APL', genre: 'Gogohoun / Traditionnel Adja', aliases: ['Dahoue Doto'] },
  { name: 'Joseph De Lapoche', key: 'PAR', genre: 'Tradi-moderne / Drill / Adjapiano' },
  { name: 'R-Bekir', key: 'BOH', genre: 'Rap / Hip-hop', aliases: ['R Bekir'] },
]

/* ---------------------------------------------------------------- */
/* Helpers                                                           */
/* ---------------------------------------------------------------- */
function normalize(value) {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}
function slugify(value) {
  return normalize(value).replace(/ +/g, '-').slice(0, 80)
}
const flagFor = (cc) =>
  String.fromCodePoint(0x1f1e6 + cc.charCodeAt(0) - 65, 0x1f1e6 + cc.charCodeAt(1) - 65)

async function getJson(url, opts = {}) {
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': UA, ...opts.headers },
    signal: opts.signal,
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url.slice(0, 90)}`)
  return res.json()
}

async function imageOk(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': UA } })
    const type = res.headers.get('content-type') ?? ''
    return res.ok && type.startsWith('image/')
  } catch {
    return false
  }
}

/* ---------------------------------------------------------------- */
/* Enrichissement par API                                            */
/* ---------------------------------------------------------------- */
async function deezerArtist(name) {
  const nName = normalize(name)
  const search = async (q) => {
    const data = await getJson(`https://api.deezer.com/search/artist?q=${encodeURIComponent(q)}&limit=10`)
    return (data?.data ?? []).filter((a) => a?.name && a?.id)
  }
  try {
    let results = await search(name)
    let pool = results.filter((a) => normalize(a.name) === nName)
    if (pool.length === 0) {
      // Repli : « <nom> benin » quand Deezer nomme l'artiste avec le pays.
      results = await search(`${name} benin`)
      pool = results.filter((a) => {
        const an = normalize(a.name)
        return (an.includes(nName) || nName.includes(an)) && an.length <= nName.length + 6
      })
    }
    const hit = (pool.length > 0 ? pool : []).reduce(
      (best, a) => ((a.nb_fan ?? 0) > (best?.nb_fan ?? -1) ? a : best),
      null,
    )
    if (!hit) return null
    return {
      id: hit.id,
      name: hit.name,
      nb_fan: hit.nb_fan ?? 0,
      picture: hit.picture_xl || hit.picture_big || '',
      link: hit.link || `https://www.deezer.com/artist/${hit.id}`,
    }
  } catch {
    return null
  }
}

/** iTunes : lien Apple Music vérifié (recherche, ou lookup par id fourni). */
async function appleMusicLink(name, appleId) {
  try {
    if (appleId) {
      const data = await getJson(`https://itunes.apple.com/lookup?id=${appleId}&entity=musicArtist`)
      const hit = (data?.results ?? []).find((r) => r.wrapperType === 'artist' && r.artistLinkUrl)
      return hit ? hit.artistLinkUrl : null
    }
    const data = await getJson(
      `https://itunes.apple.com/search?term=${encodeURIComponent(name)}&entity=musicArtist&limit=5`,
    )
    const nName = normalize(name)
    const hit = (data?.results ?? []).find((r) => normalize(r.artistName ?? '') === nName && r.artistLinkUrl)
    return hit ? hit.artistLinkUrl : null
  } catch {
    return null
  }
}

/** Spotify : n'accepte l'URL que si l'oEmbed confirme le nom de l'artiste. */
async function spotifyVerified(name, spotifyUrl) {
  if (!spotifyUrl) return null
  try {
    const data = await getJson(`https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyUrl)}`)
    const title = normalize(data?.title ?? '')
    const nName = normalize(name)
    return title && (title === nName || title.includes(nName) || nName.includes(title)) ? spotifyUrl : null
  } catch {
    return null
  }
}

/** Wikipédia : bio + image (fr d'abord, puis en ; titre exact puis recherche). */
async function wikipedia(name) {
  const nName = normalize(name)
  const summary = async (title, lang) => {
    const base = lang === 'fr' ? 'https://fr.wikipedia.org' : 'https://en.wikipedia.org'
    const data = await getJson(`${base}/api/rest_v1/page/summary/${encodeURIComponent(title)}`)
    const image = data?.originalimage?.source ?? data?.thumbnail?.source ?? ''
    return { bio: (data?.extract ?? '').slice(0, 400), image: image ? image.split('?')[0] : '' }
  }
  for (const lang of ['fr', 'en']) {
    try {
      const direct = await summary(name.replace(/ /g, '_'), lang)
      if (direct.image || direct.bio) return direct
    } catch { /* recherche */ }
    try {
      const base = lang === 'fr' ? 'fr.wikipedia.org' : 'en.wikipedia.org'
      const search = await getJson(
        `https://${base}/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(`"${name}"`)}` +
          `&gsrlimit=10&prop=pageprops&format=json&origin=*`,
      )
      const pages = Object.values(search?.query?.pages ?? {})
      const candidate = pages.find(
        (p) => p.title && !p.pageprops?.disambiguation && normalize(p.title) === nName,
      )
      if (candidate) return await summary(candidate.title.replace(/ /g, '_'), lang)
    } catch { /* langue suivante */ }
  }
  return { bio: '', image: '' }
}

/* ---------------------------------------------------------------- */
/* Upsert via RPC (idempotent, curation préservée)                   */
/* ---------------------------------------------------------------- */
async function upsert(payload) {
  const res = await fetch(`${REST}/rpc/add_or_update_map_artist`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ p_artist: payload }),
  })
  if (!res.ok) return { ok: false, error: `HTTP ${res.status}` }
  const body = await res.json().catch(() => null)
  return body?.ok ? { ok: true, updated: body.updated === true } : { ok: false, error: body?.error ?? 'rpc' }
}

/* ---------------------------------------------------------------- */
/* Main                                                              */
/* ---------------------------------------------------------------- */
async function main() {
  // Lignes existantes : dédoublonnage par nom normalisé + ids à enrichir.
  const db = new pg.Client({
    connectionString: `postgresql://postgres:${envRoot.SUPABASE_DB_PASSWORD || envRoot.DATABASE_PASSWORD}@db.sminkhihrfcvpggamdsy.supabase.co:5432/postgres`,
    ssl: { rejectUnauthorized: false },
  })
  await db.connect()
  const { rows } = await db.query('SELECT id, name, image FROM map_artists')
  const byName = new Map()
  for (const r of rows) byName.set(normalize(r.name), r)
  await db.end()

  console.log(`Peuplement Bénin — ${ARTISTS.length} entrées${DRY_RUN ? ' (DRY RUN)' : ''}\n`)
  const report = { added: [], enriched: [], skipped: [], errors: [] }
  const counters = { added: 0, enriched: 0 }

  /** Traite une entrée : enrichissement API, gate image, upsert. */
  async function processOne(a, index) {
    const label = `[${index + 1}/${ARTISTS.length}] ${a.name}`
    const existing = byName.get(normalize(a.name))
    if (existing && !a.enrichOnly) {
      console.log(`~ ${label} — déjà en base (« ${existing.name} »), ignoré`)
      report.skipped.push({ name: a.name, reason: 'duplicate' })
      return
    }
    const id = a.enrichOnly ? existing.id : `bj-${slugify(a.name)}`

    // Enrichissement en parallèle par artiste : Deezer, Wikipédia, liens.
    // Deezer essaie le nom réel puis les variantes documentées (Willy/Wily…).
    const [dz, wiki, spotify, apple] = await Promise.all([
      (async () => {
        for (const candidate of [a.name, ...(a.aliases ?? [])]) {
          const hit = await deezerArtist(candidate)
          if (hit) return hit
        }
        return null
      })(),
      wikipedia(a.name),
      spotifyVerified(a.name, a.spotifyUrl),
      appleMusicLink(a.name, a.appleId),
    ])

    // GATE IMAGE : jamais d'ajout sans photo vérifiée (HTTP + content-type).
    let image = (dz?.picture || wiki.image || '').split('?')[0]
    if (image && !(await imageOk(image))) image = ''
    if (!image) {
      console.log(`✗ ${label} — AUCUNE IMAGE VÉRIFIÉE, non ajouté (règle)`)
      report.skipped.push({ name: a.name, reason: 'no-image', deezer: dz?.name ?? null })
      return
    }

    const place = CITIES[a.key]
    const platforms = {}
    if (dz?.link) platforms.deezer = dz.link
    if (apple) platforms.apple_music = apple
    if (spotify) platforms.spotify = spotify

    const payload = {
      id,
      name: a.name,
      genre: a.genre,
      city: place.city,
      district: a.district ?? '',
      // Ville de naissance documentée ≠ ville du pin (Blaaz : né à Kano…).
      birthplace: a.birthplace ?? '',
      country: 'BJ',
      flag: flagFor('BJ'),
      lat: place.lat,
      lng: place.lng,
      bio: wiki.bio,
      image,
      followers: dz?.nb_fan ? String(dz.nb_fan) : '',
      source: 'catalog',
      platforms,
      socials: {},
    }

    if (DRY_RUN) {
      console.log(`[dry] ${label} — ${place.city}${a.district ? ` / ${a.district}` : ''} · img ✓ · fans ${dz?.nb_fan ?? '—'}`)
      report.added.push({ id, name: a.name, city: place.city })
      counters.added += 1
      return
    }

    const result = await upsert(payload)
    if (!result.ok) {
      console.log(`✗ ${label} — RPC : ${result.error}`)
      report.errors.push({ name: a.name, error: result.error })
      return
    }
    if (result.updated) {
      counters.enriched += 1
      report.enriched.push({ id, name: a.name })
      console.log(`↻ ${label} — enrichi`)
    } else {
      counters.added += 1
      report.added.push({ id, name: a.name, city: place.city, followers: payload.followers })
      console.log(`✓ ${label} — ${place.city}${a.district ? ` / ${a.district}` : ''} · fans ${dz?.nb_fan?.toLocaleString('fr-FR') ?? '—'} · ${Object.keys(platforms).join('+') || 'sans lien'}`)
    }
  }

  // Pool de workers : 6 artistes en vol (apis publiques le tolèrent largement).
  const CONCURRENCY = 6
  let cursor = 0
  async function worker() {
    while (cursor < ARTISTS.length) {
      const index = cursor++
      try {
        await processOne(ARTISTS[index], index)
      } catch (e) {
        report.errors.push({ name: ARTISTS[index].name, error: e.message })
        console.log(`✗ [${index + 1}] ${ARTISTS[index].name} — ${e.message}`)
      }
      await sleep(60)
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))

  try {
    mkdirSync(path.join(root, '.freebuff'), { recursive: true })
    writeFileSync(path.join(root, '.freebuff', 'populate-benin-report.json'), JSON.stringify(report, null, 2))
  } catch { /* rapport non bloquant */ }

  console.log(`\nTerminé : ${counters.added} ajouté(s), ${counters.enriched} enrichi(s), ${report.skipped.length} ignoré(s), ${report.errors.length} erreur(s).`)
  console.log('Rapport : .freebuff/populate-benin-report.json')
}

main().catch((e) => {
  console.error('Erreur fatale :', e.message)
  process.exit(1)
})
