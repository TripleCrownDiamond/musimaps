import { Link } from 'react-router-dom'
import { LEGAL_LINKS, formatLegalDate, legalContactEmail, normalizeLegalContent, type LegalDocument } from '@musimaps/shared'
import { useCms } from '@/context/CmsContext'
import { useAuth } from '@/context/AuthContext'
import { useLanguage, useLocalizedPath } from '@/i18n/LanguageContext'
import Footer from '@/components/Footer'
import Loader from '@/components/Loader'

/** One canonical set of published documents for the website and native app. */
export default function Legal({ document }: { document: LegalDocument }) {
  const { content, loading } = useCms()
  const { user } = useAuth()
  const { t, lang } = useLanguage()
  const localize = useLocalizedPath()
  const legal = normalizeLegalContent(content.settings.legal)
  const email = legalContactEmail(legal.contactEmail)
  const body = legal[document][lang].trim()
  const accountPath = localize('/profil#delete-account')
  // La date vient d'un champ date de l'admin (2026-09-20) : telle quelle, elle
  // s'affichait en format machine au milieu d'un texte rédigé.
  const updatedOn = formatLegalDate(legal.updatedOn, lang)
  return (
    <>
      <main className="min-h-screen bg-warm-white px-6 pt-44 pb-20 text-primary-text">
        <article className="mx-auto max-w-3xl break-words">
          <p className="mb-3 text-sm font-semibold text-brand-deep">Musimaps</p>
          <h1 className="display-font text-3xl font-bold sm:text-4xl">{t(`legal.${document}`)}</h1>
          <nav aria-label={t('legal.title')} className="my-6 flex flex-wrap gap-4 text-sm">
            {LEGAL_LINKS.map((link) => (
              <Link key={link.document} to={localize(link.path)} aria-current={document === link.document ? 'page' : undefined}
                className="underline underline-offset-4 hover:text-brand-deep">{t(link.label)}</Link>
            ))}
          </nav>
          {loading ? <Loader /> : (
            <>
              <dl className="my-8 grid gap-4 rounded-2xl border border-hairline bg-surface p-6 text-sm">
                {(['publisherName', 'publisherAddress', 'registrationNumber', 'updatedOn'] as const).map((field) => legal[field].trim() ? (
                  <div key={field}>
                    <dt className="font-semibold">{t(`legal.${field}`)}</dt>
                    <dd className="mt-1 whitespace-pre-line text-secondary-text">{field === 'updatedOn' ? updatedOn : legal[field]}</dd>
                  </div>
                ) : null)}
                {email && <div><dt className="font-semibold">{t('legal.contact')}</dt><dd className="mt-1"><a className="underline" href={`mailto:${encodeURIComponent(email)}`}>{email}</a></dd></div>}
                {!body && <p role="status">{t('legal.unavailable')}</p>}
              </dl>
              {body && <div data-testid="legal-document" className="space-y-5 text-base leading-relaxed">
                {body.split(/\n\s*\n/).map((paragraph, index) => <p key={index} className="whitespace-pre-line">{paragraph}</p>)}
              </div>}
              {document === 'deletion' && <section className="mt-8 grid gap-5 rounded-2xl border border-hairline bg-surface p-6">
                <p className="leading-relaxed">{t('legal.deleteSteps')}</p>
                <Link to={user ? accountPath : localize('/login')} state={user ? undefined : { from: accountPath }}
                  className="w-fit rounded-full bg-brand-deep px-5 py-3 text-center font-semibold text-brand-deep-foreground">{t('legal.deleteAction')}</Link>
                {email && <>
                  <p className="text-sm leading-relaxed text-secondary-text">{t('legal.deleteEmail')}</p>
                  <a className="break-all underline" href={`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(t('legal.deleteSubject'))}`}>{email}</a>
                </>}
              </section>}
            </>
          )}
        </article>
      </main>
      <Footer />
    </>
  )
}
