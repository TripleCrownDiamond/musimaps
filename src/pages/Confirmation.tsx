import { Link, Navigate, useLocation } from 'react-router-dom'
import { CheckCircle, Globe2, Mic2, Share2, Users } from 'lucide-react'
import PulseDots from '../components/PulseDots'
import Footer from '../components/Footer'
import Countdown from '../components/Countdown'
import { positionFor, type Profile } from '../lib/waitlist'

interface ConfirmationState {
  email?: string
  profile?: Profile
}

export default function Confirmation() {
  const location = useLocation()
  const state = (location.state ?? {}) as ConfirmationState

  // Page accessible uniquement au retour du formulaire : sinon on renvoie a l'accueil.
  if (!state.email) return <Navigate to="/" replace />

  const isArtist = state.profile === 'artiste'

  return (
    <div className="flex min-h-screen flex-col">
      <main className="relative flex-1 overflow-hidden pb-24 pt-32">
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
            <div className="animate-check mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-green-100 text-green-500">
              <CheckCircle className="h-12 w-12" />
            </div>
            <h1 className="display-font mb-6 text-5xl font-extrabold tracking-tight md:text-8xl">
              Vous êtes sur la liste.
            </h1>
            <p className="max-w-2xl text-xl font-light text-secondary-text md:text-2xl">
              {isArtist
                ? "Votre candidature d'artiste est enregistrée. Nous revenons vers vous avant l'ouverture pour référencer votre profil sur la carte."
                : 'Nous vous préviendrons dès que MusiMaps ouvrira. En attendant, la carte est déjà explorable.'}
            </p>
          </div>

          <div className="fade-in-up mb-16 w-full max-w-xl">
            <div className="floating-card space-y-4 rounded-3xl p-8 text-center">
              <p className="text-sm uppercase tracking-widest text-secondary-text">
                Inscription enregistrée pour
              </p>
              <p className="break-all text-xl font-medium">{state.email}</p>
              <p className="text-sm text-secondary-text">
                Vous êtes <span className="font-bold text-primary-text">
                  n° {positionFor(state.email)}
                </span>{' '}
                sur la liste d'attente.
              </p>
            </div>
          </div>

          <div className="fade-in-up mb-20 text-center" style={{ animationDelay: '0.2s' }}>
            <Countdown />
          </div>

          <div className="fade-in-up w-full space-y-12" style={{ animationDelay: '0.3s' }}>
            <h2 className="display-font text-center text-3xl uppercase tracking-tighter">
              En attendant
            </h2>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              <Link
                to="/globe"
                className="flex flex-col items-start gap-6 rounded-3xl border border-hairline bg-surface p-10 transition-shadow hover:shadow-lg"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand-deep">
                  <Globe2 className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="display-font mb-2 text-xl font-bold">Explorez la carte</h3>
                  <p className="text-sm leading-relaxed text-secondary-text">
                    Faites tourner la carte et découvrez les artistes déjà référencés.
                  </p>
                </div>
              </Link>

              <Link
                to="/artistes"
                className="flex flex-col items-start gap-6 rounded-3xl border border-hairline bg-surface p-10 transition-shadow hover:shadow-lg"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand-deep">
                  <Mic2 className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="display-font mb-2 text-xl font-bold">
                    {isArtist ? 'Complétez votre profil' : 'Vous faites de la musique ?'}
                  </h3>
                  <p className="text-sm leading-relaxed text-secondary-text">
                    Demandez à être référencé sur la carte dès l'ouverture.
                  </p>
                </div>
              </Link>

              <button
                type="button"
                onClick={() => {
                  const url = window.location.origin
                  if (navigator.share) {
                    navigator.share({ title: 'MusiMaps', url }).catch(() => {})
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
                  <h3 className="display-font mb-2 text-xl font-bold">Parlez-en autour de vous</h3>
                  <p className="flex items-center gap-2 text-sm leading-relaxed text-secondary-text">
                    <Share2 className="h-4 w-4" /> Partagez le lien avec vos amis mélomanes.
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
