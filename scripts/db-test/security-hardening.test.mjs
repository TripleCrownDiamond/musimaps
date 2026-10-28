/**
 * Durcissement 00083 contre un vrai Postgres.
 *
 * Vérifie : pins publics (colonnes protégées, liens dangereux, quota de
 * nouveaux pins par visiteur, redécouverte gratuite), notify_discovery
 * qui ignore le texte du client, notify_artist_action borné, waitlist
 * fermée en mise à jour et submit_waitlist, quota d'envoi de photos,
 * compteurs inaccessibles au public malgré les droits par défaut (00084).
 *
 * Lancé par `npm run test:db -- security` (Docker). Ne jamais pointer
 * DB_URL vers la production.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const migration = (file) => readFileSync(path.join(root, 'supabase', 'migrations', file), 'utf8');

const AWA = 'aaaaaaaa-0000-4000-8000-00000000000a';
const KOFI = 'bbbbbbbb-0000-4000-8000-00000000000b';
const ADMIN = 'cccccccc-0000-4000-8000-00000000000c';

const client = new pg.Client({ connectionString: process.env.DB_URL });

/**
 * Requête comme PostgREST : rôle, claims JWT et en-têtes HTTP le temps
 * d'une transaction. `ip` remplit cf-connecting-ip.
 */
