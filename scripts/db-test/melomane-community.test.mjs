/**
 * Communauté de mélomanes (00080) contre un vrai Postgres.
 *
 * Vérifie ce que la migration promet : profil privé par défaut, suivi limité
 * aux profils publics, blocage qui masque et coupe le suivi, sélections
 * publiques/privées, plafond d'artistes, notifications, signalement d'un
 * profil ou d'une sélection, et colonnes sûres dans les RPC publiques.
 *
 * Lancé par `npm run test:db` (Docker). Ne jamais pointer DB_URL vers la
 * production.
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
const ZOE = 'cccccccc-0000-4000-8000-00000000000c';

const client = new pg.Client({ connectionString: process.env.DB_URL });

/** Requête comme PostgREST : rôle + claims JWT, le temps d'une transaction. */
async function as(sub, sql, params = []) {
  const role = sub ? 'authenticated' : 'anon';
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
const one = async (sub, sql, params) => (await as(sub, sql, params)).rows[0];
const rpc = async (sub, call, params) => Object.values(await one(sub, `SELECT ${call} AS r`, params))[0];

before(async () => {
  await client.connect();
  await client.query(readFileSync(path.join(root, 'scripts', 'db-test', 'schema.sql'), 'utf8'));
  // Tables et colonnes de production (sauvegarde 2026-10-22) absentes du socle.
  await client.query(`
    ALTER TABLE public.profiles
      ADD COLUMN role text NOT NULL DEFAULT 'melomane',
      ADD COLUMN avatar_url text,
      ADD COLUMN country text,
      ADD COLUMN district text,
      ADD COLUMN account_type text NOT NULL DEFAULT 'personal',
      ADD COLUMN favorite_genres jsonb NOT NULL DEFAULT '[]',
      ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    CREATE POLICY profiles_read_own ON public.profiles FOR SELECT USING (auth.uid() = id);
    CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
    GRANT SELECT, UPDATE ON public.profiles TO authenticated;

    CREATE TABLE public.follows (
      user_id uuid NOT NULL REFERENCES auth.users(id), artist_id text NOT NULL REFERENCES public.map_artists(id),
      created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (user_id, artist_id));

    CREATE TABLE public.notifications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id),
      type text NOT NULL DEFAULT 'discovery', artist_id text, artist_name text, city text, country text,
      message text, read boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), ref text,
      CONSTRAINT notifications_type_check CHECK (type IN ('discovery','followed_artist','preference','nearby',
        'follow','like','booking','booking_status','streak','achievement')));
    CREATE UNIQUE INDEX notifications_user_type_ref_idx ON public.notifications (user_id, type, ref) WHERE ref IS NOT NULL;

    CREATE TABLE public.content_reports (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reporter_id uuid REFERENCES auth.users(id),
      artist_id text NOT NULL REFERENCES public.map_artists(id), reason text NOT NULL,
      details text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'open', created_at timestamptz NOT NULL DEFAULT now());
    ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;
    CREATE POLICY content_reports_insert_own ON public.content_reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
    GRANT INSERT ON public.content_reports TO authenticated;
  `);
  await client.query(migration('00080_melomane_community.sql'));

  await client.query(`
    INSERT INTO auth.users (id) VALUES ('${AWA}'), ('${KOFI}'), ('${ZOE}');
    INSERT INTO public.profiles (id, display_name, city, district, country, account_type)
    VALUES ('${AWA}', 'Awa', 'Cotonou', 'Fidjrossè', 'BJ', 'premium'),
           ('${KOFI}', 'Kofi', 'Lomé', NULL, 'TG', 'personal'),
           ('${ZOE}', 'Zoé', 'Abidjan', NULL, 'CI', 'personal');
    INSERT INTO public.map_artists (id, name, city, image)
    SELECT 'a' || g, 'Artiste ' || g, 'Cotonou', 'https://img/' || g FROM generate_series(1, 55) g;
    INSERT INTO public.follows (user_id, artist_id) VALUES ('${AWA}', 'a1'), ('${AWA}', 'a2');
  `);
});

after(async () => client.end());

test('profil privé par défaut : invisible, et on ne peut pas le suivre', async () => {
  assert.equal(await rpc(null, 'public.get_public_profile($1)', ['awa']), null);
  await assert.rejects(as(KOFI, `INSERT INTO public.user_follows (followee_id) VALUES ($1)`, [AWA]), /row-level security/);
});

test('activer son profil public : identifiant validé et unique', async () => {
  assert.deepEqual(await rpc(AWA, 'public.set_public_profile(true, $1)', ['A']), { ok: false, error: 'handle_invalid' });
  assert.deepEqual(await rpc(AWA, 'public.set_public_profile(true, $1)', ['awa.cotonou']), { ok: true });
  assert.deepEqual(await rpc(KOFI, 'public.set_public_profile(true, $1)', ['awa.cotonou']), { ok: false, error: 'handle_taken' });
  assert.deepEqual(await rpc(KOFI, 'public.set_public_profile(true, $1)', ['kofi']), { ok: true });
});

test('le profil public ne livre que des colonnes sûres', async () => {
  const profile = await rpc(null, 'public.get_public_profile($1)', ['AWA.cotonou']);
  assert.equal(profile.displayName, 'Awa');
  assert.equal(profile.city, 'Cotonou');
  assert.equal(profile.followedArtists.length, 2);
  for (const secret of ['district', 'account_type', 'accountType', 'email']) assert.equal(profile[secret], undefined);
  // profiles reste fermé en lecture directe.
  assert.equal((await as(KOFI, `SELECT * FROM public.profiles WHERE id = $1`, [AWA])).rowCount, 0);
});

test('suivre un mélomane notifie avec un lien vers le profil', async () => {
  await as(KOFI, `INSERT INTO public.user_follows (followee_id) VALUES ($1)`, [AWA]);
  const profile = await rpc(KOFI, 'public.get_public_profile($1)', ['awa.cotonou']);
  assert.equal(profile.followerCount, 1);
  assert.equal(profile.isFollowing, true);
  const notif = (await client.query(`SELECT type, ref, message FROM public.notifications WHERE user_id = $1`, [AWA])).rows;
  assert.deepEqual(notif.map((n) => [n.type, n.ref]), [['follow', 'profile:kofi']]);
  assert.match(notif[0].message, /Kofi vous suit/);
});

test('sélection : privée invisible, publique partageable, plafond de 50 artistes', async () => {
  const priv = await one(AWA, `INSERT INTO public.collections (title, is_public) VALUES ('Brouillon', false) RETURNING id`);
  assert.equal(await rpc(KOFI, 'public.get_collection($1)', [priv.id]), null);

  const pub = await one(AWA, `INSERT INTO public.collections (title) VALUES ('Top Cotonou') RETURNING id`);
  await as(AWA, `INSERT INTO public.collection_items (collection_id, artist_id) VALUES ($1, 'a1'), ($1, 'a2')`, [pub.id]);
  const seen = await rpc(null, 'public.get_collection($1)', [pub.id]);
  assert.equal(seen.title, 'Top Cotonou');
  assert.equal(seen.artists.length, 2);
  assert.equal(seen.owner.handle, 'awa.cotonou');

  // Kofi suit Awa : la publication (premier artiste) l'a notifié une seule fois.
  const notifs = (await client.query(`SELECT ref FROM public.notifications WHERE user_id = $1 AND type = 'collection'`, [KOFI])).rows;
  assert.deepEqual(notifs.map((n) => n.ref), [`collection:${pub.id}`]);
  const feed = await rpc(KOFI, 'public.following_collections()');
  assert.deepEqual(feed.map((c) => c.id), [pub.id]);

  // Kofi ne peut pas écrire dans la sélection d'Awa.
  await assert.rejects(as(KOFI, `INSERT INTO public.collection_items (collection_id, artist_id) VALUES ($1, 'a3')`, [pub.id]), /row-level security/);

  const big = await one(AWA, `INSERT INTO public.collections (title) VALUES ('Tout') RETURNING id`);
  await as(AWA, `INSERT INTO public.collection_items (collection_id, artist_id) SELECT $1, 'a' || g FROM generate_series(1, 50) g`, [big.id]);
  await assert.rejects(as(AWA, `INSERT INTO public.collection_items (collection_id, artist_id) VALUES ($1, 'a51')`, [big.id]), /collection_full/);
});

test("aimer une sélection : pas la sienne, et l'auteur est notifié", async () => {
  const { id } = await one(AWA, `SELECT id FROM public.collections WHERE title = 'Top Cotonou'`);
  await assert.rejects(as(AWA, `INSERT INTO public.collection_likes (collection_id) VALUES ($1)`, [id]), /row-level security/);
  await as(KOFI, `INSERT INTO public.collection_likes (collection_id) VALUES ($1)`, [id]);
  assert.equal((await rpc(KOFI, 'public.get_collection($1)', [id])).likedByMe, true);
  const like = (await client.query(`SELECT ref FROM public.notifications WHERE user_id = $1 AND type = 'like'`, [AWA])).rows;
  assert.deepEqual(like.map((n) => n.ref), [`collection:${id}:${KOFI}`]);
});

test('signaler un profil ou une sélection, une seule cible à la fois', async () => {
  const { id } = await one(AWA, `SELECT id FROM public.collections WHERE title = 'Top Cotonou'`);
  await as(ZOE, `INSERT INTO public.content_reports (reporter_id, profile_id, reason) VALUES ($1, $2, 'spam')`, [ZOE, AWA]);
  await as(ZOE, `INSERT INTO public.content_reports (reporter_id, collection_id, reason) VALUES ($1, $2, 'other')`, [ZOE, id]);
  await assert.rejects(
    as(ZOE, `INSERT INTO public.content_reports (reporter_id, profile_id, collection_id, reason) VALUES ($1, $2, $3, 'spam')`, [ZOE, AWA, id]),
    /content_reports_one_target/,
  );
});

test('bloquer : profil et sélections masqués, suivi coupé dans les deux sens', async () => {
  const { id } = await one(AWA, `SELECT id FROM public.collections WHERE title = 'Top Cotonou'`);
  await as(AWA, `INSERT INTO public.user_blocks (blocked_id) VALUES ($1)`, [KOFI]);
  assert.equal(await rpc(KOFI, 'public.get_public_profile($1)', ['awa.cotonou']), null);
  assert.equal(await rpc(KOFI, 'public.get_collection($1)', [id]), null);
  assert.equal((await as(KOFI, `SELECT * FROM public.collections WHERE id = $1`, [id])).rowCount, 0);
  assert.equal((await client.query(`SELECT count(*)::int AS n FROM public.user_follows`)).rows[0].n, 0);
  await assert.rejects(as(KOFI, `INSERT INTO public.user_follows (followee_id) VALUES ($1)`, [AWA]), /row-level security/);
  const found = await rpc(KOFI, 'public.search_public_profiles($1)', ['awa']);
  assert.deepEqual(found, []);
});

test('repasser en privé masque le profil, les sélections publiques restent partageables', async () => {
  await rpc(AWA, 'public.set_public_profile(false, NULL)');
  assert.equal(await rpc(ZOE, 'public.get_public_profile($1)', ['awa.cotonou']), null);
  const { id } = await one(AWA, `SELECT id FROM public.collections WHERE title = 'Top Cotonou'`);
  const seen = await rpc(ZOE, 'public.get_collection($1)', [id]);
  assert.equal(seen.owner.handle, null);
  assert.equal(seen.owner.city, null);
  // Son propre profil reste lisible par soi-même.
  assert.equal((await rpc(AWA, 'public.get_public_profile($1)', ['awa.cotonou'])).isMe, true);
});
