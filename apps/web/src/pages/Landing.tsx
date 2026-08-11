import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Apple,
  ArrowRight,
  ChevronDown,
  Globe2,
  Headphones,
  MapPin,
  Mic2,
  Play,
  Search,
  Smartphone,
  Sparkles,
} from 'lucide-react'
import GlobeMap from '../components/GlobeMap'
import Countdown from '../components/Countdown'
import { hasMapboxToken } from '../lib/mapbox'
import { isValidEmail, saveSignup } from '../lib/waitlist'
import PulseDots from '../components/PulseDots'
import Reveal from '../components/Reveal'
import Footer from '../components/Footer'
import RichText from '../components/RichText'
import { useCms } from '../context/CmsContext'
import { useAuth } from '../context/AuthContext'
import { useLanguage, useLocalizedPath } from '../i18n/LanguageContext'
import autourDeVousImg from '../assets/autour-de-vous.webp'
import voyagerImg from '../assets/voyager.webp'

/** Résout les images locales référencées par placeholder dans le CMS. */
const LOCAL_IMAGES: Record<string, string> = {
  'import:autour-de-vous': autourDeVousImg,
  'import:voyager': voyagerImg,
}

const journeyIcons = [MapPin, Sparkles, Search, Play]
const profileIcons: Record<string, typeof Headphones> = {
  artiste: Mic2,
  amateur: Headphones,
}

/** Badge de téléchargement façon App Store / Google Play (rendu maison). */
function StoreBadge({
  href,
  icon: Icon,
  top,
  bottom,
}: {
  href: string
  icon: typeof Apple
  top: string
  bottom: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex w-full items-center justify-center gap-4 rounded-2xl border border-white/15 bg-white/[0.06] px-7 py-4 backdrop-blur transition-all hover:scale-105 hover:border-brand hover:bg-brand sm:w-auto"
    >
      <Icon className="h-8 w-8 shrink-0 text-brand transition-colors group-hover:text-black" />
      <span className="text-left">
        <span className="block text-[11px] uppercase tracking-widest text-gray-400 transition-colors group-hover:text-black/70">
          {top}
        </span>
        <span className="block text-lg font-bold text-white transition-colors group-hover:text-black">
          {bottom}
        </span>
      </span>
    </a>
  )
}

