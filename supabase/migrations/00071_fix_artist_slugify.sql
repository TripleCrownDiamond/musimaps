-- ============================================================
-- 00071 — Répare le slugify de 00069 : le backfill a mal translittéré.
--
-- Le translate() de 00069 alignait mal ses tables : la ligne bas de casse
-- fait 34 caractères contre 33 pour les deux autres (« ç » manquant).
-- translate() remplace le N-ième caractère de la source par le N-ième de la
-- cible : tout est décalé d'un cran à partir de « ç ». En production :
-- Tom Frager → « oom-arager », Souad Massi → « nouad-hassi » — chaque
-- majuscule prise pour la voisine (« T »→« o », « S »→« n », « E »→« z »…).
--
-- ICI.
--   1. public.slugify() réécrite sans table positionnelle : chaque
--      correspondance est une paire complète « source:base », impossible à
--      désaligner. Mêmes règles que le slugify TypeScript de @musimaps/shared
--      (lettres accentuées → lettre de base, A-Z → a-z, tout le reste est un
--      séparateur, tirets compressés et rognés, NULL si vide).
--   2. Réparation des données : les slugs produits par la version défectueuse
--      sont recalculés. Les slugs posés à la main (admin, « lien perso ») —
--      préservés par 00069 comme par celle-ci — ne ressemblent pas à la
--      sortie du slugify bogué et ne sont donc pas touchés ; en particulier
--      les liens déjà partagés continuent de résoudre.
--   3. Le trigger de 00069 n'a pas changé : il appelle public.slugify(), il
--      profite donc de la correction pour tous les futurs artistes.
-- ============================================================

CREATE OR REPLACE FUNCTION public.slugify(p_name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  -- Paires « source:base » indépendantes les unes des autres : la faute de
  -- 00069 (tables désalignées) est structurellement impossible ici.
  pairs CONSTANT text[] := ARRAY[
    'à:a','á:a','â:a','ã:a','ä:a','å:a',
    'è:e','é:e','ê:e','ë:e',
    'ì:i','í:i','î:i','ï:i',
    'ò:o','ó:o','ô:o','õ:o','ö:o',
    'ù:u','ú:u','û:u','ü:u',
    'ý:y','ÿ:y',
    'ç:c','ñ:n','š:s','ž:z',
    'À:a','Á:a','Â:a','Ã:a','Ä:a','Å:a',
    'È:e','É:e','Ê:e','Ë:e',
    'Ì:i','Í:i','Î:i','Ï:i',
    'Ò:o','Ó:o','Ô:o','Õ:o','Ö:o',
    'Ù:u','Ú:u','Û:u','Ü:u',
    'Ý:y','Ÿ:y',
    'Ç:c','Ñ:n','Š:s','Ž:z'
  ];
  s text;
  ch text;
  hit text;
  v_out text := '';
  i integer;
BEGIN
  IF p_name IS NULL THEN
    RETURN NULL;
  END IF;
  s := p_name;
  FOR i IN 1..length(s) LOOP
    ch := substr(s, i, 1);
    IF ch ~ '[a-z0-9]' THEN
      v_out := v_out || ch;
    ELSIF ch ~ '[A-Z]' THEN
      v_out := v_out || chr(ascii(ch) + 32);
    ELSE
      SELECT split_part(p, ':', 2) INTO hit
        FROM unnest(pairs) AS p
       WHERE split_part(p, ':', 1) = ch
       LIMIT 1;
      -- Sans correspondance (espace, ponctuation, lettre exotique) :
      -- séparateur, comme le `/[\W_]+/g` du slugify TypeScript.
      v_out := v_out || COALESCE(hit, '-');
    END IF;
  END LOOP;
  v_out := regexp_replace(v_out, '-{2,}', '-', 'g');
  v_out := regexp_replace(v_out, '^-+|-+$', '', 'g');
  RETURN NULLIF(v_out, '');
END;
$$;

-- Réparation des données. On identifie les slugs issus de la version
-- défectueuse en recalculant SA sortie (le translate() bogué de 00069, avec
-- ses tables désalignées et donc son « ç » avalé) : un slug qui lui est égal
-- — éventuellement suffixé -2, -3… par une collision — est un slug posé par
-- le backfill de 00069, pas par un humain. On remet ces lignes à NULL puis
-- on relance le backfill ligne par ligne de 00069 : le trigger attribue le
-- bon slug, en évitant les slugs préservés et les ids voisins.
DO $$
DECLARE
  r record;
  buggy_source CONSTANT text :=
    'àáâãäåèéêëìíîïòóôõöùúûüýÿçñšž' ||
    'ÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÝÇÑŠŽ' ||
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  buggy_target CONSTANT text :=
    'aaaaaaeeeeeeeeioooooouuuuyycnsz' ||
    'aaaaaaeeeeeeeeioooooouuuuyycnsz' ||
    'abcdefghijklmnopqrstuvwxyz';
BEGIN
  FOR r IN
    SELECT id, slug FROM public.map_artists
     WHERE slug IS NOT NULL
       AND (
         slug = NULLIF(
           regexp_replace(
             regexp_replace(translate(name, buggy_source, buggy_target), '[^a-z0-9]+', '-', 'g'),
             '^-+|-+$', '', 'g'
           ), ''
         )
         OR slug ~ ('^' || COALESCE(
              NULLIF(
                regexp_replace(
                  regexp_replace(translate(name, buggy_source, buggy_target), '[^a-z0-9]+', '-', 'g'),
                  '^-+|-+$', '', 'g'
                ), ''
              ) || '-[0-9]+$',
              '\x00\x00\x00 impossible \x00\x00\x00'
            ))
       )
     ORDER BY id
  LOOP
    UPDATE public.map_artists SET slug = NULL WHERE id = r.id;
  END LOOP;

  -- Même backfill que 00069 : ligne par ligne, pour que chaque trigger voie
  -- les slugs posés par les lignes précédentes (sinon, deux homonymes
  -- calculeraient le même candidat dans la même commande).
  FOR r IN
    SELECT id FROM public.map_artists WHERE slug IS NULL ORDER BY id
  LOOP
    UPDATE public.map_artists SET slug = NULL WHERE id = r.id;
  END LOOP;
END
$$;
