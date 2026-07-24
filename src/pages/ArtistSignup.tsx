import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Globe2, Mic2, Radar, Users } from 'lucide-react'
import PulseDots from '../components/PulseDots'
import Footer from '../components/Footer'
import { isValidEmail, saveSignup } from '../lib/waitlist'

const perks = [
  { icon: Radar, title: 'Épinglé sur la carte', text: 'Votre ville, votre scène, votre son — visibles dès le premier jour.' },
  { icon: Users, title: 'Un public de proximité', text: 'Les auditeurs vous trouvent parce que vous créez près de chez eux.' },
  { icon: Globe2, title: 'Portée mondiale', text: 'Un voyageur qui atterrit dans votre ville tombe sur votre profil.' },
]

export default function ArtistSignup() {
  const navigate = useNavigate()
  const location = useLocation()
  const prefillEmail = (location.state as { email?: string } | null)?.email ?? ''
  const [form, setForm] = useState({ artistName: '', email: prefillEmail, city: '', genre: '', link: '' })
  const [error, setError] = useState<string | null>(null)

  const update = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.artistName.trim()) return setError("Indiquez votre nom d'artiste.")
    if (!isValidEmail(form.email)) return setError('Cette adresse email est invalide.')
    if (!form.city.trim()) return setError('Indiquez la ville depuis laquelle vous créez.')
    setError(null)
    await saveSignup({
      email: form.email.trim(),
      profile: 'artiste',
      artistName: form.artistName.trim(),
      city: form.city.trim(),
      genre: form.genre.trim(),
      link: form.link.trim(),
    })
    navigate('/merci', { state: { email: form.email.trim(), profile: 'artiste' } })
  }

  const field = 'w-full rounded-2xl border border-hairline-strong px-6 py-4 outline-none focus:ring-2 focus:ring-brand-deep'

  return (
    <div className="flex min-h-screen flex-col bg-warm-white">
      <main className="relative flex-1 overflow-hidden pb-16 pt-32">
        <div className="map-bg absolute inset-0 z-0 opacity-40" />
        <PulseDots
          positions={[
            { top: '20%', left: '25%' },
            { top: '40%', left: '75%' },
            { top: '70%', left: '15%' },
            { top: '15%', left: '60%' },
          ]}
        />

        <div className="relative z-20 mx-auto flex w-full max-w-5xl flex-col items-center gap-12 px-6">
          <div className="fade-in-up space-y-4 text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-4 py-2 text-sm font-medium text-brand-deep">
              <Mic2 className="h-4 w-4" /> Appel aux artistes
            </span>
            <h1 className="display-font text-5xl font-extrabold md:text-7xl">
              Soyez sur la carte au lancement.
            </h1>
            <p className="mx-auto max-w-xl text-xl text-secondary-text">
              MusiMaps référence les créateurs territoire par territoire. Demandez votre place avant
              l'ouverture — les premiers profils seront les premiers visibles.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            noValidate
            className="floating-card fade-in-up w-full max-w-lg space-y-4 rounded-[2.5rem] p-8 md:p-10"
            style={{ animationDelay: '0.2s' }}
          >
            <label className="block">
              <span className="mb-2 block text-sm font-medium">Nom d'artiste *</span>
              <input value={form.artistName} onChange={update('artistName')} className={field} placeholder="Aria Lyra" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium">Email *</span>
              <input type="email" value={form.email} onChange={update('email')} className={field} placeholder="vous@email.com" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium">Ville *</span>
              <input value={form.city} onChange={update('city')} className={field} placeholder="Cotonou, Bénin" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium">Genre musical</span>
              <input value={form.genre} onChange={update('genre')} className={field} placeholder="Afro-Soul" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium">Lien vers votre musique</span>
              <input value={form.link} onChange={update('link')} className={field} placeholder="Spotify, SoundCloud, YouTube…" />
            </label>

            {error && (
              <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="w-full rounded-full bg-ink py-5 text-lg font-bold text-ink-foreground transition-transform hover:scale-[1.02]"
            >
              Demander mon référencement
            </button>
            <p className="text-center text-xs text-secondary-text">
              Aucune donnée n'est partagée. Nous vous écrivons uniquement pour le lancement.
            </p>
          </form>

          <div className="fade-in-up grid w-full grid-cols-1 gap-4 md:grid-cols-3" style={{ animationDelay: '0.4s' }}>
            {perks.map(({ icon: Icon, title, text }) => (
              <div key={title} className="space-y-2 rounded-3xl border border-hairline bg-surface p-6">
                <Icon className="h-6 w-6 text-brand-deep" />
                <h2 className="display-font text-lg font-bold">{title}</h2>
                <p className="text-sm text-secondary-text">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
