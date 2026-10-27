-- ============================================================
-- 00081 — slugify aligné sur @musimaps/shared, réparation idempotente.
--
-- PROBLÈME. 00071 a corrigé le translate() désaligné de 00069, mais :
--   1. sa table de paires ne couvre que les accents latins usuels. Toute
--      autre lettre décomposable devient un séparateur, alors que le
--      slugify TypeScript (NFD puis retrait des diacritiques) la garde :
--      « Àṣà » → « a-a » en base contre « asa » côté web, « Ọlamide » →
--      « lamide » contre « olamide ». Même chose pour ă, ł… et pour la
--      coupe à 80 caractères, absente du SQL ;
--   2. rejouer 00069 — c'est ce que faisait le test de backfill, et ce que
--      ferait quiconque relance « le backfill » — réinstalle le slugify
--      bogué : « Angélique Kidjo » → « yngelique-fidjo ». Le backfill vit
--      désormais ICI, dans une migration rejouable sans danger.
--
-- ICI.
--   1. public.slugify() suit pas à pas le slugify TypeScript : NFD, retrait
--      des diacritiques U+0300–U+036F, A-Z → a-z (translate, indépendant de
--      la collation), tout le reste → '-', tirets rognés, 80 caractères.
--   2. Réparation : un slug égal à la sortie du slugify INSTALLÉ AVANT
--      cette migration (éventuellement suffixé -2, -3… par une collision)
--      a été posé par un backfill ou le trigger, pas par un humain. S'il
--      diffère du nouveau calcul, il est recalculé. Tout autre slug (admin,
--      « lien perso ») est intouché, de même que les slugs automatiques
--      déjà corrects : leurs liens partagés continuent de résoudre.
--   3. Backfill ligne par ligne (même raison que 00069 : chaque trigger
--      doit voir les slugs posés par les lignes précédentes).
--
-- Rejouée, la migration ne change rien : le slugify « d'avant » est alors
-- celui-ci, aucun slug ne diffère, seul le backfill des slugs NULL agit.
-- ============================================================

-- Sortie de l'ancien slugify, capturée AVANT de le remplacer : c'est la
-- seule façon fiable de reconnaître ce qu'il a produit (00071 en prod, ou
-- 00069 si quelqu'un l'a rejouée).
CREATE TEMP TABLE slug_before_00081 AS
  SELECT id, public.slugify(name) AS old_base
    FROM public.map_artists
   WHERE slug IS NOT NULL;

CREATE OR REPLACE FUNCTION public.slugify(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(
    left(
      regexp_replace(
        regexp_replace(
          translate(
            regexp_replace(normalize(p_name, NFD), '[̀-ͯ]', '', 'g'),
            'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
            'abcdefghijklmnopqrstuvwxyz'
          ),
          '[^a-z0-9]+', '-', 'g'
        ),
        '^-+|-+$', '', 'g'
      ),
      80
    ),
    ''
  );
$$;

DO $$
DECLARE
  r record;
BEGIN
  -- old_base ne contient que [a-z0-9-] : sûr à concaténer dans un regexp.
  FOR r IN
    SELECT m.id
      FROM public.map_artists m
      JOIN slug_before_00081 b ON b.id = m.id
     WHERE b.old_base IS NOT NULL
       AND b.old_base IS DISTINCT FROM public.slugify(m.name)
       AND (m.slug = b.old_base OR m.slug ~ ('^' || b.old_base || '-[0-9]+$'))
     ORDER BY m.id
  LOOP
    UPDATE public.map_artists SET slug = NULL WHERE id = r.id;
  END LOOP;

  FOR r IN
    SELECT id FROM public.map_artists WHERE slug IS NULL ORDER BY id
  LOOP
    UPDATE public.map_artists SET slug = NULL WHERE id = r.id;
  END LOOP;
END
$$;

DROP TABLE slug_before_00081;
