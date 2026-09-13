/**
 * Garde-fou du RPC `add_or_update_map_artist`.
 *
 * Ses protections ont déjà été perdues : 00055 et 00056 ont recopié un corps
 * antérieur à 00025 (coordonnées), 00035 (nom curé) et 00053 (claimed_by), et
 * le cron MusicBrainz a de nouveau écrasé des localisations corrigées à la
 * main. `npm run check` n'a pas de Postgres : ce test lit donc la DERNIÈRE
 * migration qui définit le RPC et vérifie que les protections y sont encore.
 * Il ne remplace pas un essai contre une vraie base.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'supabase', 'migrations');
const DEFINITION = /CREATE OR REPLACE FUNCTION public\.add_or_update_map_artist\s*\(/i;

const latest = readdirSync(dir)
  .filter((file) => file.endsWith('.sql'))
  .sort()
  .filter((file) => DEFINITION.test(readFileSync(path.join(dir, file), 'utf8')))
  .at(-1);

const sql = readFileSync(path.join(dir, latest), 'utf8');
const start = sql.search(DEFINITION);
const body = sql.slice(start, sql.indexOf('$$;', start));

test('aucun champ curé n’est écrasé sans condition', () => {
  // Les formes exactes qu'avaient 00055/00056 : `lat = EXCLUDED.lat`,
  // `city = COALESCE(EXCLUDED.city, …)` — le payload gagne toujours.
  for (const column of [
    'name', 'source', 'lat', 'lng', 'city', 'district', 'country', 'flag',
    'genre', 'bio', 'image', 'followers', 'claimed_by',
  ]) {
    const unconditional = new RegExp(
      `^\\s*${column}\\s*=\\s*(EXCLUDED\\.${column}|COALESCE\\(EXCLUDED\\.${column})`,
      'im',
    );
    assert.doesNotMatch(body, unconditional, `${latest} : « ${column} » écrasé sans condition`);
  }
});

test('l’écrasement exige un rôle privilégié et un drapeau explicite', () => {
  assert.match(body, /admin_override/, `${latest} : drapeau admin_override absent`);
  assert.match(body, /public\.is_admin\(\)/, `${latest} : contrôle is_admin() absent`);
  assert.match(body, /service_role/, `${latest} : rôle service_role non reconnu`);
  assert.match(body, /override_forbidden/, `${latest} : override non refusé aux autres rôles`);
});

test('claimed_by n’est accepté que d’un rôle privilégié', () => {
  assert.match(body, /claimed_by_forbidden/, `${latest} : claimed_by non contrôlé`);
  // 00053 laissait tout compte revendiquer n'importe quel pin pour lui-même.
  assert.doesNotMatch(body, /auth\.uid\(\)\s*=\s*v_claimed_by/, `${latest} : auto-revendication permise`);
});

test('les liens existants priment sans override', () => {
  for (const column of ['platforms', 'socials']) {
    const existingWins = new RegExp(
      `ELSE COALESCE\\(EXCLUDED\\.${column}, '\\{\\}'::jsonb\\)\\s*\\|\\|\\s*COALESCE\\(public\\.map_artists\\.${column}`,
    );
    assert.match(body, existingWins, `${latest} : « ${column} » existants écrasés par le payload`);
  }
});
