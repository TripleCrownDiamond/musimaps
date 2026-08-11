-- ============================================================
-- 00028 — Configuration du cache (gérée depuis l'admin)
--  - cache_version : version d'invalidation ?v=N appliquée aux
--    fichiers stables (favicon, og-image…) pour casser le cache.
--  - htaccess_cache : bloc <IfModule mod_headers/mod_expires>
--    injecté dans .htaccess au prochain déploiement.
-- Lecture publique (le script de déploiement lit sans compte),
-- écriture réservée aux administrateurs (is_admin).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.cache_config (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cache_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cache_config_read_public" ON public.cache_config;
CREATE POLICY "cache_config_read_public"
  ON public.cache_config FOR SELECT USING (true);

DROP POLICY IF EXISTS "cache_config_write_admin" ON public.cache_config;
CREATE POLICY "cache_config_write_admin"
  ON public.cache_config FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Valeurs par défaut : version de cache 1, et bloc de cache actuel.
INSERT INTO public.cache_config (key, value) VALUES
  ('cache_version', '1'),
  ('htaccess_cache', E'# ---------------------------------------------------------------\n# Cache headers\n# ---------------------------------------------------------------\n<IfModule mod_headers.c>\n  <FilesMatch "\.(html|htm)$">\n    Header set Cache-Control "no-cache, must-revalidate"\n  </FilesMatch>\n  <FilesMatch "\.(js|mjs|css|png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|eot|otf)$">\n    Header set Cache-Control "public, max-age=31536000, immutable"\n  </FilesMatch>\n  <FilesMatch "^favicon\.png$">\n    Header set Cache-Control "public, max-age=3600"\n  </FilesMatch>\n</IfModule>\n<IfModule mod_expires.c>\n  ExpiresActive On\n  ExpiresByType text/html "access plus 0 seconds"\n  ExpiresByType text/css "access plus 1 year"\n  ExpiresByType application/javascript "access plus 1 year"\n  ExpiresByType image/png "access plus 1 year"\n  ExpiresByType image/jpeg "access plus 1 year"\n  ExpiresByType image/gif "access plus 1 year"\n  ExpiresByType image/webp "access plus 1 year"\n  ExpiresByType image/avif "access plus 1 year"\n  ExpiresByType image/svg+xml "access plus 1 year"\n  ExpiresByType image/x-icon "access plus 1 year"\n  ExpiresByType font/woff2 "access plus 1 year"\n  ExpiresByType font/ttf "access plus 1 year"\n</IfModule>')
ON CONFLICT (key) DO NOTHING;
