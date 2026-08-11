import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  BadgeCheck,
  CalendarDays,
  ExternalLink,
  Flame,
  Heart,
  Loader2,
  Music2,
  Play,
  Share2,
  ShieldCheck,
  UserCheck,
  UserRoundPlus,
  X,
} from 'lucide-react'
import { compactCount, type Artist } from '@musimaps/shared'
import { useAuth } from '../context/AuthContext'
import { useLanguage, useLocalizedPath } from '../i18n/LanguageContext'
import { requestClaim } from '@musimaps/shared'
import {
  fetchArtistFollowers,
  fetchArtistLikes,
  fetchFavorites,
  fetchFollowing,
  recordProfileView,
  toggleFavorite,
  toggleFollow,
  viewerCountryFromCity,
} from '@musimaps/shared'
import { fetchArtistTracks, type StreamedTrack } from '@musimaps/shared'
import { fetchArtistBooking, type ArtistBooking } from '@musimaps/shared'
import { AnimatedAvatar } from './AnimatedAvatar'
import BookingModal from './BookingModal'

const tabs = ['About', 'Musics', 'Events', 'Nearby'] as const
type Tab = (typeof tabs)[number]

const TAB_KEYS = {
  About: 'sheet.tab.about',
  Musics: 'sheet.tab.musics',
  Events: 'sheet.tab.events',
  Nearby: 'sheet.tab.nearby',
} as const

interface ArtistSheetProps {
  artist: Artist
  /** Artistes proches, pour l'onglet Nearby. */
  nearby: Artist[]
  onClose: () => void
  onSelectArtist: (artist: Artist) => void
}

/** Icônes par plateforme. */
const PLATFORM_ICONS: Record<string, string> = {
  youtube: '▶️',
  spotify: '🎧',
  apple_music: '',
  bandcamp: '🎸',
  soundcloud: '☁️',
  deezer: '🎵',
  website: '🌐',
  facebook: 'f',
  instagram: '📷',
  twitter: '𝕏',
  tiktok: '🎬',
  wikipedia: '📖',
}

