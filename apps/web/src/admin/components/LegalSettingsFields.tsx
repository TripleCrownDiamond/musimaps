import { ShieldCheck } from 'lucide-react'
import {
  LEGAL_LINKS, legalPublicationIssues, normalizeLegalContent, siteUrl,
  type LegalContent, type MessageKey,
} from '@musimaps/shared'
import { useLanguage } from '@/i18n/LanguageContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

const IDENTITY_FIELDS = ['publisherName', 'publisherAddress', 'registrationNumber', 'contactEmail', 'updatedOn'] as const

export function LegalSettingsFields({ value, onChange }: {
  value?: LegalContent
  onChange: (value: LegalContent) => void
}) {
  const { t } = useLanguage()
  const legal = normalizeLegalContent(value)
  const issues = legalPublicationIssues(legal)
  return (
    <Card id="legal" className="scroll-mt-24">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ShieldCheck className="size-5" />{t('legal.title')}</CardTitle>
        <CardDescription>{t('legal.adminDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <p role="status" className="rounded-xl border bg-muted p-4 text-sm">
          {issues.length
            ? t('legal.incomplete', { fields: issues.map((key) => t(key)).join(', ') })
            : t('legal.complete')}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {IDENTITY_FIELDS.map((field) => (
            <label key={field} className="grid gap-2 text-sm font-medium">
              {t(`legal.${field}` as MessageKey)}
              <Input
                type={field === 'contactEmail' ? 'email' : field === 'updatedOn' ? 'date' : 'text'}
                value={legal[field]}
                onChange={(event) => onChange({ ...legal, [field]: event.target.value })}
              />
            </label>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">{t('legal.identityHint')}</p>
        {LEGAL_LINKS.map(({ document, path, label }) => (
          <fieldset key={document} className="grid min-w-0 gap-4 border-t pt-5">
            <legend className="px-1 text-base font-semibold">{t(label)}</legend>
            <p className="text-sm text-muted-foreground">{t(`legal.${document}Hint`)}</p>
            <p className="text-xs text-muted-foreground">{t('legal.documentHint')}</p>
            <div className="grid gap-4 xl:grid-cols-2">
              {(['fr', 'en'] as const).map((language) => (
                <label key={language} className="grid gap-2 text-sm font-medium">
                  {t(label)} — {t(language === 'fr' ? 'lang.french' : 'lang.english')}
                  <Textarea rows={10} value={legal[document][language]}
                    onChange={(event) => onChange({ ...legal, [document]: { ...legal[document], [language]: event.target.value } })} />
                  <a className="break-all text-brand-deep underline" href={siteUrl(path, language)} target="_blank" rel="noopener noreferrer">
                    {siteUrl(path, language)}
                  </a>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </CardContent>
    </Card>
  )
}
