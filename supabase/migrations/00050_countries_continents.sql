-- ============================================================
-- 00050 — Continents et pays normalisés
--
-- Ajoute à map_artists :
--   - continent  : continent du pays (Afrique, Europe, Amérique du Nord…)
--   - country_code : code ISO 3166-1 alpha-2 (déjà stocké dans country pour
--                    la majorité des pins, mais certains pays restent en
--                    toutes lettres — on normalise ici).
-- Backfill : continent dérivé du code ISO via une table de correspondance
-- embarquée (pas de dépendance externe).
-- ============================================================

ALTER TABLE public.map_artists
  ADD COLUMN IF NOT EXISTS continent      TEXT,
  ADD COLUMN IF NOT EXISTS country_code   TEXT;

-- Correspondance ISO → continent (seuls les codes présents en base importent).
UPDATE public.map_artists
   SET continent = CASE country
     WHEN 'DZ' THEN 'Afrique' WHEN 'AO' THEN 'Afrique' WHEN 'BJ' THEN 'Afrique'
     WHEN 'BW' THEN 'Afrique' WHEN 'BF' THEN 'Afrique' WHEN 'BI' THEN 'Afrique'
     WHEN 'CV' THEN 'Afrique' WHEN 'CM' THEN 'Afrique' WHEN 'CF' THEN 'Afrique'
     WHEN 'TD' THEN 'Afrique' WHEN 'KM' THEN 'Afrique' WHEN 'CG' THEN 'Afrique'
     WHEN 'CD' THEN 'Afrique' WHEN 'CI' THEN 'Afrique' WHEN 'DJ' THEN 'Afrique'
     WHEN 'EG' THEN 'Afrique' WHEN 'GQ' THEN 'Afrique' WHEN 'ER' THEN 'Afrique'
     WHEN 'SZ' THEN 'Afrique' WHEN 'ET' THEN 'Afrique' WHEN 'GA' THEN 'Afrique'
     WHEN 'GM' THEN 'Afrique' WHEN 'GH' THEN 'Afrique' WHEN 'GN' THEN 'Afrique'
     WHEN 'GW' THEN 'Afrique' WHEN 'KE' THEN 'Afrique' WHEN 'LS' THEN 'Afrique'
     WHEN 'LR' THEN 'Afrique' WHEN 'LY' THEN 'Afrique' WHEN 'MG' THEN 'Afrique'
     WHEN 'MW' THEN 'Afrique' WHEN 'ML' THEN 'Afrique' WHEN 'MR' THEN 'Afrique'
     WHEN 'MU' THEN 'Afrique' WHEN 'MA' THEN 'Afrique' WHEN 'MZ' THEN 'Afrique'
     WHEN 'NA' THEN 'Afrique' WHEN 'NE' THEN 'Afrique' WHEN 'NG' THEN 'Afrique'
     WHEN 'RW' THEN 'Afrique' WHEN 'ST' THEN 'Afrique' WHEN 'SN' THEN 'Afrique'
     WHEN 'SC' THEN 'Afrique' WHEN 'SL' THEN 'Afrique' WHEN 'SO' THEN 'Afrique'
     WHEN 'ZA' THEN 'Afrique' WHEN 'SS' THEN 'Afrique' WHEN 'SD' THEN 'Afrique'
     WHEN 'TZ' THEN 'Afrique' WHEN 'TG' THEN 'Afrique' WHEN 'TN' THEN 'Afrique'
     WHEN 'UG' THEN 'Afrique' WHEN 'ZM' THEN 'Afrique' WHEN 'ZW' THEN 'Afrique'
     WHEN 'AF' THEN 'Asie' WHEN 'AM' THEN 'Asie' WHEN 'AZ' THEN 'Asie'
     WHEN 'BH' THEN 'Asie' WHEN 'BD' THEN 'Asie' WHEN 'BT' THEN 'Asie'
     WHEN 'BN' THEN 'Asie' WHEN 'KH' THEN 'Asie' WHEN 'CN' THEN 'Asie'
     WHEN 'CY' THEN 'Asie' WHEN 'GE' THEN 'Asie' WHEN 'HK' THEN 'Asie'
     WHEN 'IN' THEN 'Asie' WHEN 'ID' THEN 'Asie' WHEN 'IR' THEN 'Asie'
     WHEN 'IQ' THEN 'Asie' WHEN 'IL' THEN 'Asie' WHEN 'JP' THEN 'Asie'
     WHEN 'JO' THEN 'Asie' WHEN 'KZ' THEN 'Asie' WHEN 'KW' THEN 'Asie'
     WHEN 'KG' THEN 'Asie' WHEN 'LA' THEN 'Asie' WHEN 'LB' THEN 'Asie'
     WHEN 'MY' THEN 'Asie' WHEN 'MV' THEN 'Asie' WHEN 'MN' THEN 'Asie'
     WHEN 'MM' THEN 'Asie' WHEN 'NP' THEN 'Asie' WHEN 'KP' THEN 'Asie'
     WHEN 'OM' THEN 'Asie' WHEN 'PK' THEN 'Asie' WHEN 'PS' THEN 'Asie'
     WHEN 'PH' THEN 'Asie' WHEN 'QA' THEN 'Asie' WHEN 'SA' THEN 'Asie'
     WHEN 'SG' THEN 'Asie' WHEN 'KR' THEN 'Asie' WHEN 'LK' THEN 'Asie'
     WHEN 'SY' THEN 'Asie' WHEN 'TW' THEN 'Asie' WHEN 'TJ' THEN 'Asie'
     WHEN 'TH' THEN 'Asie' WHEN 'TR' THEN 'Asie' WHEN 'TM' THEN 'Asie'
     WHEN 'AE' THEN 'Asie' WHEN 'UZ' THEN 'Asie' WHEN 'VN' THEN 'Asie'
     WHEN 'YE' THEN 'Asie'
     WHEN 'AL' THEN 'Europe' WHEN 'AT' THEN 'Europe' WHEN 'BY' THEN 'Europe'
     WHEN 'BE' THEN 'Europe' WHEN 'BA' THEN 'Europe' WHEN 'BG' THEN 'Europe'
     WHEN 'HR' THEN 'Europe' WHEN 'CZ' THEN 'Europe' WHEN 'DK' THEN 'Europe'
     WHEN 'EE' THEN 'Europe' WHEN 'FI' THEN 'Europe' WHEN 'FR' THEN 'Europe'
     WHEN 'DE' THEN 'Europe' WHEN 'GR' THEN 'Europe' WHEN 'HU' THEN 'Europe'
     WHEN 'IS' THEN 'Europe' WHEN 'IE' THEN 'Europe' WHEN 'IT' THEN 'Europe'
     WHEN 'LV' THEN 'Europe' WHEN 'LI' THEN 'Europe' WHEN 'LT' THEN 'Europe'
     WHEN 'LU' THEN 'Europe' WHEN 'MT' THEN 'Europe' WHEN 'MD' THEN 'Europe'
     WHEN 'MC' THEN 'Europe' WHEN 'ME' THEN 'Europe' WHEN 'NL' THEN 'Europe'
     WHEN 'MK' THEN 'Europe' WHEN 'NO' THEN 'Europe' WHEN 'PL' THEN 'Europe'
     WHEN 'PT' THEN 'Europe' WHEN 'RO' THEN 'Europe' WHEN 'RU' THEN 'Europe'
     WHEN 'RS' THEN 'Europe' WHEN 'SK' THEN 'Europe' WHEN 'SI' THEN 'Europe'
     WHEN 'ES' THEN 'Europe' WHEN 'SE' THEN 'Europe' WHEN 'CH' THEN 'Europe'
     WHEN 'UA' THEN 'Europe' WHEN 'GB' THEN 'Europe' WHEN 'VA' THEN 'Europe'
     WHEN 'CA' THEN 'Amérique du Nord' WHEN 'US' THEN 'Amérique du Nord'
     WHEN 'MX' THEN 'Amérique du Nord' WHEN 'CR' THEN 'Amérique du Nord'
     WHEN 'CU' THEN 'Amérique du Nord' WHEN 'DO' THEN 'Amérique du Nord'
     WHEN 'SV' THEN 'Amérique du Nord' WHEN 'GT' THEN 'Amérique du Nord'
     WHEN 'HT' THEN 'Amérique du Nord' WHEN 'HN' THEN 'Amérique du Nord'
     WHEN 'JM' THEN 'Amérique du Nord' WHEN 'NI' THEN 'Amérique du Nord'
     WHEN 'PA' THEN 'Amérique du Nord' WHEN 'PR' THEN 'Amérique du Nord'
     WHEN 'TT' THEN 'Amérique du Nord' WHEN 'BS' THEN 'Amérique du Nord'
     WHEN 'BB' THEN 'Amérique du Nord' WHEN 'BZ' THEN 'Amérique du Nord'
     WHEN 'AR' THEN 'Amérique du Sud' WHEN 'BO' THEN 'Amérique du Sud'
     WHEN 'BR' THEN 'Amérique du Sud' WHEN 'CL' THEN 'Amérique du Sud'
     WHEN 'CO' THEN 'Amérique du Sud' WHEN 'EC' THEN 'Amérique du Sud'
     WHEN 'GY' THEN 'Amérique du Sud' WHEN 'PY' THEN 'Amérique du Sud'
     WHEN 'PE' THEN 'Amérique du Sud' WHEN 'SR' THEN 'Amérique du Sud'
     WHEN 'UY' THEN 'Amérique du Sud' WHEN 'VE' THEN 'Amérique du Sud'
     WHEN 'AU' THEN 'Océanie' WHEN 'NZ' THEN 'Océanie' WHEN 'FJ' THEN 'Océanie'
     WHEN 'PG' THEN 'Océanie' WHEN 'SB' THEN 'Océanie' WHEN 'VU' THEN 'Océanie'
     WHEN 'PF' THEN 'Océanie' WHEN 'NC' THEN 'Océanie'
   END;

