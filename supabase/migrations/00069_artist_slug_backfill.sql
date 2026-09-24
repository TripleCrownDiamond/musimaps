-- ============================================================
-- 00069 — Slug automatique pour tous les artistes (backfill + trigger)
--
-- PROBLÈME. Le slug (00057) n'était attribué qu'à la main : champ admin ou
-- « lien perso » du profil revendiqué. Tous les autres artistes partageaient
-- leur identifiant interne — musimaps.com/artist/9b2f6a8c-… au lieu de
-- /artist/omah-lay. Les boutons de partage du web et du mobile choisissaient
-- déjà `slug || id` (urls.ts), et inject-og produisait même une page OG par
-- identifiant : ce qui manquait, ce sont les données.
--
-- ICI.
--   1. public.slugify(text) : même règle que `slugify` de @musimaps/shared
--      (minuscules, accents translittérés, non-alphanumériques → '-', 80 car.).
--   2. Backfill : toute ligne sans slug reçoit celui de son nom ; une
--      collision avec un slug déjà posé à la main est désamorcée par un
--      suffixe -2, -3… — les slugs existants ne sont jamais touchés.
--   3. Trigger : tout futur artiste (cron MusicBrainz, découverte publique,
--      seed) reçoit son slug à l'insertion, sans dépendre d'un import qui
--      penserait à le calculer. Un slug explicite (admin, artiste) reste
--      prioritaire ; renommer conserve le slug déjà partagé (les liens
--      publiés ne cassent pas).
--
-- Conséquence produit : /artist/<slug> devient LA forme canonique de chaque
-- profil. inject-og et check-og s'appuient dessus (og:url et canonical des
-- pages-id pointent vers le slug).
-- ============================================================

-- 1. Translittération identique au `slugify` TypeScript (@musimaps/shared) :
--    minuscules, accents précomposés ramenés à la lettre de base, tout
--    non-alphanumérique ASCII devient '-'.
--    TOUT passe par translate(), jamais par lower() : le résultat ne doit
--    rien devoir à la collation de la base (une base en « C » laisserait
--    « OMah » tel quel et le nom serait rayé du slug par le regexp).
CREATE OR REPLACE FUNCTION public.slugify(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(
    regexp_replace(
      regexp_replace(
        translate(
          p_name,
          'àáâãäåèéêëìíîïòóôõöùúûüýÿçñšž' ||
          'ÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÝÇÑŠŽ' ||
          'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
          'aaaaaaeeeeeeeeioooooouuuuyycnsz' ||
          'aaaaaaeeeeeeeeioooooouuuuyycnsz' ||
          'abcdefghijklmnopqrstuvwxyz'
        ),
        '[^a-z0-9]+', '-', 'g'
      ),
      '^-+|-+$', '', 'g'
    ),
    ''
  );
$$;

-- 2. Attribution du slug d'un artiste sans slug explicite : nom d'abord,
--    identifiant en dernier recours (les ids de la carte sont déjà
--    compatibles URL). Le suffixe -2, -3… lève les collisions avec un slug
--    posé par ailleurs ; le UNIQUE de 00057 reste le filet ultime.
CREATE OR REPLACE FUNCTION public.assign_artist_slug()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  base text;
  candidate text;
  n integer;
BEGIN
  -- Slug explicite (admin, profil revendiqué) : intouchable. Y compris lors
  -- d'un renommage — le lien déjà partagé doit continuer de résoudre.
  IF NEW.slug IS NOT NULL THEN
    RETURN NEW;
  END IF;

  base := COALESCE(public.slugify(NEW.name), public.slugify(NEW.id), NEW.id);
  candidate := base;
  n := 1;
  -- Collision contre les slugs ET les ids des autres artistes : un slug
  -- égal à l'id d'un voisin ferait se disputer deux profils la même adresse
  -- /artist/… (résolution SPA, page OG pré-générée, sitemap).
  WHILE EXISTS (
    SELECT 1 FROM public.map_artists m
    WHERE m.id IS DISTINCT FROM NEW.id
      AND (m.slug = candidate OR m.id = candidate)
  ) LOOP
    n := n + 1;
    candidate := base || '-' || n;
  END LOOP;
  NEW.slug := candidate;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_map_artists_assign_slug ON public.map_artists;
CREATE TRIGGER trg_map_artists_assign_slug
  BEFORE INSERT OR UPDATE OF name, slug ON public.map_artists
  FOR EACH ROW EXECUTE FUNCTION public.assign_artist_slug();

-- 3. Backfill. POURQUOI LIGNE PAR LIGNE et non un UPDATE global : les
--    requêtes d'un trigger BEFORE ne voient pas les modifications posées
--    par les lignes sœurs de la même commande — deux artistes homonymes
--    calculeraient le même slug et le UNIQUE ferait échouer la migration
--    entière. Un UPDATE par ligne rend chaque collision visible à la
--    suivante ; l'ordre par id la rend reproductible. SET slug = NULL ne
--    change rien : c'est le déclencheur (UPDATE OF slug) qui compte, et le
--    trigger fait le reste exactement comme pour les futurs imports.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id FROM public.map_artists WHERE slug IS NULL ORDER BY id
  LOOP
    UPDATE public.map_artists SET slug = NULL WHERE id = r.id;
  END LOOP;
END
$$;
