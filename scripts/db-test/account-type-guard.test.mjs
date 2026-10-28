/**
 * Garde-fou du palier de compte (00079) contre un vrai Postgres.
 *
 * profiles_update_own ne filtre pas les colonnes : sans 00079, tout compte
 * connecté passe son account_type en 'premium' par l'API REST, et le RPC
 * set_account_type (00029) l'accepte aussi. Ce test :
 *   1. reproduit la faille (UPDATE direct + RPC de 00029) ;
 *   2. applique 00079 et vérifie chaque appelant : utilisateur (REST, upsert,
 *      RPC), admin, service_role, connexion directe ;
 *   3. vérifie que le reste du profil (role, display_name) reste modifiable.
 *
 * Lancé par `npm run test:db` (scripts/db-test/run.mjs), qui démarre un
 * Postgres jetable dans Docker et fournit DB_URL. Hors de `check` : il faut
 * Docker. Ne jamais pointer DB_URL vers la production — le test réécrit
 * profiles.
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
const NEWBIE = 'dddddddd-0000-4000-8000-000000000004';

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

/** Ce que fait `supabase.from('profiles').update(patch).eq('id', …)`. */
const patchProfile = (role, sub, id, patch) => {
  const cols = Object.keys(patch);
  const set = cols.map((c, i) => `${c} = $${i + 2}`).join(', ');
  return as(role, sub, `UPDATE public.profiles SET ${set} WHERE id = $1`, [id, ...Object.values(patch)]);
};

const rpc = async (sub, type) =>
  (await as('authenticated', sub, 'SELECT public.set_account_type($1) AS r', [type])).rows[0].r;

const tier = async (id) =>
  (await client.query('SELECT account_type FROM public.profiles WHERE id = $1', [id])).rows[0]?.account_type;

const forbidden = { code: '42501', message: 'account_type_forbidden' };

async function seed() {
  await client.query(`DELETE FROM public.profiles WHERE id = '${NEWBIE}'`);
  await client.query(
    `UPDATE public.profiles SET account_type = 'personal', role = 'melomane', display_name = ''`,
  );
}

before(async () => {
  await client.connect();
  await client.query(readFileSync(path.join(root, 'scripts', 'db-test', 'schema.sql'), 'utf8'));
  // Colonnes, contraintes et politiques de profiles telles qu'en production
  // (sauvegarde 2026-10-22) ; le socle de schema.sql ne les porte pas.
  await client.query(`
    ALTER TABLE public.profiles
      ADD COLUMN role text NOT NULL DEFAULT 'melomane'
        CHECK (role IN ('artist', 'melomane')),
      ADD COLUMN account_type text NOT NULL DEFAULT 'personal'
        CHECK (account_type IN ('personal', 'business', 'premium'));
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
    CREATE POLICY profiles_read_own ON public.profiles FOR SELECT USING (auth.uid() = id);
    CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE
      USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
    GRANT SELECT, INSERT, UPDATE ON public.profiles TO anon, authenticated;
    GRANT ALL ON public.profiles TO service_role;
  `);
  await client.query(
    `INSERT INTO auth.users VALUES ('${ADMIN}'), ('${USER}'), ('${OTHER}'), ('${NEWBIE}')`,
  );
  await client.query(`INSERT INTO public.profiles (id) VALUES ('${ADMIN}'), ('${USER}'), ('${OTHER}')`);
  await client.query(`INSERT INTO public.admins VALUES ('${ADMIN}')`);
  // set_account_type tel que posé par 00029 (le reste de 00029 dépend de
  // tables hors de ce socle).
  const m29 = migration('00029_follows_premium_notifications.sql');
  const start = m29.indexOf('CREATE OR REPLACE FUNCTION public.set_account_type');
  const endMarker = 'GRANT EXECUTE ON FUNCTION public.set_account_type(text) TO authenticated;';
  await client.query(m29.slice(start, m29.indexOf(endMarker) + endMarker.length));
});

after(() => client.end());

test('avant 00079 : un compte se passe premium par REST et par RPC — faille reproduite', async () => {
  await seed();
  await patchProfile('authenticated', USER, USER, { account_type: 'premium' });
  assert.equal(await tier(USER), 'premium');
  assert.deepEqual(await rpc(OTHER, 'business'), { ok: true });
  assert.equal(await tier(OTHER), 'business');
});

