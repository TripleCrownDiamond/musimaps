/**
 * Routage par langue du site web.
 *
 * Les MESSAGES eux-mêmes ne vivent plus ici : ils sont dans
 * `packages/shared/src/i18n/`, partagés avec le mobile. Ce fichier ne garde
 * que ce qui est propre au web — le préfixe de langue dans l'URL.
 *
 * Pour ajouter ou modifier un texte : éditer `packages/shared/src/i18n/fr.ts`
 * et `en.ts`. Voir docs/REGLES-EVOLUTION.md.
 */
import type { Lang } from '@musimaps/shared'

export type { Lang, MessageKey } from '@musimaps/shared'
export { MESSAGES } from '@musimaps/shared'

/** Préfixe de langue dans l'URL : `/fr/...`, `/en/...`. */
export const LANG_PATH_RE = /^\/(fr|en)(?=\/|$)/

/**
 * Préfixe un chemin interne par la langue active : le français vit SANS
 * préfixe (`/globe`), l'anglais sous `/en` (`/en/globe`). Un préfixe de
 * langue existant est remplacé (bascule FR↔EN). Les liens externes (http,
 * mailto, tel) et les ancres (#) sont laissés tels quels.
 */
export function localizePath(path: string, lang: Lang): string {
  if (!path) return lang === 'en' ? '/en' : '/'
  if (/^(https?:|mailto:|tel:)/.test(path) || path.startsWith('#')) return path
  const clean = path.replace(LANG_PATH_RE, '') || '/'
  if (clean === '/') return lang === 'en' ? '/en' : '/'
  return lang === 'en' ? `/en${clean}` : clean
}
