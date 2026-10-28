/**
 * Tenue de charge (00082) contre un vrai Postgres.
 *
 * Vérifie : version de la carte incrémentée une fois par instruction,
 * lecture publique de la version, vues groupées (journal + compteurs,
 * plafonds, artistes inconnus ignorés), quota IA atomique et réservé à
 * service_role.
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

const client = new pg.Client({ connectionString: process.env.DB_URL });

/** Requête comme PostgREST : rôle + claims JWT, le temps d'une transaction. */
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
const value = async (role, sub, sql, params) => Object.values((await as(role, sub, sql, params)).rows[0])[0];
const version = () => value('anon', null, 'SELECT public.map_artists_version()');
const stats = async (id) =>
  (await client.query('SELECT profile_views, pin_views FROM public.artist_stats WHERE artist_id = $1', [id])).rows[0];
const logged = async (id) =>
  Number((await client.query('SELECT count(*) FROM public.artist_views WHERE artist_id = $1', [id])).rows[0].count);

before(async () => {
  await client.connect();
  await client.query(readFileSync(path.join(root, 'scripts', 'db-test', 'schema.sql'), 'utf8'));
  await client.query(`
    INSERT INTO auth.users (id) VALUES ('${AWA}');
    INSERT INTO public.profiles (id, display_name, city) VALUES ('${AWA}', 'Awa', 'Cotonou, Benin');
    INSERT INTO public.map_artists (id, name, city) VALUES ('a1', 'Un', 'Cotonou'), ('a2', 'Deux', 'Lomé');
    -- 00023 pose aussi les politiques des favoris (table de 00002).
    CREATE TABLE public.favorites (
      user_id uuid NOT NULL REFERENCES auth.users(id), artist_id text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (user_id, artist_id));
  `);
  await client.query(migration('00023_artist_stats_likes.sql'));
  await client.query(migration('00040_artist_view_analytics.sql'));
  await client.query(migration('00082_scalability.sql'));
  // Rejouable.
  await client.query(migration('00082_scalability.sql'));
});

after(async () => client.end());

test('version de la carte : lisible par tous, +1 par instruction', async () => {
  const v0 = Number(await version());
  await client.query(`INSERT INTO public.map_artists (id, name) SELECT 'b' || g, 'B' || g FROM generate_series(1, 30) g`);
  assert.equal(Number(await version()), v0 + 1, 'un import de 30 lignes = une seule version');
  await client.query(`UPDATE public.map_artists SET genre = 'afrobeat' WHERE id = 'b1'`);
  await client.query(`DELETE FROM public.map_artists WHERE id LIKE 'b%'`);
  assert.equal(Number(await version()), v0 + 3);
  // La table elle-même reste fermée en lecture directe. Sur Supabase, anon a
  // les droits par défaut et RLS rend 0 ligne ; ici, sans droit, c'est refusé.
  await client.query('GRANT SELECT ON public.map_artists_meta TO anon');
  const direct = await as('anon', null, 'SELECT * FROM public.map_artists_meta');
  assert.equal(direct.rows.length, 0);
});

test('vues groupées : journal + compteurs en un appel', async () => {
  const total = await value('authenticated', AWA, 'SELECT public.record_artist_views($1::jsonb, $2, NULL)', [
    JSON.stringify([
      { artist_id: 'a1', kind: 'profile', count: 2 },
      { artist_id: 'a1', kind: 'pin', count: 3 },
      { artist_id: 'a2', kind: 'pin' },
    ]),
    'device-1',
  ]);
  assert.equal(total, 6);
  assert.deepEqual(await stats('a1'), { profile_views: '2', pin_views: '3' });
  assert.deepEqual(await stats('a2'), { profile_views: '0', pin_views: '1' });
  assert.equal(await logged('a1'), 5);
  const row = (await client.query(`SELECT user_id, viewer_key, country FROM public.artist_views WHERE artist_id = 'a2'`)).rows[0];
  assert.deepEqual(row, { user_id: AWA, viewer_key: 'device-1', country: 'Benin' });
});

test('vues groupées : anonyme, entrées invalides ignorées, plafonds', async () => {
  const before = await stats('a2');
  const total = await value('anon', null, 'SELECT public.record_artist_views($1::jsonb, NULL, $2)', [
    JSON.stringify([
      { artist_id: 'inconnu', kind: 'pin' },
      { artist_id: 'a2', kind: 'hack' },
      { artist_id: 'a2', kind: 'profile', count: 9999 },
      { artist_id: 'a2', kind: 'profile', count: 'abc' },
      'pas un objet',
    ]),
    'TG',
  ]);
  assert.equal(total, 20, '20 vues maximum par artiste et par type');
  assert.equal(Number((await stats('a2')).profile_views), Number(before.profile_views) + 20);
  assert.equal(await value('anon', null, `SELECT public.record_artist_views('{}'::jsonb)`), 0);
  assert.equal(await value('anon', null, `SELECT public.record_artist_views(NULL)`), 0);
  const many = Array.from({ length: 150 }, () => ({ artist_id: 'a1', kind: 'pin' }));
  assert.equal(
    await value('anon', null, 'SELECT public.record_artist_views($1::jsonb)', [JSON.stringify(many)]),
    20,
    'au-delà de 100 entrées, ignorées ; puis plafond par artiste',
  );
});

test('quota IA : réservé à service_role', async () => {
  for (const role of ['anon', 'authenticated']) {
    await assert.rejects(as(role, null, `SELECT public.consume_ai_quota('ip:1.2.3.4', 5, 100)`), /permission denied/);
  }
  await assert.rejects(as('anon', null, 'SELECT * FROM public.ai_usage'), /permission denied/);
});

test('quota IA : plafond individuel puis global, refus sans consommer', async () => {
  const take = (subject, limit, global) =>
    value('service_role', null, 'SELECT public.consume_ai_quota($1, $2, $3)', [subject, limit, global]);
  for (let i = 0; i < 3; i += 1) assert.equal(await take('user:awa', 3, 100), true);
  assert.equal(await take('user:awa', 3, 100), false, '4e appel refusé');
  assert.equal(await take('user:awa', 3, 100), false);
  const used = (await client.query(`SELECT subject, calls FROM public.ai_usage ORDER BY subject`)).rows;
  assert.deepEqual(used, [{ subject: 'global', calls: 3 }, { subject: 'user:awa', calls: 3 }], 'les refus ne comptent pas');

  // Plafond global : 5 appels au total pour la journée.
  assert.equal(await take('ip:1.1.1.1', 10, 5), true);
  assert.equal(await take('ip:1.1.1.1', 10, 5), true);
  assert.equal(await take('ip:2.2.2.2', 10, 5), false, 'budget du jour épuisé pour tout le monde');
  // Administrateur (plafond individuel 0) : seul le global s'applique.
  assert.equal(await take('user:admin', 0, 100), true);
  assert.equal(await take('', 10, 100), false);
});

test('quota IA : appels simultanés ne dépassent pas le plafond', async () => {
  const pool = new pg.Pool({ connectionString: process.env.DB_URL, max: 10 });
  try {
    const results = await Promise.all(
      Array.from({ length: 25 }, () =>
        pool.query(`SELECT public.consume_ai_quota('user:rush', 7, 0) AS ok`).then((r) => r.rows[0].ok),
      ),
    );
    assert.equal(results.filter(Boolean).length, 7);
  } finally {
    await pool.end();
  }
});