test('00079 s’applique sans erreur (et se rejoue)', async () => {
  await client.query(migration('00079_guard_account_type.sql'));
  await client.query(migration('00079_guard_account_type.sql'));
});

test('REST : un utilisateur ne peut pas monter en business ni premium', async () => {
  await seed();
  for (const type of ['business', 'premium']) {
    await assert.rejects(patchProfile('authenticated', USER, USER, { account_type: type }), forbidden, type);
    // Glissé au milieu d'une mise à jour légitime : tout est refusé.
    await assert.rejects(
      patchProfile('authenticated', USER, USER, { display_name: 'X', account_type: type }),
      forbidden,
    );
  }
  assert.equal(await tier(USER), 'personal');
});

test('REST : premium ↛ business (changement latéral refusé), retour à personal permis', async () => {
  await seed();
  await client.query(`UPDATE public.profiles SET account_type = 'premium' WHERE id = $1`, [USER]);
  await assert.rejects(patchProfile('authenticated', USER, USER, { account_type: 'business' }), forbidden);
  assert.equal(await tier(USER), 'premium');
  // Réécrire la même valeur n'est pas une montée.
  await patchProfile('authenticated', USER, USER, { account_type: 'premium' });
  await patchProfile('authenticated', USER, USER, { account_type: 'personal' });
  assert.equal(await tier(USER), 'personal');
});

test('upsert / INSERT : un profil créé par l’utilisateur commence en personal', async () => {
  await seed();
  await assert.rejects(
    as('authenticated', NEWBIE, `INSERT INTO public.profiles (id, account_type) VALUES ($1, 'premium')`, [NEWBIE]),
    forbidden,
  );
  await assert.rejects(
    as(
      'authenticated',
      USER,
      `INSERT INTO public.profiles (id, account_type) VALUES ($1, 'premium')
       ON CONFLICT (id) DO UPDATE SET account_type = EXCLUDED.account_type`,
      [USER],
    ),
    forbidden,
  );
  assert.equal(await tier(USER), 'personal');
  await as('authenticated', NEWBIE, 'INSERT INTO public.profiles (id) VALUES ($1)', [NEWBIE]);
  assert.equal(await tier(NEWBIE), 'personal');
});

test('le reste du profil reste modifiable (updateProfile({ role }) après Google / Apple)', async () => {
  await seed();
  await patchProfile('authenticated', USER, USER, { role: 'artist', display_name: 'Zeynab' });
  const p = (await client.query('SELECT role, display_name, account_type FROM public.profiles WHERE id = $1', [USER])).rows[0];
  assert.deepEqual(p, { role: 'artist', display_name: 'Zeynab', account_type: 'personal' });
});

test('RPC set_account_type : montée refusée, retour à personal permis', async () => {
  await seed();
  for (const type of ['business', 'premium']) {
    assert.deepEqual(await rpc(USER, type), { ok: false, error: 'upgrade_unavailable' }, type);
  }
  assert.equal(await tier(USER), 'personal');
  assert.deepEqual(await rpc(USER, 'nope'), { ok: false, error: 'invalid_type' });
  assert.deepEqual(await rpc(null, 'personal'), { ok: false, error: 'not_authenticated' });

  await client.query(`UPDATE public.profiles SET account_type = 'business' WHERE id = $1`, [USER]);
  assert.deepEqual(await rpc(USER, 'personal'), { ok: true });
  assert.equal(await tier(USER), 'personal');
});

test('admin : change son palier par REST comme par RPC', async () => {
  await seed();
  await patchProfile('authenticated', ADMIN, ADMIN, { account_type: 'premium' });
  assert.equal(await tier(ADMIN), 'premium');
  assert.deepEqual(await rpc(ADMIN, 'business'), { ok: true });
  assert.equal(await tier(ADMIN), 'business');
});

test('service_role et connexion directe : changent le palier de n’importe qui', async () => {
  await seed();
  await patchProfile('service_role', null, USER, { account_type: 'premium' });
  assert.equal(await tier(USER), 'premium');
  await client.query(`UPDATE public.profiles SET account_type = 'business' WHERE id = $1`, [OTHER]);
  assert.equal(await tier(OTHER), 'business');
});

test('un utilisateur ne touche toujours pas le profil d’un autre (RLS inchangée)', async () => {
  await seed();
  const res = await patchProfile('authenticated', USER, OTHER, { account_type: 'personal', display_name: 'pwn' });
  assert.equal(res.rowCount, 0);
});