-- country_code : normalise country en ISO (2 lettres déjà = ISO ; les noms
-- en toutes lettres restants sont mappés manuellement).
UPDATE public.map_artists
   SET country_code = UPPER(TRIM(country))
 WHERE country ~ '^[A-Za-z]{2}$';

UPDATE public.map_artists
   SET country_code = CASE LOWER(country)
     WHEN 'bénin' THEN 'BJ' WHEN 'benin' THEN 'BJ' WHEN 'nigéria' THEN 'NG'
     WHEN 'nigeria' THEN 'NG' WHEN 'france' THEN 'FR' WHEN 'ghana' THEN 'GH'
     WHEN 'sénégal' THEN 'SN' WHEN 'senegal' THEN 'SN' WHEN 'côte d''ivoire' THEN 'CI'
     WHEN 'cote d''ivoire' THEN 'CI' WHEN 'cameroun' THEN 'CM' WHEN 'cameroon' THEN 'CM'
     WHEN 'guinée' THEN 'GN' WHEN 'guinee' THEN 'GN' WHEN 'togo' THEN 'TG'
     WHEN 'république démocratique du congo' THEN 'CD' WHEN 'rdc' THEN 'CD'
     WHEN 'congo' THEN 'CD' WHEN 'brésil' THEN 'BR' WHEN 'bresil' THEN 'BR'
     WHEN 'canada' THEN 'CA' WHEN 'royaume-uni' THEN 'GB' WHEN 'royaume uni' THEN 'GB'
     WHEN 'états-unis' THEN 'US' WHEN 'etats-unis' THEN 'US' WHEN 'usa' THEN 'US'
     WHEN 'allemagne' THEN 'DE' WHEN 'belgique' THEN 'BE' WHEN 'suisse' THEN 'CH'
   END
 WHERE country_code IS NULL;
