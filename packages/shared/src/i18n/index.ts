export { fr, type MessageKey } from './fr';
export { en } from './en';

import { fr } from './fr';
import { en } from './en';
import type { MessageKey } from './fr';

export type Lang = 'fr' | 'en';

export const MESSAGES: Record<Lang, Record<MessageKey, string>> = { fr, en };

/**
 * Resout un message et substitue les parametres `{nom}`.
 * Repli : langue demandee -> francais -> la cle elle-meme.
 */
export function translate(
  lang: Lang,
  key: MessageKey,
  params?: Record<string, string | number>,
): string {
  let template: string = MESSAGES[lang][key] ?? MESSAGES.fr[key] ?? key;
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      template = template.replaceAll(`{${name}}`, String(value));
    }
  }
  return template;
}
