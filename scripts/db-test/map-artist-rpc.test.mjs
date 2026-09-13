/**
 * `add_or_update_map_artist` contre un vrai Postgres.
 *
 * Complète `scripts/map-artist-rpc.test.mjs` (lecture statique du SQL, dans
 * `npm run check`) en EXÉCUTANT la fonction, rôle par rôle :
 *   1. 00056 — reproduit la faille : anon renomme et déplace Zeynab ;
 *   2. 00066 — vérifie chaque règle (anon, authenticated, admin, service_role).
 *
 * Lancé par `npm run test:db` (scripts/db-test/run.mjs), qui démarre un
 * Postgres jetable dans Docker et fournit DB_URL. Hors de `check` : il faut
 * Docker. Ne jamais pointer DB_URL vers la production — le test vide
 * map_artists.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const migration = (file) => readFileSync(path.join(root, 'supabase', 'migrations', file), 'utf8');

const ADMIN = 'aaaaaaaa-0000-4000-8000-000000000001';
const USER = 'bbbbbbbb-0000-4000-8000-000000000002';
const OTHER = 'cccccccc-0000-4000-8000-000000000003';
const ZEYNAB = 'mb-a4f07ac8-8e9f-44d7-a2bb-cbb77a2f5694';

const client = new pg.Client({ connectionString: process.env.DB_URL });

/** Exécute une requête comme PostgREST : rôle + claims JWT, le temps d'une transaction. */
async function as(role, sub, sql, params = []) {
  await client.query('BEGIN');
  try {
    await client.query("SELECT set_config('request.jwt.claims', $1, true)", [
      JSON.stringify(sub ? { role, sub } : { role }),
    ]);
    await client.query(`SET LOCAL ROLE ${role}`);
    const res = await client.query(sql, params);
    await client.query('COMMIT');
    return res;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

const rpc = async (role, sub, payload) =>
  (await as(role, sub, 'SELECT public.add_or_update_map_artist($1::jsonb) AS r', [JSON.stringify(payload)]))
    .rows[0].r;

const row = async (id) =>
  (await client.query('SELECT * FROM public.map_artists WHERE id = $1', [id])).rows[0];

async function seed() {
  await client.query('TRUNCATE public.map_artists');
  await client.query(`UPDATE public.profiles SET display_name = '', city = ''`);
  // Zeynab telle que corrigée par 00065.
  await client.query(
    `INSERT INTO public.map_artists
       (id, name, genre, city, country, flag, lat, lng, bio, source, platforms, verified)
     VALUES ($1, 'Zeynab', 'Afropop', 'Cotonou', 'BJ', '🇧🇯', 6.373391, 2.4401, NULL,
             'musicbrainz', '{"spotify":"https://open.spotify.com/artist/curated"}', true)`,
    [ZEYNAB],
  );
  await client.query(
    `INSERT INTO public.map_artists (id, name, lat, lng, source)
     VALUES ('no-coords', 'Sans pin', NULL, NULL, 'waitlist')`,
  );
  await client.query(
    `INSERT INTO public.map_artists (id, name, city, lat, lng, source, claimed_by, claimed_at)
     VALUES ('claimed', 'Déjà revendiqué', 'Lagos', 6.5244, 3.3792, 'waitlist', $1, '2026-01-01')`,
    [OTHER],
  );
}

// Ce qu'un ré-import MusicBrainz — ou un appel anon malveillant — envoie.
const reimport = (extra = {}) => ({
  id: ZEYNAB,
  name: 'Zeynab Abib',
  genre: 'Gospel',
  city: 'Abidjan',
  country: 'CI',
  flag: '🇨🇮',
  lat: 5.320357,
  lng: -4.016107,
  bio: 'Chanteuse béninoise.',
  image: 'https://upload.wikimedia.org/zeynab.jpg',
  source: 'reimport',
  platforms: { spotify: 'https://open.spotify.com/artist/other', youtube: 'https://youtube.com/@zeynab' },
  socials: { instagram: 'https://instagram.com/zeynab' },
  ...extra,
});

async function assertZeynabCurated() {
  const z = await row(ZEYNAB);
  assert.equal(z.name, 'Zeynab');
  assert.equal(z.city, 'Cotonou');
  assert.equal(z.country, 'BJ');
  assert.equal(z.flag, '🇧🇯');
  assert.equal(z.lat, 6.373391);
  assert.equal(z.lng, 2.4401);
  assert.equal(z.source, 'musicbrainz');
  assert.equal(z.verified, true);
  return z;
}

before(async () => {
  await client.connect();
  await client.query(readFileSync(path.join(root, 'scripts', 'db-test', 'schema.sql'), 'utf8'));
  await client.query(`INSERT INTO auth.users VALUES ('${ADMIN}'), ('${USER}'), ('${OTHER}')`);
  await client.query(`INSERT INTO public.profiles (id) VALUES ('${ADMIN}'), ('${USER}'), ('${OTHER}')`);
  await client.query(`INSERT INTO public.admins VALUES ('${ADMIN}')`);
  await client.query(migration('00056_artist_district.sql'));
});

after(() => client.end());

test('00056 (avant) : anon renomme et déplace Zeynab — faille reproduite', async () => {
  await seed();
  const r = await rpc('anon', null, reimport());
  assert.equal(r.ok, true);
  const z = await row(ZEYNAB);
  assert.equal(z.name, 'Zeynab Abib');
  assert.equal(z.city, 'Abidjan');
  assert.equal(z.lat, 5.320357);
});

test('00066 s’applique sans erreur', async () => {
  await client.query(migration('00066_map_artist_preserve_curation.sql'));
});

test('anon : ré-import = enrichissement seul', async () => {
  await seed();
  const r = await rpc('anon', null, reimport());
  assert.deepEqual(r, { ok: true, id: ZEYNAB, updated: true });
  const z = await assertZeynabCurated();
  assert.equal(z.genre, 'Afropop', 'genre rempli ne doit pas changer');
  assert.equal(z.bio, 'Chanteuse béninoise.', 'bio vide remplie');
  assert.equal(z.image, 'https://upload.wikimedia.org/zeynab.jpg', 'image vide remplie');
  assert.deepEqual(z.platforms, {
    spotify: 'https://open.spotify.com/artist/curated',
    youtube: 'https://youtube.com/@zeynab',
  });
  assert.deepEqual(z.socials, { instagram: 'https://instagram.com/zeynab' });
});

test('authenticated non admin : même règle que anon', async () => {
  await seed();
  assert.equal((await rpc('authenticated', USER, reimport())).ok, true);
  await assertZeynabCurated();
});

test('anon : nouvel artiste inséré', async () => {
  await seed();
  const r = await rpc('anon', null, reimport({ id: 'mb-new', name: 'Nouveau' }));
  assert.deepEqual(r, { ok: true, id: 'mb-new', updated: false });
  const n = await row('mb-new');
  assert.equal(n.city, 'Abidjan');
  assert.equal(n.verified, false);
  assert.equal(n.claimed_by, null);
});

test('admin_override refusé à anon et à un compte non admin, ligne intacte', async () => {
  await seed();
  for (const [role, sub] of [['anon', null], ['authenticated', USER]]) {
    const r = await rpc(role, sub, reimport({ admin_override: true }));
    assert.deepEqual(r, { ok: false, error: 'override_forbidden' }, role);
  }
  const z = await assertZeynabCurated();
  assert.equal(z.bio, null);
});

test('claimed_by refusé à anon et à l’auto-revendication (trou de 00053)', async () => {
  await seed();
  assert.deepEqual(await rpc('anon', null, reimport({ claimed_by: USER })), {
    ok: false,
    error: 'claimed_by_forbidden',
  });
  assert.deepEqual(await rpc('authenticated', USER, reimport({ claimed_by: USER })), {
    ok: false,
    error: 'claimed_by_forbidden',
  });
  assert.equal((await row(ZEYNAB)).claimed_by, null);
});

test('admin + admin_override : écrasement complet', async () => {
  await seed();
  const r = await rpc('authenticated', ADMIN, reimport({ admin_override: true }));
  assert.equal(r.ok, true);
  const z = await row(ZEYNAB);
  assert.equal(z.name, 'Zeynab Abib');
  assert.equal(z.city, 'Abidjan');
  assert.equal(z.lat, 5.320357);
  assert.equal(z.source, 'reimport');
  assert.equal(z.genre, 'Gospel');
  assert.equal(z.platforms.spotify, 'https://open.spotify.com/artist/other');
  assert.equal(z.verified, true, 'verified jamais touché');
});

test('admin sans override : enrichissement seul aussi', async () => {
  await seed();
  assert.equal((await rpc('authenticated', ADMIN, reimport())).ok, true);
  await assertZeynabCurated();
});

test('service_role + admin_override : écrasement', async () => {
  await seed();
  assert.equal((await rpc('service_role', null, reimport({ admin_override: true }))).ok, true);
  assert.equal((await row(ZEYNAB)).city, 'Abidjan');
});

test('admin : conversion waitlist revendique un pin libre, jamais un pin déjà pris', async () => {
  await seed();
  assert.equal((await rpc('authenticated', ADMIN, reimport({ claimed_by: USER }))).ok, true);
  const z = await row(ZEYNAB);
  assert.equal(z.claimed_by, USER);
  assert.ok(z.claimed_at instanceof Date);
  const profile = (await client.query('SELECT display_name, city FROM public.profiles WHERE id = $1', [USER])).rows[0];
  assert.deepEqual(profile, { display_name: 'Zeynab', city: 'Cotonou' }, 'trigger 00032 déclenché avec le nom curé');

  const claimed = { id: 'claimed', name: 'X', lat: 1, lng: 1, claimed_by: USER };
  assert.equal((await rpc('authenticated', ADMIN, claimed)).ok, true);
  const c = await row('claimed');
  assert.equal(c.claimed_by, OTHER);
  assert.equal(c.claimed_at.toISOString(), new Date('2026-01-01').toISOString());

  assert.equal((await rpc('authenticated', ADMIN, { ...claimed, admin_override: true })).ok, true);
  assert.equal((await row('claimed')).claimed_by, USER);
});

test('ligne sans coordonnées : le bloc localisation est repris du payload', async () => {
  await seed();
  const r = await rpc('anon', null, reimport({ id: 'no-coords' }));
  assert.equal(r.ok, true);
  const n = await row('no-coords');
  assert.equal(n.name, 'Sans pin');
  assert.equal(n.lat, 5.320357);
  assert.equal(n.lng, -4.016107);
  assert.equal(n.city, 'Abidjan');
  assert.equal(n.country, 'CI');
  assert.equal(n.source, 'waitlist');
});

test('payloads invalides refusés sans erreur SQL', async () => {
  await seed();
  for (const bad of [
    reimport({ platforms: ['https://evil.example'] }),
    reimport({ socials: 'https://evil.example' }),
    reimport({ claimed_by: 'pas-un-uuid' }),
    reimport({ lat: 'abc' }),
    reimport({ lat: 95 }),
    reimport({ lng: -181 }),
    { id: ZEYNAB, lat: 1, lng: 1 },
  ]) {
    assert.deepEqual(await rpc('anon', null, bad), { ok: false, error: 'invalid_payload' }, JSON.stringify(bad));
  }
  await assertZeynabCurated();
});

test('admin_override non booléen : ignoré (enrichissement seul)', async () => {
  await seed();
  assert.equal((await rpc('authenticated', ADMIN, reimport({ admin_override: 'yes' }))).ok, true);
  await assertZeynabCurated();
});

test('EXECUTE : anon, authenticated, service_role oui ; autres rôles non', async () => {
  const q = `SELECT has_function_privilege($1, 'public.add_or_update_map_artist(jsonb)', 'EXECUTE') AS ok`;
  for (const role of ['anon', 'authenticated', 'service_role']) {
    assert.equal((await client.query(q, [role])).rows[0].ok, true, role);
  }
  assert.equal((await client.query(q, ['other_role'])).rows[0].ok, false);
});

test('repli addMapArtist (INSERT … ON CONFLICT DO NOTHING) en anon : pin intact', async () => {
  await seed();
  await as(
    'anon',
    null,
    `INSERT INTO public.map_artists (id, name, city, lat, lng)
     VALUES ($1, 'Hacked', 'Nowhere', 0, 0) ON CONFLICT (id) DO NOTHING`,
    [ZEYNAB],
  );
  await assertZeynabCurated();
});
