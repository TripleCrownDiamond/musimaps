/**
 * Slug automatique des artistes (00069) contre un vrai Postgres.
 *
 * Le partage (web, mobile) et inject-og choisissent `slug || id` : tant que
 * le slug n'est pas rempli en base, chaque profil partage son UUID. 00069
 * pose la règle SQL (slugify translittéré, backfill, trigger) — ce test
 * l'EXÉCUTE :
 *   - public.slugify reproduit le `slugify` de @musimaps/shared ;
 *   - tout artiste sans slug en reçoit un, à l'insertion comme au backfill ;
 *   - les collisions avec un slug OU un id existant → suffixe -2, -3… ;
 *   - un slug explicite (admin, profil revendiqué) n'est jamais touché, pas
 *     même par un renommage — les liens déjà partagés restent valides ;
 *   - le backfill ne casse pas sur deux artistes homonymes.
 *
 * Lancé par `npm run test:db` (scripts/db-test/run.mjs), qui démarre un
 * Postgres jetable dans Docker et fournit DB_URL. Hors de `check` : il faut
 * Docker. Ne jamais pointer DB_URL vers la production — ce test vide
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

const client = new pg.Client({ connectionString: process.env.DB_URL });

/** Nettoie et sème des artistes couvrant les cas de collision. */
async function seed() {
  await client.query('TRUNCATE public.map_artists');
  await client.query(`
    INSERT INTO public.map_artists (id, name, source) VALUES
      ('mb-1', 'Omah Lay',   'musicbrainz'),  -- slug null : backfill
      ('mb-2', 'Sans Nom',   'musicbrainz'),  -- nom sans aucune lettre : slug vide
      ('omah-lay', 'Autre',  'musicbrainz');  -- un id QUI EST le slug d'un voisin
  `);
}

before(async () => {
  await client.connect();
  await client.query(readFileSync(path.join(root, 'scripts', 'db-test', 'schema.sql'), 'utf8'));
  // 00071 corrige le slugify de 00069 (tables translate() désalignées) et
  // répare les slugs déjà posés : l'état à tester est 00069 PUIS 00071,
  // exactement comme sur la base réelle.
  await client.query(migration('00069_artist_slug_backfill.sql'));
  await client.query(migration('00071_fix_artist_slugify.sql'));
});

after(() => client.end());

test('slugify : translittération et casse identiques au slugify TypeScript', async () => {
  const cases = [
    ['DJ Arafat', 'dj-arafat'],
    ["L'Artiste 225", 'l-artiste-225'],
    ['Beyoncé', 'beyonce'],
    ['Cédric KOACI', 'cedric-koaci'],
    ['Étoile de mer', 'etoile-de-mer'],
    ['DJ  ***  Mix', 'dj-mix'],
    ['Música', 'musica'],
  ];
  for (const [input, expected] of cases) {
    const { rows } = await client.query('SELECT public.slugify($1) AS s', [input]);
    assert.equal(rows[0].s, expected, input);
  }
});

test('insertion : tout nouvel artiste reçoit son slug sans y penser', async () => {
  await seed();
  await client.query(
    `INSERT INTO public.map_artists (id, name, source) VALUES ('mb-new', 'Zeynab Abib', 'musicbrainz')`,
  );
  const { rows } = await client.query(`SELECT slug FROM public.map_artists WHERE id = 'mb-new'`);
  assert.equal(rows[0].slug, 'zeynab-abib');
});

test('backfill : les artistes existants reçoivent leur nom comme slug', async () => {
  await seed();
  // Reproduit l'état d'avant 00069 : lignes préexistantes, sans slug.
  await client.query(`ALTER TABLE public.map_artists DISABLE TRIGGER trg_map_artists_assign_slug`);
  await client.query(
    `INSERT INTO public.map_artists (id, name, source) VALUES ('mb-old', 'Angélique Kidjo', 'musicbrainz')`,
  );
  await client.query(`ALTER TABLE public.map_artists ENABLE TRIGGER trg_map_artists_assign_slug`);

  await client.query(migration('00069_artist_slug_backfill.sql'));
  const { rows } = await client.query(`SELECT slug FROM public.map_artists WHERE id = 'mb-old'`);
  assert.equal(rows[0].slug, 'angelique-kidjo');
});

test('collision de nom : deuxième artiste homonyme suffixé -2 (backfill compris)', async () => {
  await seed();
  await client.query(`ALTER TABLE public.map_artists DISABLE TRIGGER trg_map_artists_assign_slug`);
  await client.query(
    `INSERT INTO public.map_artists (id, name, source) VALUES
       ('mb-a', 'DJ Mix', 'musicbrainz'),
       ('mb-b', 'DJ Mix', 'musicbrainz'),
       ('mb-c', 'DJ Mix', 'musicbrainz')`,
  );
  await client.query(`ALTER TABLE public.map_artists ENABLE TRIGGER trg_map_artists_assign_slug`);

  await client.query(migration('00069_artist_slug_backfill.sql'));
  const { rows } = await client.query(
    `SELECT id, slug FROM public.map_artists WHERE name = 'DJ Mix' ORDER BY id`,
  );
  assert.deepEqual(
    rows.map((r) => [r.id, r.slug]),
    [
      ['mb-a', 'dj-mix'],
      ['mb-b', 'dj-mix-2'],
      ['mb-c', 'dj-mix-3'],
    ],
  );
});

test('slug en collision avec l’ID d’un voisin : suffixé plutôt que disputé', async () => {
  await seed();
  await client.query(`ALTER TABLE public.map_artists DISABLE TRIGGER trg_map_artists_assign_slug`);
  await client.query(
    `INSERT INTO public.map_artists (id, name, source) VALUES ('mb-x', 'Autre', 'musicbrainz')`,
  );
  await client.query(`ALTER TABLE public.map_artists ENABLE TRIGGER trg_map_artists_assign_slug`);

  await client.query(migration('00069_artist_slug_backfill.sql'));
  // 'autre' est l'id d'une ligne déjà semée : le slug doit être décalé.
  const { rows } = await client.query(`SELECT slug FROM public.map_artists WHERE id = 'mb-x'`);
  assert.equal(rows[0].slug, 'autre-2');
});

test('nom sans lettre : repli sur l’id plutôt qu’un slug vide', async () => {
  await seed();
  await client.query(migration('00069_artist_slug_backfill.sql'));
  const { rows } = await client.query(`SELECT slug FROM public.map_artists WHERE id = 'mb-2'`);
  assert.equal(rows[0].slug, 'mb-2');
});

test('slug explicite : jamais réécrit, y compris par un renommage', async () => {
  await seed();
  await client.query(
    `UPDATE public.map_artists SET slug = 'lien-perso' WHERE id = 'mb-1'`,
  );
  await client.query(`UPDATE public.map_artists SET name = 'Nouveau Nom' WHERE id = 'mb-1'`);
  const { rows } = await client.query(`SELECT slug, name FROM public.map_artists WHERE id = 'mb-1'`);
  assert.equal(rows[0].slug, 'lien-perso');
  assert.equal(rows[0].name, 'Nouveau Nom');
});

test('re-nullification du slug repasse par le trigger (auto-réparation)', async () => {
  await seed();
  await client.query(migration('00069_artist_slug_backfill.sql'));
  await client.query(`UPDATE public.map_artists SET slug = NULL WHERE id = 'mb-1'`);
  const { rows } = await client.query(`SELECT slug FROM public.map_artists WHERE id = 'mb-1'`);
  assert.equal(rows[0].slug, 'omah-lay');
});