async function as(role, sub, sql, params = [], { ip, email } = {}) {
  await client.query('BEGIN');
  try {
    const claims = { role, ...(sub ? { sub } : {}), ...(email ? { email } : {}) };
    await client.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
    await client.query("SELECT set_config('request.headers', $1, true)", [
      JSON.stringify(ip ? { 'cf-connecting-ip': ip } : {}),
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
const value = async (...args) => Object.values((await as(...args)).rows[0])[0];
const rpcArtist = (role, sub, artist, opts) =>
  value(role, sub, 'SELECT public.add_or_update_map_artist($1::jsonb)', [JSON.stringify(artist)], opts);
const pin = (id, extra = {}) => ({ id, name: `Artiste ${id}`, lat: 6.37, lng: 2.39, city: 'Cotonou', ...extra });
const row = async (sql, params) => (await client.query(sql, params)).rows[0];

before(async () => {
  await client.connect();
  await client.query(readFileSync(path.join(root, 'scripts', 'db-test', 'schema.sql'), 'utf8'));
  await client.query(`
    INSERT INTO auth.users (id) VALUES ('${AWA}'), ('${KOFI}'), ('${ADMIN}');
    INSERT INTO public.admins (user_id) VALUES ('${ADMIN}');
    ALTER TABLE public.profiles ADD COLUMN favorite_genres jsonb;
    INSERT INTO public.profiles (id, display_name, city, favorite_genres) VALUES
      ('${AWA}', 'Awa', 'Cotonou, Benin', '["afrobeat"]'),
      ('${KOFI}', 'Kofi', 'Lomé', NULL);

    -- Socle waitlist (00003, hors dépôt) + colonnes de 00044.
    ALTER TABLE public.waitlist
      ADD COLUMN email text UNIQUE, ADD COLUMN profile text, ADD COLUMN artist_name text,
      ADD COLUMN city text, ADD COLUMN genre text, ADD COLUMN link text,
      ADD COLUMN created_at timestamptz NOT NULL DEFAULT now(),
      ADD COLUMN user_id uuid, ADD COLUMN converted_at timestamptz, ADD COLUMN map_artist_id text;
    GRANT SELECT, INSERT, UPDATE ON public.waitlist TO anon, authenticated;
    GRANT USAGE ON SEQUENCE public.waitlist_id_seq TO anon, authenticated;

    -- Stockage Supabase réduit à ce que touchent 00021 et 00083.
    CREATE SCHEMA storage;
    CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean,
      file_size_limit bigint, allowed_mime_types text[]);
    CREATE TABLE storage.objects (id bigserial PRIMARY KEY, bucket_id text, name text);
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    GRANT USAGE ON SCHEMA storage TO anon, authenticated;
    GRANT SELECT, INSERT ON storage.objects TO anon, authenticated;
    GRANT USAGE ON SEQUENCE storage.objects_id_seq TO anon, authenticated;

    -- Notifications (00029 + ref de 00064) et suivis.
    CREATE TABLE public.notifications (
      id bigserial PRIMARY KEY, user_id uuid NOT NULL, type text NOT NULL,
      artist_id text, artist_name text, city text, country text, message text, ref text,
      created_at timestamptz NOT NULL DEFAULT now());
    CREATE UNIQUE INDEX notifications_user_type_ref_idx
      ON public.notifications (user_id, type, ref) WHERE ref IS NOT NULL;
    CREATE TABLE public.follows (user_id uuid NOT NULL, artist_id text NOT NULL,
      PRIMARY KEY (user_id, artist_id));

    INSERT INTO public.map_artists (id, name, city, claimed_by) VALUES ('owned', 'Zeynab', 'Cotonou', '${KOFI}');

    -- Chemin SECURITY DEFINER légitime (comme link_waitlist_to_account).
    CREATE FUNCTION public.test_definer_claim(p_id text) RETURNS void
    LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
      UPDATE public.map_artists SET claimed_by = auth.uid(), claimed_at = now() WHERE id = p_id
    $$;
    GRANT EXECUTE ON FUNCTION public.test_definer_claim(text) TO authenticated;
  `);
  // Comme Supabase : toute nouvelle fonction du schéma public est exécutable
  // par anon et authenticated, en plus de public. Sans cette ligne, un
  // simple REVOKE … FROM public paraissait suffire (faille corrigée par 00084).
  await client.query('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated');
  for (const file of [
    '00021_waitlist_bio_photo_links.sql',
    '00022_waitlist_public_policies.sql',
    '00056_artist_district.sql',
    '00074_artist_birthplace.sql',
    '00075_add_birthplace_to_rpc.sql',
    '00083_security_hardening.sql',
    '00083_security_hardening.sql', // rejouable
    '00084_rate_limit_private.sql',
  ]) {
    await client.query(migration(file));
  }
});

after(async () => client.end());

test('insert direct : jamais vérifié ni revendiqué', async () => {
  await as('anon', null, `INSERT INTO public.map_artists (id, name, lat, lng, verified, claimed_by)
    VALUES ('direct', 'Direct', 6.3, 2.4, true, '${AWA}')`, [], { ip: '10.0.0.1' });
  assert.deepEqual(await row(`SELECT verified, claimed_by FROM public.map_artists WHERE id = 'direct'`), {
    verified: false,
    claimed_by: null,
  });
});

test('propriétaire : édite son profil, pas son badge ni ses abonnés', async () => {
  await as('authenticated', KOFI, `UPDATE public.map_artists SET bio = 'Nouvelle bio' WHERE id = 'owned'`);
  assert.equal((await row(`SELECT bio FROM public.map_artists WHERE id = 'owned'`)).bio, 'Nouvelle bio');
  for (const patch of ['verified = true', `followers = '9999999'`, `claimed_by = '${AWA}'`]) {
    await assert.rejects(
      as('authenticated', KOFI, `UPDATE public.map_artists SET ${patch} WHERE id = 'owned'`),
      /map_artist_column_forbidden/,
      patch,
    );
  }
  await as('authenticated', ADMIN, `UPDATE public.map_artists SET verified = true WHERE id = 'owned'`);
  assert.equal((await row(`SELECT verified FROM public.map_artists WHERE id = 'owned'`)).verified, true);
});

test('fonction SECURITY DEFINER : la revendication légitime passe', async () => {
  await as('authenticated', AWA, `SELECT public.test_definer_claim('direct')`);
  assert.equal((await row(`SELECT claimed_by FROM public.map_artists WHERE id = 'direct'`)).claimed_by, AWA);
});

test('liens et image : aucun schéma exécutable, longueurs bornées', async () => {
  const bad = [
    { image: 'javascript:alert(1)' },
    { image: ' data:text/html;base64,PHNjcmlwdD4=' },
    { platforms: { spotify: 'JavaScript:alert(1)' } },
    { socials: { instagram: { nested: true } } },
    { bio: 'x'.repeat(5001) },
    { name: ' ' },
  ];
  for (const extra of bad) {
    await assert.rejects(rpcArtist('anon', null, pin('bad', extra), { ip: '10.0.0.2' }), /invalid_payload/, JSON.stringify(extra));
  }
  const ok = await rpcArtist('anon', null, pin('good', {
    image: 'https://e-cdns-images.dzcdn.net/x.jpg',
    platforms: { spotify: 'https://open.spotify.com/artist/1' },
  }), { ip: '10.0.0.2' });
  assert.equal(ok.ok, true);
  // L'admin n'est pas soumis au filtre (corrections manuelles).
  const admin = await rpcArtist('authenticated', ADMIN, pin('admin-long', { bio: 'x'.repeat(6000) }));
  assert.equal(admin.ok, true);
});

test('quota : 40 nouveaux pins par visiteur et par jour, redécouverte gratuite', async () => {
  for (let i = 0; i < 40; i += 1) {
    assert.equal((await rpcArtist('anon', null, pin(`q${i}`), { ip: '10.0.0.3' })).ok, true);
  }
  await assert.rejects(rpcArtist('anon', null, pin('q40'), { ip: '10.0.0.3' }), /rate_limited/);
  assert.equal(await row(`SELECT 1 AS x FROM public.map_artists WHERE id = 'q40'`), undefined, 'rien inséré');
  // Redécouvrir un pin existant ne pose rien de neuf : pas de quota.
  const again = await rpcArtist('anon', null, pin('q1', { bio: 'Complète la bio' }), { ip: '10.0.0.3' });
  assert.deepEqual(again, { ok: true, id: 'q1', updated: true });
  // Un autre visiteur n'est pas pénalisé ; un compte est compté à part.
  assert.equal((await rpcArtist('anon', null, pin('other'), { ip: '10.0.0.4' })).ok, true);
  assert.equal((await rpcArtist('authenticated', AWA, pin('awa-1'), { ip: '10.0.0.3' })).ok, true);
  // Le compteur n'est pas lisible par le public.
  await assert.rejects(as('anon', null, 'SELECT * FROM public.rate_limits'), /permission denied/);
  for (const role of ['anon', 'authenticated']) {
    await assert.rejects(as(role, AWA, `SELECT public.consume_rate_limit('waitlist', 999999, 999999)`), /permission denied/, role);
    await assert.rejects(as(role, AWA, 'SELECT public.request_subject()'), /permission denied/, role);
  }
});

test('notify_discovery : texte du client ignoré, un seul envoi, artistes récents seulement', async () => {
  await client.query(`INSERT INTO public.map_artists (id, name, genre, city) VALUES ('fresh', 'Vrai Nom', 'Afrobeat', 'Cotonou')`);
  const call = (name) =>
    as('authenticated', KOFI, 'SELECT public.notify_discovery($1, $2, $3, $4, $5)', ['fresh', name, 'Afrobeat', 'Cotonou', 'Bénin']);
  await call('Cliquez ici : http://arnaque.example');
  await call('Encore');
  const sent = (await client.query(`SELECT user_id, type, artist_name, message FROM public.notifications WHERE artist_id = 'fresh' ORDER BY type`)).rows;
  assert.equal(sent.length, 2, 'Awa : ville + genre, une seule fois');
  for (const n of sent) {
    assert.equal(n.artist_name, 'Vrai Nom');
    assert.doesNotMatch(n.message, /arnaque/);
  }
  await client.query(`INSERT INTO public.map_artists (id, name, city, created_at) VALUES ('old', 'Ancien', 'Cotonou', now() - interval '1 hour')`);
  await as('authenticated', KOFI, `SELECT public.notify_discovery('old', 'x', 'x', 'Cotonou', 'x')`);
  await as('authenticated', KOFI, `SELECT public.notify_discovery('absent', 'x', 'x', 'Cotonou', 'x')`);
  assert.equal((await row(`SELECT count(*)::int AS n FROM public.notifications WHERE artist_id IN ('old', 'absent')`)).n, 0);
});

test('notify_artist_action : message borné, une alerte par auteur, type et jour', async () => {
  await as('authenticated', AWA, `SELECT public.notify_artist_action('owned', 'like', $1)`, ['x'.repeat(1000)]);
  await as('authenticated', AWA, `SELECT public.notify_artist_action('owned', 'like', 'encore')`);
  await as('authenticated', AWA, `SELECT public.notify_artist_action('owned', 'follow', 'suit')`);
  const got = (await client.query(`SELECT type, length(message) AS len FROM public.notifications WHERE user_id = '${KOFI}' AND artist_id = 'owned' ORDER BY type`)).rows;
  assert.deepEqual(got, [{ type: 'follow', len: 4 }, { type: 'like', len: 280 }]);
});

test('waitlist : plus de mise à jour publique', async () => {
  await client.query(`INSERT INTO public.waitlist (email, profile, artist_name) VALUES ('cible@ex.com', 'artiste', 'Cible')`);
  await as('anon', null, `UPDATE public.waitlist SET artist_name = 'Pirate' WHERE email = 'cible@ex.com'`, [], { ip: '10.1.0.1' });
  assert.equal((await row(`SELECT artist_name FROM public.waitlist WHERE email = 'cible@ex.com'`)).artist_name, 'Cible');
  // Insert direct (apps installées) : jamais au nom d'un autre compte.
  await assert.rejects(
    as('anon', null, `INSERT INTO public.waitlist (email, user_id) VALUES ('x@ex.com', '${AWA}')`, [], { ip: '10.1.0.1' }),
    /row-level security/,
  );
  await as('anon', null, `INSERT INTO public.waitlist (email, profile) VALUES ('ancienne-app@ex.com', 'artiste')`, [], { ip: '10.1.0.1' });
});

test('submit_waitlist : compte tiré de la session, pas d\'écrasement anonyme', async () => {
  const submit = (role, sub, entry, opts) => value(role, sub, 'SELECT public.submit_waitlist($1::jsonb)', [JSON.stringify(entry)], opts);
  const first = await submit('authenticated', AWA, { email: 'Awa@Ex.com', artist_name: 'Awa', user_id: KOFI, city: 'Cotonou' }, { ip: '10.2.0.1' });
  assert.deepEqual(first, { ok: true, duplicate: false });
  assert.equal((await row(`SELECT user_id FROM public.waitlist WHERE email = 'awa@ex.com'`)).user_id, AWA, 'user_id du formulaire ignoré');

  const hijack = await submit('anon', null, { email: 'awa@ex.com', artist_name: 'Pirate' }, { ip: '10.2.0.2' });
  assert.deepEqual(hijack, { ok: true, duplicate: true });
  const other = await submit('authenticated', KOFI, { email: 'awa@ex.com', artist_name: 'Pirate' }, { ip: '10.2.0.2', email: 'kofi@ex.com' });
  assert.deepEqual(other, { ok: true, duplicate: true });
  assert.equal((await row(`SELECT artist_name FROM public.waitlist WHERE email = 'awa@ex.com'`)).artist_name, 'Awa');

  const own = await submit('authenticated', AWA, { email: 'awa@ex.com', genre: 'Afrobeat' }, { ip: '10.2.0.1' });
  assert.deepEqual(own, { ok: true, duplicate: false, updated: true });
  assert.deepEqual(await row(`SELECT artist_name, genre FROM public.waitlist WHERE email = 'awa@ex.com'`), { artist_name: 'Awa', genre: 'Afrobeat' });

  assert.deepEqual(await submit('anon', null, { email: 'pas-un-email' }, { ip: '10.2.0.3' }), { ok: false, error: 'invalid_email' });
  assert.deepEqual(await submit('anon', null, { email: 'a@b.co', link: 'javascript:alert(1)' }, { ip: '10.2.0.3' }), { ok: false, error: 'invalid_payload' });
});

test('submit_waitlist : 5 demandes par visiteur et par jour', async () => {
  for (let i = 0; i < 5; i += 1) {
    const res = await value('anon', null, 'SELECT public.submit_waitlist($1::jsonb)', [JSON.stringify({ email: `spam${i}@ex.com` })], { ip: '10.3.0.1' });
    assert.equal(res.ok, true);
  }
  const blocked = await value('anon', null, 'SELECT public.submit_waitlist($1::jsonb)', [JSON.stringify({ email: 'spam5@ex.com' })], { ip: '10.3.0.1' });
  assert.deepEqual(blocked, { ok: false, error: 'rate_limited' });
});

test('photos : 20 envois par visiteur et par jour', async () => {
  const upload = (i, ip) => as('anon', null, `INSERT INTO storage.objects (bucket_id, name) VALUES ('artist-images', $1)`, [`artists/${i}.jpg`], { ip });
  for (let i = 0; i < 20; i += 1) await upload(i, '10.4.0.1');
  await assert.rejects(upload(20, '10.4.0.1'), /row-level security/);
  await upload(21, '10.4.0.2');
});
