import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { CheckCircle, Globe2, Headphones, Mic2, Share2, Users } from 'lucide-react'
import PulseDots from '../components/PulseDots'
import Footer from '../components/Footer'
import Countdown from '../components/Countdown'
import { useAuth } from '../context/AuthContext'
import { useLanguage, useLocalizedPath } from '../i18n/LanguageContext'
import { positionFor, type Profile } from '../lib/waitlist'

interface ConfirmationState {
  email?: string
  profile?: Profile
}

export default function Confirmation() {
  const location = useLocation()
  const navigate = useNavigate()
  const localize = useLocalizedPath()
  const { t } = useLanguage()
  const { user, loading } = useAuth()
  const state = (location.state ?? {}) as ConfirmationState

  // Page accessible uniquement au retour du formulaire : sinon on renvoie a l'accueil.
  if (!state.email) return <Navigate to={localize('/')} replace />

  const isArtist = state.profile === 'artiste'

  return (
    <div className="flex min-h-screen flex-col">
      <main className="relative flex-1 overflow-hidden pb-24 pt-44">
        <div className="map-bg absolute inset-0 z-0 opacity-30" />
        <PulseDots
          positions={[
            { top: '15%', left: '20%' },
            { top: '65%', left: '10%' },
            { top: '40%', left: '85%' },
          ]}
        />

        <section className="relative z-20 mx-auto flex max-w-7xl flex-col items-center px-6">
          <div className="mb-12 flex flex-col items-center text-center">
            <span
              className={`mb-8 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${
                isArtist ? 'bg-brand-soft text-brand-deep' : 'bg-secondary-bg text-primary-text'
              }`}
            >
              {isArtist ? <Mic2 className="h-4 w-4" /> : <Headphones className="h-4 w-4" />}
              {isArtist ? t('confirm.badgeArtist') : t('confirm.badgeMelomane')}
            </span>
            <div
              className={`animate-check mb-8 flex h-24 w-24 items-center justify-center rounded-full ${
                isArtist ? 'bg-brand-soft text-brand-deep' : 'bg-brand text-black'
              }`}
            >
              <CheckCircle className="h-12 w-12" />
            </div>
            <h1 className="display-font mb-6 text-5xl font-extrabold tracking-tight md:text-7xl">
              {isArtist ? t('confirm.headingArtist') : t('confirm.headingMelomane')}
            </h1>
            <p className="max-w-2xl text-xl font-light text-secondary-text md:text-2xl">
              {isArtist ? t('confirm.descArtist') : t('confirm.descMelomane')}
            </p>
          </div>

          <div className="fade-in-up mb-16 w-full max-w-xl">
            <div className="floating-card space-y-4 rounded-3xl p-8 text-center">
              <p className="text-sm uppercase tracking-widest text-secondary-text">
                {t('confirm.savedFor')}
              </p>
              <p className="break-all text-xl font-medium">{state.email}</p>
              <p className="text-sm text-secondary-text">
                {t('confirm.positionPrefix')}{' '}
                <span className="font-bold text-primary-text">n° {positionFor(state.email)}</span>{' '}
                {t('confirm.positionSuffix')}
              </p>
              {isArtist && (
                <p className="rounded-2xl bg-brand-soft px-4 py-3 text-sm font-medium text-brand-deep">
                  {t('confirm.tipArtist')}
                </p>
              )}

              <div className="space-y-3 pt-2">
                {user && !loading ? (
                  <>
                    <p className="text-sm font-medium text-primary-text">
                      {t('confirm.alreadyAccount')}
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate(localize('/dashboard'))}
                      className="w-full rounded-full bg-brand-deep py-4 font-bold text-brand-deep-foreground transition-transform hover:scale-[1.02]"
                    >
                      {t('confirm.viewProfile')}
                    </button>
                  </>
                ) : loading ? null : (
                  <>
                    <p className="text-sm font-medium text-primary-text">
                      {isArtist ? t('confirm.ctaArtist') : t('confirm.ctaMelomane')}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        navigate(localize('/signup'), {
                          state: {
                            role: isArtist ? 'artist' : 'melomane',
                            email: state.email,
                          },
                        })
                      }
                      className="w-full rounded-full bg-brand-deep py-4 font-bold text-brand-deep-foreground transition-transform hover:scale-[1.02]"
                    >
                      {isArtist ? t('confirm.createArtist') : t('confirm.createMelomane')}
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => navigate(localize('/globe'))}
                  className="w-full rounded-full border border-hairline-strong py-4 font-medium transition-colors hover:bg-secondary-bg"
                >
                  {t('confirm.explore')}
                </button>
              </div>
            </div>
          </div>

          <div className="fade-in-up mb-20 text-center" style={{ animationDelay: '0.2s' }}>
            <Countdown />
          </div>

          <div className="fade-in-up w-full space-y-12" style={{ animationDelay: '0.3s' }}>
            <h2 className="display-font text-center text-3xl uppercase tracking-tighter">
              {isArtist ? t('confirm.stepsArtist') : t('confirm.meanwhile')}
            </h2>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              <Link
                to={localize('/globe')}
                className="flex flex-col items-start gap-6 rounded-3xl border border-hairline bg-surface p-10 transition-shadow hover:shadow-lg"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand-deep">
                  <Globe2 className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="display-font mb-2 text-xl font-bold">
                    {isArtist ? t('confirm.card1ArtistTitle') : t('confirm.exploreTitle')}
                  </h3>
                  <p className="text-sm leading-relaxed text-secondary-text">
                    {isArtist ? t('confirm.card1ArtistText') : t('confirm.card1MelomaneText')}
                  </p>
                </div>
              </Link>

              <Link
                to={localize('/artistes')}
                className="flex flex-col items-start gap-6 rounded-3xl border border-hairline bg-surface p-10 transition-shadow hover:shadow-lg"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand-deep">
                  <Mic2 className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="display-font mb-2 text-xl font-bold">
                    {isArtist ? t('confirm.card2ArtistTitle') : t('confirm.artistTitle')}
                  </h3>
                  <p className="text-sm leading-relaxed text-secondary-text">
                    {isArtist ? t('confirm.card2ArtistText') : t('confirm.card2MelomaneText')}
                  </p>
                </div>
              </Link>

              <button
                type="button"
                onClick={() => {
                  const url = window.location.origin
                  if (navigator.share) {
                    navigator.share({ title: 'Musimaps', url }).catch(() => {})
                  } else {
                    navigator.clipboard?.writeText(url)
                  }
                }}
                className="flex flex-col items-start gap-6 rounded-3xl border border-hairline bg-surface p-10 text-left transition-shadow hover:shadow-lg"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand-deep">
                  <Users className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="display-font mb-2 text-xl font-bold">{t('confirm.shareTitle')}</h3>
                  <p className="flex items-center gap-2 text-sm leading-relaxed text-secondary-text">
                    <Share2 className="h-4 w-4" />
                    {isArtist ? t('confirm.shareArtistText') : t('confirm.shareText')}
                  </p>
                </div>
              </button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
