import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BadgeCheck, ExternalLink, Flame, Heart, Play, Share2, X } from 'lucide-react'
import type { Artist } from '../data/artists'

const tabs = ['About', 'Musics', 'Events', 'Nearby'] as const
type Tab = (typeof tabs)[number]

interface ArtistSheetProps {
  artist: Artist
  /** Artistes proches, pour l'onglet Nearby. */
  nearby: Artist[]
  onClose: () => void
  onSelectArtist: (artist: Artist) => void
}

export default function ArtistSheet({ artist, nearby, onClose, onSelectArtist }: ArtistSheetProps) {
  const [tab, setTab] = useState<Tab>('About')
  const [saved, setSaved] = useState(false)

  const initials = artist.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 px-3 pb-3 sm:px-4 sm:pb-4">
      <div className="sheet-in mx-auto w-full max-w-2xl rounded-[2rem] bg-surface p-4 shadow-2xl sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="mx-auto h-1.5 w-12 rounded-full bg-hairline-strong" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la fiche artiste"
            className="absolute right-6 flex h-9 w-9 items-center justify-center rounded-full bg-hairline transition-colors hover:bg-hairline-strong sm:right-9"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Onglets */}
        <div
          role="tablist"
          aria-label="Sections de l'artiste"
          className="mb-6 flex rounded-full bg-secondary-bg p-1"
        >
          {tabs.map((t) => (
            <button
              key={t}
              role="tab"
              type="button"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-full px-2 py-2.5 text-sm font-medium transition-colors ${
                tab === t ? 'bg-surface shadow-sm' : 'text-secondary-text hover:text-primary-text'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="max-h-[42vh] overflow-y-auto">
          {tab === 'About' && (
            <div className="flex flex-col gap-5 sm:flex-row">
              <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-brand-deep text-3xl font-extrabold text-white">
                {initials}
              </div>
              <div className="space-y-2">
                {artist.trending && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-500">
                    <Flame className="h-3.5 w-3.5" /> Trending
                  </span>
                )}
                <h3 className="display-font flex items-center gap-2 text-3xl font-extrabold">
                  {artist.name}
                  {artist.verified && <BadgeCheck className="h-5 w-5 text-brand-deep" />}
                </h3>
                <p className="text-secondary-text">{artist.bio}</p>
                <p className="flex items-center gap-2 pt-1 font-medium">
                  <span aria-hidden="true">{artist.flag}</span> {artist.city}, {artist.country}
                </p>
                <p className="text-sm text-secondary-text">
                  {artist.genre} · {artist.followers} abonnés
                </p>
              </div>
            </div>
          )}

          {tab === 'Musics' && (
            <ul className="divide-y divide-hairline">
              {artist.tracks.map((track, i) => (
                <li key={track.title} className="flex items-center gap-4 py-3">
                  <span className="w-5 text-sm text-secondary-text">{i + 1}</span>
                  <span className="flex-1 font-medium">{track.title}</span>
                  <span className="text-sm text-secondary-text">{track.duration}</span>
                  <button
                    type="button"
                    aria-label={`Écouter ${track.title}`}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-brand-deep transition-colors hover:bg-brand"
                  >
                    <Play className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {tab === 'Events' && (
            <ul className="space-y-3">
              {artist.events.map((event) => (
                <li
                  key={event.label}
                  className="flex items-center gap-4 rounded-2xl border border-hairline p-4"
                >
                  <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-secondary-bg text-xs font-bold leading-tight">
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
          )}

          {tab === 'Nearby' && (
            <ul className="space-y-2">
              {nearby.length === 0 && (
                <li className="py-6 text-center text-sm text-secondary-text">
                  Aucun autre artiste référencé dans cette zone pour l'instant.
                </li>
              )}
              {nearby.map((other) => (
                <li key={other.id}>
                  <button
                    type="button"
                    onClick={() => onSelectArtist(other)}
                    className="flex w-full items-center gap-4 rounded-2xl p-3 text-left transition-colors hover:bg-secondary-bg"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-deep text-sm font-bold text-white">
                      {other.name
                        .split(' ')
                        .map((w) => w[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()}
                    </span>
                    <span className="flex-1">
                      <span className="block font-medium">{other.name}</span>
                      <span className="block text-sm text-secondary-text">
                        {other.genre} · {other.city}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center gap-3 border-t border-hairline pt-5">
          <button
            type="button"
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-brand py-4 font-bold text-primary-text transition-transform hover:scale-[1.02]"
          >
            <Play className="h-5 w-5 fill-current" /> Listen
          </button>
          <button
            type="button"
            onClick={() => setSaved((s) => !s)}
            aria-pressed={saved}
            className="flex flex-1 items-center justify-center gap-2 rounded-full border border-hairline-strong py-4 font-medium transition-colors hover:bg-secondary-bg"
          >
            <Heart className={`h-5 w-5 ${saved ? 'fill-red-500 text-red-500' : ''}`} />
            {saved ? 'Saved' : 'Save'}
          </button>
          <button
            type="button"
            aria-label="Partager"
            onClick={() => {
              const url = `${window.location.origin}/artist/${artist.id}`
              if (navigator.share) navigator.share({ title: artist.name, url }).catch(() => {})
              else navigator.clipboard?.writeText(url)
            }}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-hairline-strong transition-colors hover:bg-secondary-bg"
          >
            <Share2 className="h-5 w-5" />
          </button>
        </div>

        <Link
          to={`/artist/${artist.id}`}
          className="mt-3 flex items-center justify-center gap-2 rounded-full py-3 text-sm font-medium text-brand-deep transition-colors hover:bg-secondary-bg"
        >
          Voir le profil complet <ExternalLink className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}
