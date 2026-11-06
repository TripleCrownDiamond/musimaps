import { describe, expect, it } from 'vitest';
import { EMPTY_LEGAL_CONTENT, LEGAL_LINKS, hasLegalContent, legalContactEmail, legalPublicationIssues, normalizeLegalContent } from './legal';
import { siteUrl } from './urls';

describe('legal CMS contract', () => {
  it('has no invented identity or policy fallback', () => {
    expect(normalizeLegalContent(undefined)).toEqual(EMPTY_LEGAL_CONTENT);
    expect(hasLegalContent(null)).toBe(false);
    expect(legalPublicationIssues(null)).toHaveLength(5);
  });
  it('normalizes invalid and partially migrated content', () => {
    expect(normalizeLegalContent({ publisherName: 42, privacy: { fr: 'Texte', en: false }, terms: null }).privacy)
      .toEqual({ fr: 'Texte', en: '' });
    expect(normalizeLegalContent({ publisherName: 42 }).publisherName).toBe('');
  });
  it('keeps the technical lead and the public phone, which stay optional', () => {
    const legal = normalizeLegalContent({ technicalLead: 'Test lead', contactPhone: '+229 00 00 00 00', publisherName: 'P' });
    expect([legal.technicalLead, legal.contactPhone]).toEqual(['Test lead', '+229 00 00 00 00']);
    expect(normalizeLegalContent({ technicalLead: 7 }).technicalLead).toBe('');
    expect(legalPublicationIssues(legal)).not.toContain('legal.contactPhone');
  });
  it('requires both document translations, an identity and a valid contact', () => {
    const legal = { ...EMPTY_LEGAL_CONTENT, publisherName: 'Test publisher', contactEmail: 'contact@example.invalid',
      privacy: { fr: 'FR', en: 'EN' }, terms: { fr: 'FR', en: 'EN' }, deletion: { fr: 'FR', en: '' } };
    expect(legalPublicationIssues(legal)).toEqual(['legal.deletion']);
    expect(legalPublicationIssues({ ...legal, deletion: { fr: 'FR', en: 'EN' } })).toEqual([]);
    expect(hasLegalContent(legal)).toBe(true);
  });
  it('rejects invalid contacts and header injection', () => {
    expect(legalContactEmail(' contact@example.invalid ')).toBe('contact@example.invalid');
    expect(legalContactEmail('contact@example.invalid\nBcc: someone@example.invalid')).toBeNull();
    expect(legalContactEmail('not an email')).toBeNull();
  });
  it('shares exactly the same canonical links across web and native', () => {
    expect(LEGAL_LINKS.map(({ path }) => siteUrl(path))).toEqual([
      'https://musimaps.com/confidentialite', 'https://musimaps.com/cgu', 'https://musimaps.com/supprimer-compte',
    ]);
  });
});
