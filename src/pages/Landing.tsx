import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Globe2, Headphones, MapPin, Mic2, Play, Search, Sparkles } from 'lucide-react'
import GlobeMap from '../components/GlobeMap'
import RotateToggle from '../components/RotateToggle'
import Countdown from '../components/Countdown'
import { hasMapboxToken } from '../lib/mapbox'
import { isValidEmail, saveSignup } from '../lib/waitlist'
import PulseDots from '../components/PulseDots'
import Footer from '../components/Footer'
import autourDeVousImg from '../assets/autour-de-vous.png'
import voyagerImg from '../assets/voyager.png'

const features = [
  {
    title: 'Autour de vous',
    text: 'Découvrez les talents qui créent à deux pas de chez vous.',
    image: autourDeVousImg,
    alt: 'Concert acoustique de quartier entoure de spectateurs',
  },
  {
    title: 'Explorer',
    text: 'Naviguez de ville en ville, de continent en continent.',
    image:
      'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&q=80&w=800',
    alt: 'Exploration map',
  },
  {
    title: 'Voyager',
    text: "Imprégnez-vous de la culture musicale d'un territoire.",
    image: voyagerImg,
    alt: "Voyageur consultant MusiMaps face a un village au bord d'un lac",
  },
]

const journey = [
  { icon: MapPin, title: '1. Autoriser', text: 'Activez votre position pour révéler les artistes locaux.' },
  { icon: Sparkles, title: '2. Révéler', text: "La carte s'anime et dévoile des milliers de points." },
  { icon: Search, title: '3. Découvrir', text: "Plongez dans l'univers d'un artiste inconnu." },
  { icon: Play, title: '4. Écouter', text: 'Vivez sa musique là où elle est née.' },
]

const profiles = [
  {
    id: 'artiste' as const,
    label: 'Artiste',
    description: 'Je crée de la musique et veux être sur la carte.',
    icon: Mic2,
  },
  {
    id: 'amateur' as const,
    label: 'Amateur de musique',
    description: 'Je veux découvrir les artistes autour de moi.',
    icon: Headphones,
  },
]

