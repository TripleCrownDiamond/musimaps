import { Link, Navigate, useParams } from 'react-router-dom'
import { BadgeCheck, ChevronLeft, Disc3, Flame, Globe2, Music, Play, Users } from 'lucide-react'
import Footer from '../components/Footer'
import { artists, findArtist } from '../data/artists'

export default function ArtistProfile() {
  const { id } = useParams()
  const artist = id ? findArtist(id) : undefined

  // Id inconnu ou URL sans id : on renvoie vers le globe plutot qu'une page vide.
  if (!artist) return <Navigate to="/globe" replace />

  const initials = artist.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const sameCountry = artists.filter((a) => a.country === artist.country && a.id !== artist.id)

  return (
    <div className="flex min-h-screen flex-col bg-warm-white">
      <main className="flex-1">
        {/* Banniere */}
        <section className="relative flex h-[60vh] min-h-[420px] items-end overflow-hidden bg-gradient-to-br from-brand-deep via-black to-black px-6 pb-12 md:px-12">
          <div className="map-bg absolute inset-0 opacity-10" />
          <div className="relative z-10 mx-auto w-full max-w-7xl">
            <Link
              to="/globe"
              className="mb-8 inline-flex items-center gap-2 rounded-full bg-white/15 px-5 py-2.5 text-sm font-medium text-white backdrop-blur-md transition-colors hover:bg-white/25"
            >
              <ChevronLeft className="h-4 w-4" /> Retour à la carte
            </Link>

            <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
              <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br from-brand to-brand-deep text-4xl font-extrabold text-white shadow-2xl">
                {initials}
              </div>
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-medium text-white backdrop-blur-md">
                    <span aria-hidden="true">{artist.flag}</span> {artist.city}, {artist.country}
                  </span>
                  {artist.trending && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/90 px-4 py-1.5 text-sm font-medium text-white">
                      <Flame className="h-4 w-4" /> Trending
                    </span>
                  )}
                </div>
                <h1 className="display-font flex items-center gap-3 text-5xl font-extrabold text-white md:text-8xl">
                  {artist.name}
                  {artist.verified && <BadgeCheck className="h-8 w-8 text-brand" />}
                </h1>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-6 py-16 md:px-12 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-12">
            <div className="space-y-4">
              <h2 className="display-font text-3xl md:text-4xl">L'artiste</h2>
              <p className="text-lg leading-relaxed text-secondary-text">{artist.bio}</p>
            </div>

            <div className="space-y-4">
              <h2 className="display-font text-3xl md:text-4xl">Titres</h2>
              <ul className="divide-y divide-hairline rounded-3xl border border-hairline bg-surface">
                {artist.tracks.map((track, i) => (
                  <li key={track.title} className="flex items-center gap-4 p-5">
                    <span className="w-5 text-sm text-secondary-text">{i + 1}</span>
                    <span className="flex-1 font-medium">{track.title}</span>
                    <span className="text-sm text-secondary-text">{track.duration}</span>
                    <button
                      type="button"
                      aria-label={`Écouter ${track.title}`}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-brand-deep transition-colors hover:bg-brand"
                    >
                      <Play className="h-4 w-4 fill-current" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-4">
              <h2 className="display-font text-3xl md:text-4xl">Dates</h2>
              <ul className="space-y-3">
                {artist.events.map((event) => (
                  <li
                    key={event.label}
                    className="flex items-center gap-5 rounded-3xl border border-hairline bg-surface p-5"
                  >
                    <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-secondary-bg text-xs font-bold leading-tight">
                      {event.date.split(' ').map((part) => (
                        <span key={part}>{part}</span>
                      ))}
                    </div>
                    <div>
                      <p className="font-medium">{event.label}</p>
                      <p className="text-sm text-secondary-text">{event.venue}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="space-y-4 rounded-3xl border border-hairline bg-surface p-6">
              <div className="flex items-center gap-3">
                <Music className="h-5 w-5 text-brand-deep" />
                <span className="text-sm">{artist.genre}</span>
              </div>
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-brand-deep" />
                <span className="text-sm">{artist.followers} abonnés</span>
              </div>
              <div className="flex items-center gap-3">
                <Disc3 className="h-5 w-5 text-brand-deep" />
                <span className="text-sm">{artist.tracks.length} titres</span>
              </div>
              <Link
                to="/globe"
                className="flex w-full items-center justify-center gap-2 rounded-full bg-brand py-4 font-bold text-primary-text transition-transform hover:scale-[1.02]"
              >
                <Globe2 className="h-5 w-5" /> Voir sur la carte
              </Link>
            </div>

            {sameCountry.length > 0 && (
              <div className="space-y-3 rounded-3xl border border-hairline bg-surface p-6">
                <h3 className="display-font text-lg font-bold">Aussi dans {artist.country}</h3>
                <ul className="space-y-1">
                  {sameCountry.map((other) => (
                    <li key={other.id}>
                      <Link
                        to={`/artist/${other.id}`}
                        className="flex items-center gap-3 rounded-2xl p-3 transition-colors hover:bg-secondary-bg"
                      >
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-deep text-xs font-bold text-white">
                          {other.name
                            .split(' ')
                            .map((w) => w[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()}
                        </span>
                        <span>
                          <span className="block text-sm font-medium">{other.name}</span>
                          <span className="block text-xs text-secondary-text">{other.genre}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </section>
      </main>

      <Footer />
    </div>
  )
}
