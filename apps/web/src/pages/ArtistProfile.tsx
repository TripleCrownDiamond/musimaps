import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import {
  BadgeCheck,
  CalendarDays,
  Disc3,
  ExternalLink,
  Flame,
  Globe2,
  Heart,
  Loader2,
  Music,
  Play,
  UserCheck,
  UserRoundPlus,
  Users,
} from 'lucide-react'
import Footer from '../components/Footer'
import { artists, compactCount, findArtist, type Artist } from '@musimaps/shared'
import { fetchMapArtists, toArtist } from '../lib/discovery'
import { fetchArtistTracks, type StreamedTrack } from '@musimaps/shared'
import {
  fetchArtistFollowers,
  fetchArtistLikes,
  fetchFavorites,
  fetchFollowing,
  toggleFavorite,
  toggleFollow,
} from '@musimaps/shared'
import { useLanguage, useLocalizedPath } from '../i18n/LanguageContext'
import { useAuth } from '../context/AuthContext'
import { toast } from 'sonner'
import { AnimatedAvatar } from '../components/AnimatedAvatar'

export default function ArtistProfile() {
  const { id } = useParams()
  const { t } = useLanguage()
  const localize = useLocalizedPath()
  // Artiste du catalogue éditorial, sinon chargé depuis la carte (découvert).
  const [artist, setArtist] = useState<Artist | null>(null)
  const [loading, setLoading] = useState(true)
  const [tracks, setTracks] = useState<StreamedTrack[]>([])
  const [tracksLoading, setTracksLoading] = useState(false)
  // Abonnés réels de l'artiste sur Musimaps (favoris comptés en base).
  const [followers, setFollowers] = useState(0)
  const [likes, setLikes] = useState(0)
  const [following, setFollowing] = useState(false)
  const [saved, setSaved] = useState(false)
  const { user } = useAuth()

  useEffect(() => {
    let cancelled = false
    const idValue = id ?? ''
    const fromCatalog = idValue ? findArtist(idValue) : undefined
    if (fromCatalog) {
      setArtist(fromCatalog)
      setLoading(false)
      return
    }
    // Artiste découvert : on le cherche dans la table map_artists.
    setLoading(true)
    void fetchMapArtists().then((rows) => {
      if (cancelled) return
      const found = rows.find((r) => r.id === idValue)
      setArtist(found ? toArtist(found) : null)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [id])

  // Compteur d'abonnés + état Suivre/Sauvegarder (rechargé quand l'artiste change).
  useEffect(() => {
    if (!artist) return
    let cancelled = false
    setFollowers(0)
    setLikes(0)
    setFollowing(false)
    setSaved(false)
    void fetchArtistFollowers(artist.id).then((n) => {
      if (!cancelled) setFollowers(n)
    })
    void fetchArtistLikes(artist.id).then((n) => {
      if (!cancelled) setLikes(n)
    })
    void fetchFollowing().then((ids) => {
      if (!cancelled) setFollowing(ids.includes(artist.id))
    })
    void fetchFavorites().then((ids) => {
      if (!cancelled) setSaved(ids.includes(artist.id))
    })
    return () => {
      cancelled = true
    }
  }, [artist])

  // Titres : d'abord ceux du catalogue, sinon récupérés depuis iTunes.
  useEffect(() => {
    if (!artist) return
    if (artist.tracks.length > 0) {
      setTracks(
        artist.tracks.map((tr) => ({
          title: tr.title,
          album: '',
          duration: tr.duration,
          artwork: '',
          url: `https://music.apple.com/search?term=${encodeURIComponent(artist.name + ' ' + tr.title)}`,
        })),
      )
      return
    }
    const controller = new AbortController()
    setTracksLoading(true)
    void fetchArtistTracks(artist.name, controller.signal).then((list) => {
      setTracks(list)
      setTracksLoading(false)
    })
    return () => controller.abort()
  }, [artist])

  // Id inconnu (ni catalogue ni carte) : on renvoie vers le globe.
  if (!loading && !artist) return <Navigate to={localize('/globe')} replace />

  if (loading || !artist) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-warm-white">
        <Loader2 className="h-8 w-8 animate-spin text-brand-deep" />
        <p className="text-secondary-text">{t('common.loading')}</p>
      </div>
    )
  }

  const sameCountry = artists.filter((a) => a.country === artist.country && a.id !== artist.id)

  return (
    <div className="flex min-h-screen flex-col bg-warm-white">
      <main className="flex-1">
        {/* Banniere */}
        <section className="relative flex h-[60vh] min-h-[420px] flex-col items-stretch overflow-hidden bg-gradient-to-br from-brand-deep via-black to-black px-6 pb-12 pt-28 md:px-12">
          <div className="map-bg absolute inset-0 opacity-10" />
          {/* Le retour à la carte se fait via la navbar (logo) ou le bouton
              « Voir sur la carte » de la colonne latérale. */}
          <div className="relative z-10 mt-auto flex-1 items-end justify-center sm:flex">
            <div className="mx-auto w-full max-w-7xl">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
              <AnimatedAvatar
                name={artist.name}
                image={artist.image}
                alt={artist.name}
                className="h-32 w-32 rounded-full shadow-2xl ring-4 ring-white/20"
                initialsClassName="bg-gradient-to-br from-brand-deep to-brand text-4xl font-extrabold text-black"
              />
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-medium text-white backdrop-blur-md">
                    <span aria-hidden="true">{artist.flag}</span>{' '}
                    {[artist.district, artist.city, artist.country].filter(Boolean).join(', ')}
                  </span>
                  {artist.trending && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/90 px-4 py-1.5 text-sm font-medium text-white">
                      <Flame className="h-4 w-4" /> {t('profile.trending')}
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
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-6 py-16 md:px-12 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-12">
            <div className="space-y-4">
              <h2 className="display-font text-3xl md:text-4xl">{t('profile.about')}</h2>
              <p className="text-lg leading-relaxed text-secondary-text">{artist.bio}</p>
            </div>

            <div className="space-y-4">
              <h2 className="display-font text-3xl md:text-4xl">{t('profile.tracks')}</h2>
              {tracksLoading ? (
                <div className="flex items-center justify-center gap-2 rounded-3xl border border-hairline bg-surface py-10 text-secondary-text">
                  <Loader2 className="h-5 w-5 animate-spin" /> {t('sheet.loadingTracks')}
                </div>
              ) : tracks.length === 0 ? (
                <p className="rounded-3xl border border-hairline bg-surface p-6 text-secondary-text">
                  {t('sheet.noTracks')}
                </p>
              ) : (
                <ul className="divide-y divide-hairline rounded-3xl border border-hairline bg-surface">
                  {tracks.map((track, i) => (
                    <li key={track.title} className="flex items-center gap-4 p-4">
                      {track.artwork ? (
                        <img
                          src={track.artwork}
                          alt=""
                          className="h-12 w-12 shrink-0 rounded-lg object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-sm font-bold text-brand-deep">
                          {i + 1}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{track.title}</span>
                        {track.album && (
                          <span className="block truncate text-sm text-secondary-text">
                            {track.album}
                          </span>
                        )}
                      </span>
                      <span className="text-sm text-secondary-text">{track.duration}</span>
                      <a
                        href={track.url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={t('profile.listen', { title: track.title })}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-deep transition-colors hover:bg-brand hover:text-black"
                      >
                        <Play className="h-4 w-4 fill-current" />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-4">
              <h2 className="display-font text-3xl md:text-4xl">{t('profile.events')}</h2>
              {artist.events.length === 0 ? (
                <div className="rounded-3xl border border-hairline bg-surface p-6 text-secondary-text">
                  <p>{t('sheet.noEvents')}</p>
                  {artist.platforms?.website && (
                    <a
                      href={artist.platforms.website}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-2 rounded-full bg-brand-deep px-5 py-2.5 text-sm font-bold text-brand-deep-foreground transition-transform hover:scale-[1.02]"
                    >
                      <CalendarDays className="h-4 w-4" /> {t('sheet.seeDates')}
                    </a>
                  )}
                </div>
              ) : (
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
              )}
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
                <span className="text-sm">{t('profile.followers', { count: compactCount(followers) })}</span>
              </div>
              <div className="flex items-center gap-3">
                <Heart className="h-5 w-5 text-brand-deep" />
                <span className="text-sm">{t('profile.likes', { count: likes })}</span>
              </div>
              <div className="flex items-center gap-3">
                <Disc3 className="h-5 w-5 text-brand-deep" />
                <span className="text-sm">
                  {tracks.length} {tracks.length > 1 ? t('profile.trackMany') : t('profile.trackOne')}
                </span>
              </div>
              <Link
                to={localize('/globe')}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-deep py-4 font-bold text-brand-deep-foreground transition-transform hover:scale-[1.02]"
              >
                <Globe2 className="h-5 w-5" /> {t('profile.seeOnMap')}
              </Link>
              {user && (
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      void toggleFollow(artist.id).then((result) => {
                        if (result.ok) {
                          setFollowing(result.following)
                          setFollowers((n) => Math.max(0, n + (result.following ? 1 : -1)))
                          toast.success(
                            result.following
                              ? t('sheet.followToast', { name: artist.name })
                              : t('sheet.unfollowToast', { name: artist.name }),
                          )
                        } else {
                          toast.error(t('sheet.followError'), { description: result.error })
                        }
                      })
                    }
                    aria-pressed={following}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-full py-4 font-bold transition-transform hover:scale-[1.02] ${
                      following ? 'bg-brand-deep text-brand-deep-foreground' : 'bg-brand text-black'
                    }`}
                  >
                    {following ? <UserCheck className="h-5 w-5" /> : <UserRoundPlus className="h-5 w-5" />}
                    {following ? t('sheet.following') : t('sheet.follow')}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void toggleFavorite(artist.id).then((result) => {
                        if (result.ok) {
                          setSaved(result.liked)
                          toast.success(
                            result.liked
                              ? t('sheet.saveToast', { name: artist.name })
                              : t('sheet.unsaveToast', { name: artist.name }),
                          )
                        } else {
                          toast.error(t('sheet.saveError'), { description: result.error })
                        }
                      })
                    }
                    aria-pressed={saved}
                    aria-label={t('sheet.save')}
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-hairline-strong transition-colors hover:bg-secondary-bg"
                  >
                    <Heart className={`h-5 w-5 ${saved ? 'fill-red-500 text-red-500' : ''}`} />
                  </button>
                </div>
              )}
              {Object.entries({ ...(artist.platforms ?? {}), ...(artist.socials ?? {}) }).length >
                0 && (
                <div className="space-y-2 border-t border-hairline pt-4">
                  <p className="text-xs uppercase tracking-widest text-secondary-text">
                    {t('profile.links')}
                  </p>
                  {Object.entries({ ...(artist.platforms ?? {}), ...(artist.socials ?? {}) }).map(
                    ([key, url]) => (
                      <a
                        key={key}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 rounded-xl bg-secondary-bg px-4 py-2.5 text-sm font-medium transition-colors hover:bg-brand-soft"
                      >
                        <ExternalLink className="h-4 w-4 shrink-0 text-brand-deep" />
                        <span className="truncate capitalize">{key.replace('_', ' ')}</span>
                      </a>
                    ),
                  )}
                </div>
              )}
            </div>

            {sameCountry.length > 0 && (
              <div className="space-y-3 rounded-3xl border border-hairline bg-surface p-6">
                <h3 className="display-font text-lg font-bold">
                  {t('profile.alsoIn', { country: artist.country })}
                </h3>
                <ul className="space-y-1">
                  {sameCountry.map((other) => (
                    <li key={other.id}>
                      <Link
                        to={localize(`/artist/${other.id}`)}
                        className="flex items-center gap-3 rounded-2xl p-3 transition-colors hover:bg-secondary-bg"
                      >
                        <AnimatedAvatar
                          name={other.name}
                          image={other.image}
                          className="h-10 w-10 rounded-full"
                          initialsClassName="bg-gradient-to-br from-brand-deep to-brand text-xs font-bold text-black"
                        />
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