export default function Landing() {
  const navigate = useNavigate()
  const mapBgRef = useRef<HTMLDivElement>(null)
  const [email, setEmail] = useState('')
  const [profile, setProfile] = useState<'artiste' | 'amateur'>('amateur')
  const [spinning, setSpinning] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const handleWaitlistSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValidEmail(email)) {
      setError('Merci de saisir une adresse email valide.')
      return
    }
    setError(null)
    // L'artiste passe par le formulaire dedie pour completer son profil.
    if (profile === 'artiste') {
      navigate('/artistes', { state: { email: email.trim() } })
      return
    }
    saveSignup({ email: email.trim(), profile })
    setSubmitted(true)
    setTimeout(() => navigate('/merci', { state: { email: email.trim(), profile } }), 900)
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

          <div className="relative z-20 max-w-5xl mx-auto space-y-8 pt-32 pb-24 fade-in-up">
            <h1 className="display-font text-6xl md:text-9xl leading-[0.9] font-extrabold">
              Découvrez les artistes autour de vous.
            </h1>
            <p className="text-xl md:text-2xl text-secondary-text max-w-2xl mx-auto font-light">
              Une nouvelle façon d'explorer la musique grâce à la géolocalisation.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
              <Link
                to="/globe"
                className="w-full sm:w-auto px-10 py-5 bg-ink text-ink-foreground rounded-full text-lg font-medium hover:scale-105 transition-transform flex items-center justify-center gap-2"
              >
                Explorer la carte <ArrowRight className="w-5 h-5" />
              </Link>
              <a
                href="#waitlist"
                className="w-full sm:w-auto px-10 py-5 bg-surface border border-hairline-strong rounded-full text-lg font-medium hover:bg-secondary-bg transition-colors flex items-center justify-center"
              >
                Rejoindre la liste d'attente
              </a>
            </div>
          </div>

        </section>

        {/* Features */}
        <section id="features" className="py-32 px-6 md:px-12 bg-surface">
          <div className="max-w-7xl mx-auto space-y-24">
            <div className="text-center space-y-4">
              <h2 className="display-font text-4xl md:text-6xl">Une nouvelle manière de découvrir.</h2>
              <p className="text-secondary-text text-lg">Oubliez les algorithmes, explorez les territoires.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {features.map((f) => (
                <div
                  key={f.title}
                  className="group relative h-[600px] overflow-hidden rounded-3xl bg-secondary-bg"
                >
                  <div className="p-12 space-y-4 relative z-10">
                    <h3 className="display-font text-4xl">{f.title}</h3>
                    <p className="text-secondary-text">{f.text}</p>
                  </div>
                  <div className="absolute bottom-0 right-0 w-full p-6 transition-transform duration-500 group-hover:scale-110">
                    <div className="aspect-square bg-surface rounded-2xl shadow-xl flex items-center justify-center overflow-hidden border border-hairline">
                      <img src={f.image} alt={f.alt} className="object-cover w-full h-full opacity-80" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Journey */}
        <section id="journey" className="py-32 px-6 overflow-hidden bg-secondary-bg">
          <div className="max-w-7xl mx-auto">
            <div className="relative flex flex-col gap-12 md:grid md:grid-cols-4 md:gap-8">
              {/* Timeline verticale (mobile) */}
              <div className="absolute top-10 bottom-10 left-10 w-[2px] -translate-x-1/2 bg-hairline md:hidden">
                <div className="w-full bg-brand h-1/3" />
              </div>
              {/* Timeline horizontale (desktop) */}
              <div className="absolute top-10 left-0 w-full h-[2px] bg-hairline hidden md:block">
                <div className="h-full bg-brand w-1/3" />
              </div>
              {journey.map(({ icon: Icon, title, text }) => (
                <div
                  key={title}
                  className="relative z-10 flex items-start gap-6 text-left md:flex-col md:items-center md:gap-6 md:text-center"
                >
                  <div className="w-20 h-20 shrink-0 bg-surface rounded-full flex items-center justify-center shadow-lg border border-hairline">
                    <Icon className="w-8 h-8 text-brand-deep" />
                  </div>
                  <div className="space-y-2 pt-4 md:pt-0 md:space-y-6">
                    <h4 className="display-font text-xl uppercase">{title}</h4>
                    <p className="text-secondary-text md:max-w-[220px] md:mx-auto">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Preview du globe */}
        <section id="globe-preview" className="overflow-hidden bg-black py-32">
          <div className="mx-auto flex max-w-7xl flex-col items-center gap-14 px-6 text-center md:px-12">
            <div className="space-y-4">
              <h2 className="display-font text-4xl text-white md:text-6xl">
                Le monde entier, artiste par artiste.
              </h2>
              <p className="mx-auto max-w-xl text-lg text-gray-400">
                Faites tourner la carte, cherchez une ville, zoomez jusqu'à la rue. Chaque point est
                un créateur.
              </p>
            </div>

            {/* Pleine largeur de la fenetre : le halo Mapbox s'arrete au bord du
                canvas, un conteneur etroit dessinerait un cadre visible sur le noir. */}
            <div className="relative -mx-6 h-[70vh] max-h-[760px] min-h-[380px] w-screen md:-mx-12">
              {hasMapboxToken ? (
                <GlobeMap
                  className="absolute inset-0 cursor-grab active:cursor-grabbing"
                  theme="dark"
                  autoRotate={spinning}
                  onAutoRotateChange={setSpinning}
                  showPins
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Globe2 className="h-24 w-24 text-brand" />
                </div>
              )}
            </div>

            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <Link
                to="/globe"
                className="flex items-center gap-2 rounded-full bg-brand px-10 py-5 text-lg font-bold text-primary-text transition-transform hover:scale-105"
              >
                <Globe2 className="h-5 w-5" />
                Explorer la carte
              </Link>
              {hasMapboxToken && (
                <RotateToggle
                  theme="dark"
                  active={spinning}
                  onToggle={() => setSpinning((s) => !s)}
                />
              )}
            </div>
            <p className="-mt-4 text-sm text-secondary-text">
              Faites glisser la carte pour la tourner à la main.
            </p>
          </div>
        </section>

        {/* Philosophy */}
        <section id="philosophy" className="bg-black text-white py-48 px-6 md:px-12 text-center">
          <div className="max-w-4xl mx-auto space-y-16">
            <div className="h-px w-24 bg-brand mx-auto" />
            <h2 className="display-font text-5xl md:text-7xl leading-tight">
              MusiMaps construit la première carte mondiale de découverte d'artistes.
            </h2>
          </div>
        </section>

        {/* Waitlist */}
        <section
          id="waitlist"
          className="py-48 px-6 bg-surface flex flex-col items-center text-center"
        >
          <div className="w-full max-w-3xl space-y-12">
            <div className="space-y-4">
              <h2 className="display-font text-5xl md:text-8xl">Soyez parmi les premiers.</h2>
              <p className="text-xl text-secondary-text">
                Rejoignez l'expédition et redéfinissez votre façon de consommer la musique.
              </p>
            </div>

            <Countdown />

            {submitted ? (
              <div className="mx-auto max-w-lg rounded-3xl border border-brand-deep bg-brand-soft p-8 text-center">
                <p className="display-font text-2xl font-bold">Merci, vous êtes inscrit·e !</p>
                <p className="mt-2 text-secondary-text">
                  Redirection vers votre confirmation…
                </p>
              </div>
            ) : (
            <>
            <fieldset className="w-full space-y-4">
              <legend className="mb-4 text-sm uppercase tracking-widest text-secondary-text">
                Je rejoins en tant que
              </legend>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {profiles.map(({ id, label, description, icon: Icon }) => {
                  const active = profile === id
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setProfile(id)}
                      className={`flex items-center gap-4 rounded-3xl border-2 p-5 text-left transition-all ${
                        active
                          ? 'border-brand-deep bg-brand-soft'
                          : 'border-hairline-strong hover:border-black/25'
                      }`}
                    >
                      <span
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-colors ${
                          active ? 'bg-brand text-primary-text' : 'bg-secondary-bg text-secondary-text'
                        }`}
                      >
                        <Icon className="h-6 w-6" />
                      </span>
                      <span>
                        <span className="block font-bold">{label}</span>
                        <span className="block text-sm text-secondary-text">{description}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </fieldset>

            <form className="w-full space-y-3" onSubmit={handleWaitlistSubmit} noValidate>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="votre@email.com"
                  aria-label="Votre adresse email"
                  className="flex-1 rounded-full border-none bg-secondary-bg px-8 py-5 text-lg outline-none focus:ring-2 focus:ring-brand-deep"
                />
                <button
                  type="submit"
                  className="rounded-full bg-ink px-10 py-5 text-lg font-medium text-ink-foreground transition-transform hover:scale-105"
                >
                  Rejoindre l'attente
                </button>
              </div>
              {error && (
                <p role="alert" className="text-sm text-red-600">
                  {error}
                </p>
              )}
            </form>
            </>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