export default function Landing() {
  const navigate = useNavigate()
  const { content } = useCms()
  const { t } = useLanguage()
  const localize = useLocalizedPath()
  const landing = content.landing
  // L'app n'est pas encore en ligne : les boutons annoncent l'arrivée
  // (« Bientôt disponible ») plutôt qu'une disponibilité immédiate.

  const mapBgRef = useRef<HTMLDivElement>(null)
  const { user } = useAuth()
  const [email, setEmail] = useState('')
  const [profile, setProfile] = useState<'artiste' | 'amateur'>('amateur')
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  // Progression de la frise « Comment ça marche » : la ligne se remplit
  // au fil du scroll, étape par étape.
  const [journeyProgress, setJourneyProgress] = useState(0)

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValidEmail(email)) {
      setError('Merci de saisir une adresse email valide.')
      return
    }
    setError(null)
    // L'artiste passe par le formulaire dedie pour completer son profil.
    if (profile === 'artiste') {
      navigate(localize('/artistes'), { state: { email: email.trim() } })
      return
    }
    await saveSignup({ email: email.trim(), profile })
    setSubmitted(true)
    setTimeout(() => navigate(localize('/merci'), { state: { email: email.trim(), profile } }), 900)
  }

  useEffect(() => {
    const onScroll = () => {
      if (mapBgRef.current) {
        mapBgRef.current.style.transform = `scale(${1 + window.scrollY / 2000})`
      }
    }
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const hero = landing.hero
  const waitlist = landing.waitlist

  return (
    <div className="relative min-h-screen bg-warm-white">
      <main>
        {/* Hero */}
        <section
          id="hero"
          className="relative min-h-screen flex flex-col items-center justify-center text-center px-4 overflow-hidden"
        >
          <div ref={mapBgRef} className="absolute inset-0 z-0 map-bg opacity-40 scroll-zoom" />
          <PulseDots
            positions={[
              { top: '20%', left: '15%' },
              { top: '45%', left: '35%' },
              { top: '10%', left: '75%' },
              { top: '60%', left: '80%' },
              { top: '85%', left: '25%' },
              { top: '30%', left: '60%' },
              { top: '70%', left: '50%' },
            ]}
          />

          <div className="relative z-20 max-w-5xl mx-auto space-y-8 pt-44 pb-24 fade-in-up">
            <h1 className="display-font text-6xl md:text-9xl leading-[0.9] font-extrabold">
              {hero.title}
            </h1>
            <RichText
              content={hero.subtitle}
              className="text-xl md:text-2xl text-secondary-text max-w-2xl mx-auto font-light"
            />
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
              <Link
                to={localize(hero.ctaPrimaryTo)}
                className="w-full sm:w-auto px-10 py-5 bg-brand-deep text-brand-deep-foreground rounded-full text-lg font-medium hover:scale-105 transition-transform flex items-center justify-center gap-2"
              >
                {hero.ctaPrimary} <ArrowRight className="w-5 h-5" />
              </Link>
              {/* CTA secondaire (waitlist) : réservé aux visiteurs non connectés */}
              {!user && (
                <a
                  href={localize(hero.ctaSecondaryTo)}
                  className="w-full sm:w-auto px-10 py-5 bg-brand text-black rounded-full text-lg font-medium hover:scale-105 transition-transform flex items-center justify-center"
                >
                  {hero.ctaSecondary}
                </a>
              )}
            </div>
          </div>

        </section>

        {/* Features */}
        <section id="features" className="py-32 px-6 md:px-12 bg-surface">
          <div className="max-w-7xl mx-auto space-y-24">
            <Reveal className="text-center space-y-4">
              <h2 className="display-font text-4xl md:text-6xl">{landing.features.title}</h2>
              <RichText content={landing.features.subtitle} className="text-secondary-text text-lg" />
            </Reveal>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {landing.features.items.map((f, i) => (
                <Reveal
                  key={f.title}
                  from="up"
                  delay={i * 120}
                  className="h-full"
                >
                <div
                  className="group relative flex flex-col overflow-hidden rounded-3xl bg-secondary-bg md:h-[600px] transition-transform duration-500 hover:-translate-y-2"
                >
                  <div className="p-8 space-y-4 relative z-10 md:p-12">
                    <h3 className="display-font text-4xl">{f.title}</h3>
                    <RichText content={f.text} className="text-secondary-text" />
                  </div>
                  {/* Sur mobile : image pleine largeur sous le texte ; sur desktop :
                      composition flottante en bas à droite. */}
                  <div className="mt-auto w-full p-6 md:absolute md:bottom-0 md:right-0 md:transition-transform md:duration-500 md:group-hover:scale-110">
                    <div className="aspect-[4/3] bg-surface rounded-2xl shadow-xl flex items-center justify-center overflow-hidden border border-hairline md:aspect-square">
                      <img
                        src={LOCAL_IMAGES[f.image] ?? (f.image || autourDeVousImg)}
                        alt={f.alt}
                        className="object-cover w-full h-full opacity-80"
                      />
                    </div>
                  </div>
                </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Journey */}
        <section id="journey" className="py-32 px-6 overflow-hidden bg-secondary-bg">
          <div className="max-w-7xl mx-auto">
            <div className="relative flex flex-col gap-12 md:grid md:grid-cols-4 md:gap-8">
              {/* Timeline verticale (mobile) : se remplit au scroll */}
              <div className="absolute top-10 bottom-10 left-10 w-[2px] -translate-x-1/2 bg-hairline md:hidden">
                <div
                  className="w-full bg-brand transition-all duration-700 ease-out"
                  style={{ height: `${journeyProgress}%` }}
                />
              </div>
              {/* Timeline horizontale (desktop) : ligne de chargement animée */}
              <div className="absolute top-10 left-0 w-full h-[2px] bg-hairline hidden md:block">
                <div
                  className="h-full bg-brand shadow-[0_0_8px_0_rgba(168,255,53,0.6)] transition-all duration-700 ease-out"
                  style={{ width: `${journeyProgress}%` }}
                />
                {/* Pointe lumineuse qui avance avec la ligne */}
                <span
                  aria-hidden="true"
                  className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand shadow-[0_0_16px_4px_rgba(168,255,53,0.65)] transition-all duration-700 ease-out"
                  style={{ left: `${journeyProgress}%`, opacity: journeyProgress > 0 ? 1 : 0 }}
                />
              </div>
              {landing.journey.items.map((item, index) => {
                const Icon = journeyIcons[index % journeyIcons.length]
                const total = landing.journey.items.length
                return (
                  <Reveal
                    key={item.title}
                    from="up"
                    delay={index * 140}
                    onReveal={() =>
                      setJourneyProgress((prev) => Math.max(prev, ((index + 1) / total) * 100))
                    }
                    className="relative z-10"
                  >
                    <div className="group flex items-start gap-6 text-left md:flex-col md:items-center md:gap-6 md:text-center">
                      <div className="journey-icon relative w-20 h-20 shrink-0 bg-surface rounded-full flex items-center justify-center shadow-lg border border-hairline transition-colors duration-300 group-hover:border-brand-deep/40">
                        <Icon className="w-8 h-8 text-brand-deep transition-colors duration-300 group-hover:text-brand" />
                        {/* Pastille numérotée */}
                        <span className="journey-num absolute -top-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-brand-deep text-xs font-extrabold text-brand-deep-foreground shadow-md">
                          {index + 1}
                        </span>
                      </div>
                      <div className="space-y-2 pt-4 md:pt-0 md:space-y-6">
                        <h4 className="display-font text-xl uppercase">{item.title}</h4>
                        <RichText content={item.text} className="text-secondary-text md:max-w-[220px] md:mx-auto" />
                      </div>
                    </div>
                  </Reveal>
                )
              })}
            </div>
          </div>
        </section>

        {/* Preview du globe */}
        <section id="globe-preview" className="overflow-hidden bg-black py-32">
          <div className="mx-auto flex max-w-7xl flex-col items-center gap-14 px-6 text-center md:px-12">
            <Reveal className="space-y-4">
              <h2 className="display-font text-4xl text-white md:text-6xl">
                {landing.globePreview.title}
              </h2>
              <RichText
                content={landing.globePreview.subtitle}
                className="mx-auto max-w-xl text-lg text-gray-400"
              />
            </Reveal>

            {/* Pleine largeur de la fenetre : le halo Mapbox s'arrete au bord du
                canvas, un conteneur etroit dessinerait un cadre visible sur le noir. */}
            {/* Preview purement decoratif : non-interactif, rotation continue,
                clics traversants pour ne pas capturer le scroll. */}
            <div className="pointer-events-none relative -mx-6 h-[70vh] max-h-[760px] min-h-[380px] w-screen md:-mx-12">
              {hasMapboxToken ? (
                <GlobeMap
                  className="absolute inset-0"
                  theme="dark"
                  interactive={false}
                  autoRotate
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Globe2 className="h-24 w-24 text-brand" />
                </div>
              )}
            </div>

            <Reveal from="up" delay={100}>
              <Link
                to={localize(landing.globePreview.ctaTo)}
                className="flex items-center gap-2 rounded-full bg-brand-deep px-10 py-5 text-lg font-bold text-brand-deep-foreground transition-transform hover:scale-105"
              >
                <Globe2 className="h-5 w-5" />
                {landing.globePreview.cta}
              </Link>
            </Reveal>
          </div>
        </section>

        {/* Disponibilité stores */}
        <section id="stores" className="relative overflow-hidden bg-black py-32 px-6 text-center md:px-12">
          <div className="relative mx-auto max-w-3xl space-y-8">
            <Reveal from="up" className="space-y-8">
              <span className="inline-flex items-center gap-2 rounded-full border border-brand/40 bg-brand-soft px-4 py-2 text-sm font-medium text-brand-deep">
                <Smartphone className="h-4 w-4" /> {landing.stores.badge}
              </span>
              <h2 className="display-font text-4xl text-white md:text-6xl">{landing.stores.title}</h2>
              <p className="mx-auto max-w-xl text-lg font-light text-gray-400">
                {landing.stores.subtitle}
              </p>
            </Reveal>
            <div className="flex flex-col items-center justify-center gap-4 pt-4 sm:flex-row">
              {landing.stores.appStoreUrl && (
                <Reveal from="up" delay={0}>
                  <StoreBadge
                    href={landing.stores.appStoreUrl}
                    icon={Apple}
                    top={landing.stores.soonLabel}
                    bottom={landing.stores.appStoreLabel}
                  />
                </Reveal>
              )}
              {landing.stores.playStoreUrl && (
                <Reveal from="up" delay={120}>
                  <StoreBadge
                    href={landing.stores.playStoreUrl}
                    icon={Play}
                    top={landing.stores.soonLabel}
                    bottom={landing.stores.playStoreLabel}
                  />
                </Reveal>
              )}
            </div>
          </div>
        </section>

        {/* Philosophy */}
        <section id="philosophy" className="bg-black text-white py-48 px-6 md:px-12 text-center">
          <div className="max-w-4xl mx-auto space-y-16">
            <Reveal from="up">
              <div className="h-px w-24 bg-brand mx-auto" />
            </Reveal>
            <Reveal from="up" delay={120}>
              <RichText
                content={landing.philosophy.title}
                asHeading="h2"
                className="display-font text-5xl md:text-7xl leading-tight"
              />
            </Reveal>
          </div>
        </section>

        {/* FAQ */}
        {landing.faq.items.length > 0 && (
          <section id="faq" className="bg-surface py-32 px-6 md:px-12">
            <div className="mx-auto max-w-3xl space-y-12">
            <Reveal className="text-center space-y-4">
              <h2 className="display-font text-4xl md:text-6xl">{landing.faq.title}</h2>
              <p className="text-xl text-secondary-text">{landing.faq.subtitle}</p>
            </Reveal>
            <div className="space-y-4">
              {landing.faq.items.map((item, index) => {
                const open = openFaq === index
                return (
                  <Reveal
                    key={`${item.question}-${index}`}
                    from="up"
                    delay={index * 80}
                  >
                  <div
                    className="overflow-hidden rounded-3xl border border-hairline bg-warm-white transition-colors"
                  >
                      <button
                        type="button"
                        aria-expanded={open}
                        onClick={() => setOpenFaq(open ? null : index)}
                        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left md:px-8"
                      >
                        <span className="display-font text-lg font-bold md:text-xl">
                          {item.question}
                        </span>
                        <ChevronDown
                          className={`size-5 shrink-0 text-brand-deep transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
                        />
                      </button>
                      {open && (
                        <div className="px-6 pb-6 md:px-8">
                          <RichText content={item.answer} className="text-secondary-text leading-relaxed" />
                        </div>
                      )}
                    </div>
                  </Reveal>
                  )
                })}
              </div>
            </div>
          </section>
        )}

        {/* Waitlist — masquée pour les utilisateurs connectés */}
        {!user && (
        <section
          id="waitlist"
          className="py-48 px-6 bg-surface flex flex-col items-center text-center"
        >
          <div className="w-full max-w-3xl space-y-12">
            <Reveal className="space-y-4">
              <h2 className="display-font text-5xl md:text-8xl">{waitlist.title}</h2>
              <RichText content={waitlist.subtitle} className="text-xl text-secondary-text" />
            </Reveal>

            <Reveal from="up" delay={100}>
              <Countdown
                launchDate={content.settings.launchDate}
                label={content.settings.launchLabel}
                onlineLabel={content.settings.onlineLabel}
              />
            </Reveal>

            {submitted ? (
              <div className="mx-auto max-w-lg rounded-3xl border border-brand-deep bg-brand-soft p-8 text-center">
                <p className="display-font text-2xl font-bold">{waitlist.successTitle}</p>
                <RichText content={waitlist.successSubtitle} className="mt-2 text-secondary-text" />
              </div>
            ) : (
            <>
            <Reveal from="up" delay={150}>
            <fieldset className="w-full space-y-4">
              <legend className="mb-4 text-sm uppercase tracking-widest text-secondary-text">
                {waitlist.legend}
              </legend>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {waitlist.profiles.map((item) => {
                  const Icon = profileIcons[item.id] ?? Headphones
                  const active = profile === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setProfile(item.id)}
                      className={`flex items-center gap-4 rounded-3xl border-2 p-5 text-left transition-all ${
                        active
                          ? 'border-brand-deep bg-brand-soft'
                          : 'border-hairline-strong hover:border-black/25'
                      }`}
                    >
                      <span
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-colors ${
                          active ? 'bg-brand text-black' : 'bg-secondary-bg text-secondary-text'
                        }`}
                      >
                        <Icon className="h-6 w-6" />
                      </span>
                      <span>
                        <span className="block font-bold">{item.label}</span>
                        <span className="block text-sm text-secondary-text">{item.description}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </fieldset>
            </Reveal>

            <Reveal from="up" delay={220}>
            <form className="w-full space-y-3" onSubmit={handleWaitlistSubmit} noValidate>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={waitlist.emailPlaceholder}
                  aria-label={t('landing.emailAria')}
                  className="flex-1 rounded-full border-none bg-secondary-bg px-8 py-5 text-lg outline-none focus:ring-2 focus:ring-brand-deep"
                />
                <button
                  type="submit"
                  className="rounded-full bg-brand-deep px-10 py-5 text-lg font-medium text-brand-deep-foreground transition-transform hover:scale-105"
                >
                  {waitlist.ctaLabel}
                </button>
              </div>
              {error && (
                <p role="alert" className="text-sm text-red-600">
                  {error}
                </p>
              )}
            </form>
            </Reveal>
            </>
            )}
          </div>
        </section>
        )}
      </main>

      <Footer />
    </div>
  )
}