export default function ArtistSheet({ artist, nearby, onClose, onSelectArtist }: ArtistSheetProps) {
  const { t, lang } = useLanguage()
  const localize = useLocalizedPath()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('About')
  const [saved, setSaved] = useState(false)
  const [following, setFollowing] = useState(false)
  const [bookingOpen, setBookingOpen] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [claimStatus, setClaimStatus] = useState<'idle' | 'done' | 'error'>('idle')
  // Titres récupérés automatiquement (iTunes) quand le profil n'en liste aucun.
  const [autoTracks, setAutoTracks] = useState<StreamedTrack[]>([])
  const [tracksLoading, setTracksLoading] = useState(false)
  // Abonnés réels de l'artiste sur Musimaps (comptés depuis les favoris).
  const [followers, setFollowers] = useState(0)
  const [likes, setLikes] = useState(0)
  // Réservations : artiste réservable + forfaits (migration 00048).
  const [booking, setBooking] = useState<ArtistBooking | null>(null)

  // Like persistant + compteur de vue profil. Le garde utilise le dernier id
  // d'artiste affiché (la fiche reste montée quand on change d'artiste via Nearby).
  const lastArtistId = useRef<string | null>(null)
  useEffect(() => {
    if (lastArtistId.current === artist.id) return
    lastArtistId.current = artist.id
    setSaved(false)
    setFollowing(false)
    setAutoTracks([])
    setFollowers(0)
    setLikes(0)
    setBooking(null)
    void fetchFavorites().then((ids) => setSaved(ids.includes(artist.id)))
    void fetchFollowing().then((ids) => setFollowing(ids.includes(artist.id)))
    void fetchArtistFollowers(artist.id).then((n) => setFollowers(n))
    void fetchArtistLikes(artist.id).then((n) => setLikes(n))
    void fetchArtistBooking(artist.id).then((b) => {
      if (lastArtistId.current === artist.id) setBooking(b)
    })
    void recordProfileView(artist.id, { country: viewerCountryFromCity(user?.city) })
  }, [artist.id, user?.city])

  // Peuplement automatique de l'onglet Musiques depuis Apple Music/iTunes.
  useEffect(() => {
    if (artist.tracks.length > 0) return
    const controller = new AbortController()
    setTracksLoading(true)
    void fetchArtistTracks(artist.name, controller.signal).then((list) => {
      setAutoTracks(list)
      setTracksLoading(false)
    })
    return () => controller.abort()
  }, [artist.id, artist.name, artist.tracks.length])

  const toggleSave = async () => {
    const result = await toggleFavorite(artist.id)
    if (result.ok) {
      setSaved(result.liked)
      toast.success(
        result.liked ? t('sheet.saveToast', { name: artist.name }) : t('sheet.unsaveToast', { name: artist.name }),
      )
    } else toast.error(t('sheet.saveError'), { description: result.error })
  }

  const toggleFollowClick = async () => {
    const followMsg =
      lang === 'fr'
        ? `${user?.displayName ?? 'Quelqu\'un'} a commencé à te suivre`
        : `${user?.displayName ?? 'Someone'} started following you`
    const result = await toggleFollow(artist.id, followMsg)
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
  }

  // Un artiste connecté (rôle artiste) peut revendiquer un profil découvert.
  const isDiscovered = artist.source === 'musicbrainz'
  const canClaim = isDiscovered && !artist.claimedBy && user?.role === 'artist'

  const claim = async () => {
    setClaiming(true)
    const result = await requestClaim(artist.id)
    setClaiming(false)
    setClaimStatus(result.ok ? 'done' : 'error')
  }

  const platforms = (artist.platforms ?? {}) as Record<string, string>
  const socials = (artist.socials ?? {}) as Record<string, string>
  const links = { ...platforms, ...socials }

  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 px-3 pb-3 sm:px-4 sm:pb-4">
      <div className="sheet-in mx-auto w-full max-w-2xl rounded-[2rem] bg-surface p-4 shadow-2xl sm:p-6">
        <div className="relative mb-4 flex min-h-10 items-center justify-center">
          <div className="h-1.5 w-12 rounded-full bg-hairline-strong" />
          <button
            type="button"
            onClick={onClose}
            aria-label={t('sheet.close')}
            className="absolute right-6 flex h-9 w-9 items-center justify-center rounded-full bg-secondary-bg text-secondary-text shadow-sm ring-1 ring-hairline transition-colors hover:bg-hairline hover:text-primary-text sm:right-9"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Onglets */}
        <div
          role="tablist"
          aria-label={t('sheet.sections')}
          className="mb-6 flex rounded-full bg-secondary-bg p-1"
        >
          {tabs.map((name) => (
            <button
              key={name}
              role="tab"
              type="button"
              aria-selected={tab === name}
              onClick={() => setTab(name)}
              className={`flex-1 rounded-full px-2 py-2.5 text-sm font-medium transition-colors ${
                tab === name ? 'bg-surface text-brand-deep shadow-sm' : 'text-secondary-text hover:text-primary-text'
              }`}
            >
              {t(TAB_KEYS[name])}
            </button>
          ))}
        </div>

        <div className="max-h-[42vh] overflow-y-auto">
          {tab === 'About' && (
            <div className="flex flex-col gap-5 sm:flex-row">
              <AnimatedAvatar
                name={artist.name}
                image={artist.image}
                alt={artist.name}
                className="h-28 w-28 rounded-full shadow-md"
                initialsClassName="bg-gradient-to-br from-brand-deep to-brand text-3xl font-extrabold text-black"
              />
              <div className="space-y-2">
                {artist.trending && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-500">
                    <Flame className="h-3.5 w-3.5" /> {t('sheet.trending')}
                  </span>
                )}
                <h3 className="display-font flex items-center gap-2 text-3xl font-extrabold">
                  {artist.name}
                  {artist.verified && <BadgeCheck className="h-5 w-5 text-brand-deep" />}
                </h3>
                <p className="text-secondary-text">{artist.bio}</p>
                <p className="flex items-center gap-2 pt-1 font-medium">
                  <span aria-hidden="true">{artist.flag}</span>{' '}
                  {[artist.district, artist.city, artist.country].filter(Boolean).join(', ')}
                </p>
                <p className="text-sm text-secondary-text">
                  {artist.genre} · {t('sheet.followers', { count: compactCount(followers) })} ·{' '}
                  {t('sheet.likes', { count: likes })}
                </p>

                {/* Liens plateformes + réseaux */}
                {Object.keys(links).length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {Object.entries(links).map(([key, url]) => (
                      <a
                        key={key}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full border border-hairline-strong px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary-bg"
                      >
                        {key === 'youtube' ? (
                          <Play className="h-3.5 w-3.5 fill-red-500 text-red-500" />
                        ) : key === 'apple_music' ? (
                          <Music2 className="h-3.5 w-3.5" />
                        ) : (
                          <span>{PLATFORM_ICONS[key] ?? '🔗'}</span>
                        )}
                        {key.replace('_', ' ')}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'Musics' && (
            <ul className="divide-y divide-hairline">
              {tracksLoading && (
                <li className="flex items-center justify-center gap-2 py-6 text-sm text-secondary-text">
                  <Loader2 className="h-4 w-4 animate-spin" /> {t('sheet.loadingTracks')}
                </li>
              )}
              {!tracksLoading && artist.tracks.length === 0 && autoTracks.length === 0 && (
                <li className="py-6 text-center text-sm text-secondary-text">
                  {artist.platforms?.spotify ? t('sheet.listenSpotify') : t('sheet.noTracks')}
                </li>
              )}
              {artist.tracks.map((track, i) => (
                <li key={track.title} className="flex items-center gap-4 py-3">
                  <span className="w-5 text-sm text-secondary-text">{i + 1}</span>
                  <span className="flex-1 font-medium">{track.title}</span>
                  <span className="text-sm text-secondary-text">{track.duration}</span>
                  <button
                    type="button"
                    aria-label={t('profile.listen', { title: track.title })}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-brand-deep transition-colors hover:bg-brand hover:text-black"
                  >
                    <Play className="h-4 w-4" />
                  </button>
                </li>
              ))}
              {autoTracks.map((track) => (
                <li key={track.url} className="flex items-center gap-3 py-3">
                  {track.artwork ? (
                    <img
                      src={track.artwork}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-lg object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-xs font-bold text-brand-deep">
                      <Music2 className="h-4 w-4" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{track.title}</span>
                    {track.album && (
                      <span className="block truncate text-xs text-secondary-text">
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
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-deep transition-colors hover:bg-brand hover:text-black"
                  >
                    <Play className="h-4 w-4 fill-current" />
                  </a>
                </li>
              ))}
            </ul>
          )}

          {tab === 'Events' && (
            <ul className="space-y-3">
              {artist.events.length === 0 && (
                <li className="py-6 text-center text-sm text-secondary-text">
                  {t('sheet.noEvents')}
                  {artist.platforms?.website && (
                    <a
                      href={artist.platforms.website}
                      target="_blank"
                      rel="noreferrer"
                      className="mx-auto mt-3 flex w-fit items-center gap-2 rounded-full bg-brand-deep px-5 py-2.5 text-sm font-bold text-brand-deep-foreground transition-transform hover:scale-[1.02]"
                    >
                      <CalendarDays className="h-4 w-4" /> {t('sheet.seeDates')}
                    </a>
                  )}
                </li>
              )}
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
                  {t('sheet.noNearby')}
                </li>
              )}
              {nearby.map((other) => (
                <li key={other.id}>
                  <button
                    type="button"
                    onClick={() => onSelectArtist(other)}
                    className="flex w-full items-center gap-4 rounded-2xl p-3 text-left transition-colors hover:bg-secondary-bg"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-brand-deep to-brand text-sm font-bold text-black">
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

        {/* Forfaits de réservation — l'artiste réservable affiche ses prestations. */}
        {booking?.bookable && (
          <div className="mt-6 rounded-2xl border border-hairline bg-secondary-bg p-4">
            <p className="flex items-center gap-2 text-sm font-bold">
              <CalendarDays className="h-4 w-4 text-brand-deep" />
              {t('booking.plansTitle')}
              <span className="ml-auto rounded-full bg-brand px-2.5 py-0.5 text-xs font-bold text-black">
                {t('booking.bookable')}
              </span>
            </p>
            {booking.plans.filter((p) => p.active).length === 0 ? (
              <p className="mt-2 text-sm text-secondary-text">{t('booking.noPlans')}</p>
            ) : (
              <ul className="mt-3 grid gap-2">
                {booking.plans.filter((p) => p.active).map((plan) => (
                  <li
                    key={plan.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-hairline bg-surface px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{plan.name}</p>
                      {plan.duration && (
                        <p className="text-xs text-secondary-text">
                          {plan.duration}
                          {plan.description ? ` · ${plan.description}` : ''}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 text-sm font-bold">
                      {plan.price > 0 ? `${plan.price.toLocaleString('fr-FR')} ${plan.currency}` : t('booking.priceOnRequest')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex items-center gap-3 border-t border-hairline pt-5">
          {/* Réservation : artiste réservable + compte business autorisé. */}
          {booking?.bookable && user?.accountType === 'business' && (
            <button
              type="button"
              onClick={() => setBookingOpen(true)}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-brand-deep py-4 font-bold text-brand-deep-foreground transition-transform hover:scale-[1.02]"
            >
              <CalendarDays className="h-5 w-5" /> {t('booking.open')}
            </button>
          )}
          {/* Suivre : abonnement à l'artiste (notifications, découvertes).
              Non connecté → redirige vers la connexion. */}
          <button
            type="button"
            onClick={() => (user ? void toggleFollowClick() : navigate(localize('/login')))}
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
            onClick={() => (user ? void toggleSave() : navigate(localize('/login')))}
            aria-pressed={saved}
            aria-label={t('sheet.save')}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-hairline-strong transition-colors hover:bg-secondary-bg"
          >
            <Heart className={`h-5 w-5 ${saved ? 'fill-red-500 text-red-500' : ''}`} />
          </button>
          <button
            type="button"
            aria-label={t('sheet.share')}
            onClick={() => {
              const url = `${window.location.origin}${localize(`/artist/${artist.id}`)}`
              if (navigator.share) navigator.share({ title: artist.name, url }).catch(() => {})
              else navigator.clipboard?.writeText(url)
            }}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-hairline-strong transition-colors hover:bg-secondary-bg"
          >
            <Share2 className="h-5 w-5" />
          </button>
        </div>

        {/* Revendication : réservée à un compte artiste connecté */}
        {canClaim && (
          <button
            type="button"
            onClick={() => void claim()}
            disabled={claiming || claimStatus === 'done'}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-brand-deep/30 bg-brand-soft py-3 text-sm font-bold text-brand-deep transition-colors hover:bg-brand hover:text-black disabled:opacity-60"
          >
            <ShieldCheck className="h-4 w-4" />
            {claimStatus === 'done'
              ? t('sheet.claimDone')
              : claimStatus === 'error'
                ? t('sheet.claimError')
                : claiming
                  ? t('sheet.claiming')
                  : t('sheet.claim')}
          </button>
        )}

        <Link
          to={localize(`/artist/${artist.id}`)}
          className="mt-3 flex items-center justify-center gap-2 rounded-full py-3 text-sm font-medium text-brand-deep transition-colors hover:bg-secondary-bg"
        >
          {t('sheet.fullProfile')} <ExternalLink className="h-4 w-4" />
        </Link>
      </div>

      {bookingOpen && <BookingModal artist={artist} onClose={() => setBookingOpen(false)} />}
    </div>
  )
}
