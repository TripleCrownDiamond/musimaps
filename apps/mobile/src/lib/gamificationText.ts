import type { MessageKey } from '../i18n';

type Translate = (key: MessageKey, params?: Record<string, string | number>) => string;

/**
 * Titre ou description d'un badge dans la langue de l'app.
 *
 * Le catalogue (base ou défaut partagé) est rédigé en français : l'afficher
 * tel quel laissait « Globe-trotter — Visiter 8 villes » dans l'app anglaise.
 * Les clés `gamify.badge.*` portent les deux langues, comme sur le web ; un
 * badge sans clé (ajouté depuis l'admin) garde son libellé de catalogue.
 */
export function badgeText(t: Translate, id: string, field: 'title' | 'desc', fallback: string): string {
  const key = `gamify.badge.${id}.${field}`;
  const value = t(key as MessageKey);
  return value === key ? fallback : value;
}

/** Titre de niveau traduit — les paliers partagés sont rédigés en français. */
export function levelTitle(t: Translate, level: { level: number; title: string }): string {
  const key = `gamify.level.${level.level}`;
  const value = t(key as MessageKey);
  return value === key ? level.title : value;
}
