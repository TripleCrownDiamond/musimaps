import type { Lang, MessageKey } from '../i18n';
import { LEGAL_PATHS } from './urls';

export const LEGAL_DOCUMENTS = ['privacy', 'terms', 'deletion'] as const;
export type LegalDocument = typeof LEGAL_DOCUMENTS[number];

/** Global CMS settings: identity is shared; documents have explicit translations. */
export interface LegalContent {
  publisherName: string;
  publisherAddress: string;
  registrationNumber: string;
  contactEmail: string;
  updatedOn: string;
  privacy: Record<Lang, string>;
  terms: Record<Lang, string>;
  deletion: Record<Lang, string>;
}

export const EMPTY_LEGAL_CONTENT: LegalContent = {
  publisherName: '', publisherAddress: '', registrationNumber: '', contactEmail: '', updatedOn: '',
  privacy: { fr: '', en: '' }, terms: { fr: '', en: '' }, deletion: { fr: '', en: '' },
};

export const LEGAL_LINKS = LEGAL_DOCUMENTS.map((document) => ({
  document, path: LEGAL_PATHS[document], label: `legal.${document}` as MessageKey,
}));

/** Ignore invalid legacy values; never substitute invented legal information. */
export function normalizeLegalContent(value: unknown): LegalContent {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const text = (value: unknown) => typeof value === 'string' ? value : '';
  const localized = (key: LegalDocument) => {
    const translations = raw[key] && typeof raw[key] === 'object'
      ? raw[key] as Record<string, unknown> : {};
    return { fr: text(translations.fr), en: text(translations.en) };
  };
  return {
    publisherName: text(raw.publisherName), publisherAddress: text(raw.publisherAddress),
    registrationNumber: text(raw.registrationNumber), contactEmail: text(raw.contactEmail),
    updatedOn: text(raw.updatedOn), privacy: localized('privacy'),
    terms: localized('terms'), deletion: localized('deletion'),
  };
}

export function legalContactEmail(value: string): string | null {
  const email = value.trim();
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) ? email : null;
}

/** Structural completeness only, not a legal or Store compliance certification. */
export function legalPublicationIssues(value: unknown): MessageKey[] {
  const legal = normalizeLegalContent(value);
  const issues: MessageKey[] = [];
  if (!legal.publisherName.trim()) issues.push('legal.publisherName');
  if (!legalContactEmail(legal.contactEmail)) issues.push('legal.contactEmail');
  for (const document of LEGAL_DOCUMENTS) {
    if (!legal[document].fr.trim() || !legal[document].en.trim()) issues.push(`legal.${document}`);
  }
  return issues;
}

export function hasLegalContent(value: unknown): boolean {
  const legal = normalizeLegalContent(value);
  return Object.values(legal).some((field) => typeof field === 'string'
    ? Boolean(field.trim()) : Boolean(field.fr.trim() || field.en.trim()));
}
