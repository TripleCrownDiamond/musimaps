import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BadgeCheck,
  Bell,
  Briefcase,
  CalendarCheck,
  CalendarDays,
  CalendarHeart,
  Camera,
  CheckCheck,
  Compass,
  Crown,
  ExternalLink,
  Eye,
  Flame,
  FolderHeart,
  Globe2,
  Guitar,
  Heart,
  ImagePlus,
  Inbox,
  Mail,
  MapPin,
  Mic2,
  PenLine,
  Send,
  Sparkles,
  Star,
  Target,
  Trash2,
  TrendingUp,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useLanguage, useLocalizedPath } from '../i18n/LanguageContext'
import { fetchBookings, type BookingRecord } from '../lib/booking'
import { setAccountType } from '../lib/discovery'
import {
  fetchArtistBooking,
  fetchMyArtistProfile,
  updateArtistBooking,
  updateMyArtistProfile,
  uploadArtistImage,
  type ArtistBooking,
  type BookingPlan,
  type ClaimedArtistProfile,
} from '../lib/profile'
import {
  checkin,
  fetchArtistFollowers,
  fetchArtistStatsByName,
  fetchArtistStatsDetail,
  fetchArtistsByIds,
  fetchFavorites,
  fetchFollowing,
  type ArtistStatsDetail,
  type ArtistSummary,
  type StreakInfo,
} from '../lib/stats'
import { fetchMyReferralRequest, type MyReferralRequest } from '../lib/waitlist'
import {
  computeRoleBadges,
  earnedCount,
  earnedPoints,
  levelFromPoints,
  syncUserGamification,
  type BadgeIcon,
  type RoleBadge,
} from '../lib/gamification'
import {
  fetchNotifications,
  markAllNotificationsRead,
  notificationIcon,
  type AppNotification,
} from '@musimaps/shared'
import { toast } from 'sonner'
import { useRef } from 'react'
import { BarChart, ChartCard, Donut, HBarList, TrendArea } from '../components/charts'
import { AnimatedAvatar } from '../components/AnimatedAvatar'

/** Palette de la marque pour les graphiques (light/dark via variables CSS). */
const DEEP = 'var(--color-brand-deep)'
const LIME = 'var(--color-brand)'
const SOFT = 'var(--color-brand-soft)'

/** Icône par type de notification (même mapping que la cloche). */
/** Icônes lucide des badges (au lieu d'emojis, cohérent avec le design system). */
const BADGE_ICONS: Record<BadgeIcon, LucideIcon> = {
  heart: Heart,
  'folder-heart': FolderHeart,
  compass: Compass,
  star: Star,
  flame: Flame,
  target: Target,
  crown: Crown,
  mic: Mic2,
  'badge-check': BadgeCheck,
  eye: Eye,
  'trending-up': TrendingUp,
  inbox: Inbox,
  'calendar-check': CalendarCheck,
  guitar: Guitar,
}

/** Libellé court d'une date ISO (jour/mois) localisé. */
function dayLabel(iso: string, lang: 'fr' | 'en'): string {
  return new Date(iso).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', {
    day: '2-digit',
    month: 'short',
  })
}

/** Durée relative localisée (fr/en). */
function timeAgo(iso: string, lang: 'fr' | 'en'): string {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' })
  if (seconds < 60) return rtf.format(-seconds, 'second')
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return rtf.format(-minutes, 'minute')
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return rtf.format(-hours, 'hour')
  const days = Math.floor(hours / 24)
  if (days < 7) return rtf.format(-days, 'day')
  return new Date(iso).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR')
}

function statusClass(status: string) {
  if (status === 'confirmed') return 'bg-green-100 text-green-700'
  if (status === 'rejected') return 'bg-red-100 text-red-700'
  return 'bg-amber-100 text-amber-700'
}

function BookingCard({ booking, t }: { booking: BookingRecord; t: (k: string) => string }) {
  return (
    <div className="rounded-3xl border border-hairline bg-surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft text-brand-deep">
            <CalendarDays className="h-5 w-5" />
          </span>
          <div>
            <p className="font-bold">{booking.artist_name}</p>
            <p className="text-xs text-secondary-text">
              {booking.event_type} · {booking.flexible_date ? '📆' : '📅'}{' '}
              {booking.event_date ?? t('booking.flexible')}
            </p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${statusClass(booking.status)}`}>
          {t(`dash.status.${booking.status}`)}
        </span>
      </div>
      {(booking.city || booking.country) && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-secondary-text">
          <MapPin className="h-4 w-4" /> {booking.city} {booking.country && `· ${booking.country}`}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {booking.budget_range && (
          <span className="rounded-full bg-secondary-bg px-3 py-1 font-medium">💰 {booking.budget_range}</span>
        )}
        {booking.audience_size && (
          <span className="rounded-full bg-secondary-bg px-3 py-1 font-medium">
            <Users className="mr-1 inline h-3 w-3" />
            {booking.audience_size}
          </span>
        )}
      </div>
      {booking.message && (
        <p className="mt-3 rounded-2xl bg-secondary-bg p-3 text-sm text-secondary-text">{booking.message}</p>
      )}
      {booking.contact_name && (
        <p className="mt-2 text-xs text-secondary-text">
          {booking.contact_name}
          {booking.phone ? ` · ${booking.phone}` : ''}
        </p>
      )}
    </div>
  )
}

interface DashStats {
  bookings: number
  favorites: number
  following: number
  profileViews: number
  pinViews: number
}

export default function Dashboard() {
  const { user, loading, refresh, updateProfile } = useAuth()
  const { t, lang } = useLanguage()
  const localize = useLocalizedPath()
  const [bookings, setBookings] = useState<BookingRecord[] | null>(null)
  const [stats, setStats] = useState<DashStats>({
    bookings: 0,
    favorites: 0,
    following: 0,
    profileViews: 0,
    pinViews: 0,
  })
  const [switching, setSwitching] = useState(false)
  // Profil revendiqué (carte) — l'artiste gère photo, cover, bio, liens.
  const [claimed, setClaimed] = useState<ClaimedArtistProfile | null>(null)
  const [claimedFollowers, setClaimedFollowers] = useState(0)
  // Réservations (forfaits) du profil revendiqué.
  const [booking, setBooking] = useState<ArtistBooking | null>(null)
  const [savingBooking, setSavingBooking] = useState(false)
  const [myReferral, setMyReferral] = useState<MyReferralRequest | null>(null)
  const [savingProfile, setSavingProfile] = useState(false)
  const photoInput = useRef<HTMLInputElement>(null)
  const coverInput = useRef<HTMLInputElement>(null)
  // Mélomane : artistes enregistrés / suivis, avec onglets.
  const [favorites, setFavorites] = useState<ArtistSummary[]>([])
  const [following, setFollowing] = useState<ArtistSummary[]>([])
  const [artistTab, setArtistTab] = useState<'favorites' | 'following'>('favorites')
  // Notifications récentes.
  const [notifications, setNotifications] = useState<AppNotification[] | null>(null)
  // Stats analytiques détaillées (artiste revendiqué) : vues uniques, pays, 14 jours.
  const [detailStats, setDetailStats] = useState<ArtistStatsDetail | null>(null)
  // Streak de connexion (pointage quotidien) + badges par rôle.
  const [streak, setStreak] = useState<StreakInfo | null>(null)
  const [rewards, setRewards] = useState<RoleBadge[] | null>(null)

  const switchAccountType = async () => {
    if (!user) return
    setSwitching(true)
    const next = user.accountType === 'business' ? 'personal' : 'business'
    const result = await setAccountType(next)
    setSwitching(false)
    if (!result.ok) {
      toast.error(t('dash.switchFailed'), { description: result.error })
      return
    }
    await refresh()
    toast.success(next === 'business' ? t('dash.business') : t('dash.personal'))
  }

  useEffect(() => {
    if (!user) return
    let cancelled = false
    const load = async () => {
      const [rows, favIds, followIds, notifs] = await Promise.all([
        // Réservations : chargées uniquement pour les comptes business (la
        // section est masquée pour les autres).
        user.accountType === 'business'
          ? fetchBookings()
          : Promise.resolve([] as Awaited<ReturnType<typeof fetchBookings>>),
        fetchFavorites(),
        fetchFollowing(),
        fetchNotifications(),
      ])
      // L'artiste ne garde que les demandes le concernant (RLS déjà appliquée).
      const mine =
        user.role === 'artist'
          ? rows.filter((b) => b.artist_name.toLowerCase() === user.displayName?.toLowerCase())
          : rows
      if (cancelled) return
      setBookings(mine)
      setNotifications(notifs)
      setStats((s) => ({
        ...s,
        bookings: mine.length,
        favorites: favIds.length,
        following: followIds.length,
      }))
      // Artistes enregistrés / suivis — uniquement pour le mélomane (l'artiste a sa propre section profil).
      const [favArtists, followArtists] =
        user.role === 'artist'
          ? ([[], []] as [ArtistSummary[], ArtistSummary[]])
          : await Promise.all([fetchArtistsByIds(favIds), fetchArtistsByIds(followIds)])
      if (cancelled) return
      setFavorites(favArtists)
      setFollowing(followArtists)

      // Stats de vues + profil revendiqué (artiste) — hoistés pour la gamification.
      let artistProfileViews = 0
      let claimedProfile: ClaimedArtistProfile | null = null
      if (user.role === 'artist' && user.displayName) {
        const artistStats = await fetchArtistStatsByName(user.displayName)
        if (artistStats && !cancelled) {
          artistProfileViews = artistStats.profileViews
          setStats((s) => ({ ...s, profileViews: artistStats.profileViews, pinViews: artistStats.pinViews }))
        }
        const profile = await fetchMyArtistProfile()
        if (profile && !cancelled) {
          claimedProfile = profile
          setClaimed(profile)
          void fetchArtistFollowers(profile.id).then((n) => {
            if (!cancelled) setClaimedFollowers(n)
          })
          void fetchArtistStatsDetail(profile.id).then((d) => {
            if (!cancelled) setDetailStats(d)
          })
          void fetchArtistBooking(profile.id).then((b) => {
            if (!cancelled) setBooking(b)
          })
        }
      }
      // Demande de référencement (waitlist liée au compte, migration 00044/00045)
      // — indépendante du displayName : le formulaire /artistes collecte un
      // nom d'artiste séparé.
      if (user.role === 'artist') {
        const referral = await fetchMyReferralRequest()
        if (referral && !cancelled) setMyReferral(referral)
        // Photo de la demande en attente → avatar du compte si vide
        // (cas des demandes envoyées avant la migration avatar_url).
        if (referral?.photo && !user.avatarUrl) {
          try {
            await updateProfile({ avatarUrl: referral.photo })
            if (!cancelled) void refresh()
          } catch {
            // Best-effort
          }
        }
      }
      if (cancelled) return

      // Pointage quotidien (streak) — idempotent dans la journée.
      const streakInfo = await checkin()
      if (cancelled) return
      setStreak(streakInfo)

      // Gamification par rôle : badges + progression, syncée vers l'admin.
      const isArtistRole = user.role === 'artist'
      const claimedEvents =
        (claimedProfile as { events?: unknown[] } | null)?.events?.length ?? 0
      const badges = computeRoleBadges({
        role: isArtistRole ? 'artist' : 'audience',
        streak: streakInfo?.current ?? 0,
        favorites: favIds.length,
        following: followIds.length,
        bookingsSent: isArtistRole ? 0 : mine.length,
        claimed: Boolean(claimedProfile),
        profileViews: artistProfileViews,
        bookingsReceived: isArtistRole ? mine.length : 0,
        events: claimedEvents,
      })
      if (cancelled) return
      setRewards(badges)
      void syncUserGamification({
        displayName: user.displayName,
        role: isArtistRole ? 'artist' : 'audience',
        badges,
      })
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [user, updateProfile, refresh])

  const markAllRead = async () => {
    if (!notifications?.some((n) => !n.read)) return
    await markAllNotificationsRead()
    setNotifications((prev) => prev?.map((n) => ({ ...n, read: true })) ?? null)
    toast.success(t('dash.markAllRead'))
  }

  // Upload photo de profil ou cover, puis sauvegarde sur le profil revendiqué.
  const handleProfileImage = async (file: File, kind: 'image' | 'cover') => {
    if (!claimed) return
    setSavingProfile(true)
    const result = await uploadArtistImage(file, kind === 'cover' ? 'covers' : 'artists')
    if (result.error) {
      setSavingProfile(false)
      toast.error(result.error)
      return
    }
    const update =
      kind === 'cover'
        ? await updateMyArtistProfile({ cover: result.url })
        : await updateMyArtistProfile({ image: result.url })
    setSavingProfile(false)
    if (!update.ok) {
      toast.error(t('dash.saveFailed'), { description: update.error })
      return
    }
    setClaimed((c) => (c ? { ...c, [kind]: result.url } : c))
    toast.success(kind === 'cover' ? t('dash.coverUpdated') : t('dash.photoUpdated'))
  }

  // Retire la photo ou la cover (le RPC traite '' comme « vider »).
  const clearProfileImage = async (kind: 'image' | 'cover') => {
    if (!claimed) return
    setSavingProfile(true)
    const update =
      kind === 'cover'
        ? await updateMyArtistProfile({ cover: '' })
        : await updateMyArtistProfile({ image: '' })
    setSavingProfile(false)
    if (!update.ok) {
      toast.error(t('dash.saveFailed'), { description: update.error })
      return
    }
    setClaimed((c) => (c ? { ...c, [kind]: '' } : c))
    toast.success(kind === 'cover' ? t('dash.coverRemoved') : t('dash.photoRemoved'))
  }

  // Réservations (forfaits) — art. revendiqué : réservable + catalogue.
  const patchPlan = (index: number, patch: Partial<BookingPlan>) => {
    setBooking((b) => {
      if (!b) return b
      return { ...b, plans: b.plans.map((p, i) => (i === index ? { ...p, ...patch } : p)) }
    })
  }

  const saveBooking = async () => {
    if (!claimed || !booking) return
    setSavingBooking(true)
    const result = await updateArtistBooking(
      claimed.id,
      booking.bookable,
      booking.plans
        .filter((p) => p.name.trim())
        .map((p) => ({
          name: p.name,
          description: p.description,
          price: p.price,
          currency: p.currency,
          duration: p.duration,
          active: p.active,
        })),
    )
    setSavingBooking(false)
    if (!result.ok) {
      toast.error(t('dash.saveFailed'), { description: result.error })
      return
    }
    const fresh = await fetchArtistBooking(claimed.id)
    if (fresh) setBooking(fresh)
    toast.success(t('dash.bookingSaved'))
  }

  // Progression de complétion du profil (onboarding) : l'artiste complète
  // nom + ville (le reste — bio, liens, photo — se fait via /artistes).
  const completion = useMemo(() => {
    if (!user) return 0
    const steps: boolean[] = [Boolean(user.displayName?.trim()), Boolean(user.city?.trim())]
    return Math.round((steps.filter(Boolean).length / steps.length) * 100)
  }, [user])

  const isArtist = user?.role === 'artist'
  const isBusiness = user?.accountType === 'business'
  const needsOnboarding = completion < 100

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-warm-white">{t('common.loading')}</div>
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-warm-white px-6 text-center">
        <h1 className="display-font text-3xl font-bold">{t('dash.loginTitle')}</h1>
        <p className="text-secondary-text">{t('dash.loginText')}</p>
        <Link
          to={localize('/login')}
          className="rounded-full bg-brand-deep px-8 py-3.5 font-medium text-brand-deep-foreground transition-transform hover:scale-105"
        >
          {t('auth.login')}
        </Link>
      </div>
    )
  }

  const statCards: { icon: typeof Eye; label: string; value: string | number }[] = isArtist
    ? [
        { icon: Eye, label: t('dash.statProfileViews'), value: stats.profileViews },
        { icon: MapPin, label: t('dash.statPinViews'), value: stats.pinViews },
        { icon: Users, label: t('dash.statFollowers'), value: claimedFollowers },
        { icon: Heart, label: t('dash.statLikes'), value: detailStats?.likes ?? 0 },
        ...(isBusiness
          ? [{ icon: CalendarDays as typeof Eye, label: t('dash.statBookings'), value: stats.bookings }]
          : []),
      ]
    : [
        { icon: Heart, label: t('dash.statFavorites'), value: stats.favorites },
        { icon: Users, label: t('dash.statFollowing'), value: stats.following },
        ...(isBusiness
          ? [{ icon: CalendarDays as typeof Eye, label: t('dash.statBookings'), value: stats.bookings }]
          : []),
        { icon: Briefcase, label: t('dash.accountType'), value: isBusiness ? t('dash.business') : t('dash.personal') },
      ]

  return (
    <div className="min-h-screen bg-warm-white px-5 pt-36 pb-24 sm:px-6 md:px-12 md:pt-44">
      <div className="mx-auto w-full max-w-5xl">
        {/* En-tête */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="display-font text-3xl font-bold sm:text-4xl md:text-5xl">
              {t('dash.welcome', { name: user.displayName ?? user.email })}
            </h1>
            <span className="mt-2 inline-flex items-center gap-2 rounded-full bg-brand px-4 py-1.5 text-sm font-bold text-black">
              {isArtist ? <Mic2 className="h-4 w-4" /> : <CalendarHeart className="h-4 w-4" />}
              {isArtist ? t('dash.roleArtist') : t('dash.roleMelomane')}
              {isBusiness && (
                <span className="ml-1 rounded-full bg-black px-2 py-0.5 text-[10px] font-bold text-brand">
                  {t('dash.business')}
                </span>
              )}
            </span>
          </div>
          <Link
            to={localize('/globe')}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-deep px-6 py-3 text-sm font-medium text-brand-deep-foreground transition-transform hover:scale-105 sm:w-auto"
          >
            <Globe2 className="h-4 w-4" /> {t('dash.explore')}
          </Link>
        </div>

        {/* Onboarding : rappel de complétion du profil */}
        {needsOnboarding && (
          <div className="mb-8 rounded-3xl border border-brand-deep/20 bg-gradient-to-br from-brand-soft to-surface p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-deep text-brand-deep-foreground">
                  <Sparkles className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-bold">{t('dash.onboardingTitle')}</p>
                  <p className="text-sm text-secondary-text">
                    {isArtist ? t('dash.onboardingArtist') : t('dash.onboardingMelomane')}
                  </p>
                </div>
              </div>
              <Link
                to={localize('/profil')}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-deep px-6 py-3 text-sm font-medium text-brand-deep-foreground transition-transform hover:scale-105 sm:w-auto"
              >
                <PenLine className="h-4 w-4" /> {t('dash.completeProfile')}
              </Link>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-hairline-strong">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-deep to-brand transition-all duration-500"
                  style={{ width: `${completion}%` }}
                />
              </div>
              <span className="text-sm font-bold">{completion}%</span>
            </div>
            <p className="mt-2 text-xs text-secondary-text">
              {isArtist ? t('dash.onboardingArtistSteps') : t('dash.onboardingMelomaneSteps')}
            </p>
          </div>
        )}

        {/* Ma demande de référencement (artiste sans profil revendiqué) */}
        {isArtist && myReferral && !claimed && (
          <div className="mb-8 rounded-3xl border border-hairline bg-surface p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                {myReferral.photo ? (
                  <img
                    src={myReferral.photo}
                    alt={myReferral.artistName ?? user.displayName ?? ''}
                    className="h-14 w-14 rounded-full border border-hairline object-cover"
                  />
                ) : (
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-full ${
                      myReferral.convertedAt
                        ? 'bg-brand text-black'
                        : 'bg-brand-soft text-brand-deep'
                    }`}
                  >
                    {myReferral.convertedAt ? (
                      <CheckCheck className="h-5 w-5" />
                    ) : (
                      <Send className="h-5 w-5" />
                    )}
                  </span>
                )}
                <div>
                  <p className="font-bold">
                    {myReferral.convertedAt
                      ? t('dash.referralValidated')
                      : t('dash.referralPending')}
                  </p>
                  <p className="text-sm text-secondary-text">
                    {myReferral.artistName ?? user.displayName}
                  </p>
                </div>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  myReferral.convertedAt
                    ? 'bg-brand text-black'
                    : 'bg-brand-soft text-brand-deep'
                }`}
              >
                {myReferral.convertedAt ? t('dash.referralStatusDone') : t('dash.referralStatusWait')}
              </span>
            </div>

            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <p className="text-secondary-text">
                <span className="font-medium text-primary-text">{t('dash.referralCity')}</span>{' '}
                {myReferral.city ?? '—'}
              </p>
              <p className="text-secondary-text">
                <span className="font-medium text-primary-text">{t('dash.referralGenre')}</span>{' '}
                {myReferral.genre ?? '—'}
              </p>
            </div>
            {myReferral.bio && (
              <p className="mt-2 line-clamp-2 text-sm text-secondary-text">{myReferral.bio}</p>
            )}

            <div className="mt-4 flex flex-wrap gap-3">
              {myReferral.convertedAt && myReferral.mapArtistId ? (
                <Link
                  to={`${localize('/artist')}/${encodeURIComponent(myReferral.mapArtistId)}`}
                  className="flex items-center gap-2 rounded-full bg-brand-deep px-6 py-3 text-sm font-medium text-brand-deep-foreground transition-transform hover:scale-105"
                >
                  <Globe2 className="h-4 w-4" /> {t('dash.referralViewMap')}
                </Link>
              ) : (
                <>
                  <Link
                    to={localize('/artistes')}
                    className="flex items-center gap-2 rounded-full bg-brand-deep px-6 py-3 text-sm font-medium text-brand-deep-foreground transition-transform hover:scale-105"
                  >
                    <PenLine className="h-4 w-4" /> {t('dash.referralEdit')}
                  </Link>
                  <p className="flex items-center gap-2 self-center text-xs text-secondary-text">
                    <Send className="h-3.5 w-3.5" /> {t('dash.referralHint')}
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Profil artiste revendiqué : photo, cover, bio, liens */}
        {claimed && (
          <div className="mb-8 overflow-hidden rounded-3xl border border-hairline bg-surface">
            <input
              ref={coverInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleProfileImage(file, 'cover')
                e.target.value = ''
              }}
            />
            <input
              ref={photoInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleProfileImage(file, 'image')
                e.target.value = ''
              }}
            />
            {/* Cover */}
            <div
              className="relative h-40 w-full bg-gradient-to-br from-brand-deep via-black to-black sm:h-52"
              style={claimed.cover ? { backgroundImage: `url(${claimed.cover})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
            >
              <button
                type="button"
                onClick={() => coverInput.current?.click()}
                disabled={savingProfile}
                className="absolute bottom-3 right-3 flex items-center gap-2 rounded-full bg-black/60 px-4 py-2 text-xs font-bold text-white backdrop-blur transition-colors hover:bg-black/80 disabled:opacity-60"
              >
                <ImagePlus className="h-4 w-4" /> {t('dash.changeCover')}
              </button>
              {claimed.cover && (
                <button
                  type="button"
                  onClick={() => void clearProfileImage('cover')}
                  disabled={savingProfile}
                  className="absolute bottom-3 right-40 flex items-center gap-2 rounded-full bg-black/60 px-4 py-2 text-xs font-bold text-white backdrop-blur transition-colors hover:bg-red-600/80 disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4" /> {t('dash.removeCover')}
                </button>
              )}
            </div>
            {/* Photo de profil */}
            <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-end sm:gap-6">
              <div className="-mt-16 sm:-mt-14">
                <div className="relative h-28 w-28">
                  <AnimatedAvatar
                    name={claimed.name}
                    image={claimed.image}
                    alt={claimed.name}
                    className="h-28 w-28 rounded-full ring-4 ring-surface"
                    initialsClassName="bg-gradient-to-br from-brand-deep to-brand text-4xl font-extrabold text-black"
                  />
                  <button
                    type="button"
                    onClick={() => photoInput.current?.click()}
                    disabled={savingProfile}
                    aria-label={t('dash.changePhoto')}
                    className="absolute inset-0 flex items-center justify-center rounded-3xl bg-black/40 text-white opacity-0 transition-opacity hover:opacity-100 disabled:opacity-0"
                  >
                    <Camera className="h-6 w-6" />
                  </button>
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="display-font flex items-center gap-2 text-2xl font-bold">
                    {claimed.name}
                    {claimed.verified && <BadgeCheck className="h-5 w-5 text-brand-deep" />}
                  </h2>
                  <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-brand-deep">
                    {t('dash.claimedProfile')}
                  </span>
                </div>
                <p className="mt-1 text-sm text-secondary-text">
                  {claimed.flag} {claimed.city}, {claimed.country} · {claimed.genre} ·{' '}
                  {t('profile.followers', { count: claimedFollowers })}
                </p>
                {claimed.bio && <p className="mt-2 line-clamp-2 text-sm text-secondary-text">{claimed.bio}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    to={localize(`/artist/${claimed.id}`)}
                    className="flex items-center gap-2 rounded-full bg-brand-deep px-5 py-2.5 text-sm font-bold text-brand-deep-foreground transition-transform hover:scale-[1.02]"
                  >
                    <ExternalLink className="h-4 w-4" /> {t('dash.viewClaimed')}
                  </Link>
                  <button
                    type="button"
                    onClick={() => photoInput.current?.click()}
                    disabled={savingProfile}
                    className="flex items-center gap-2 rounded-full border border-hairline-strong px-5 py-2.5 text-sm font-medium transition-colors hover:bg-secondary-bg disabled:opacity-60"
                  >
                    <Camera className="h-4 w-4" /> {t('dash.changePhoto')}
                  </button>
                  <button
                    type="button"
                    onClick={() => coverInput.current?.click()}
                    disabled={savingProfile}
                    className="flex items-center gap-2 rounded-full border border-hairline-strong px-5 py-2.5 text-sm font-medium transition-colors hover:bg-secondary-bg disabled:opacity-60"
                  >
                    <ImagePlus className="h-4 w-4" /> {t('dash.changeCover')}
                  </button>
                  {claimed.image && (
                    <button
                      type="button"
                      onClick={() => void clearProfileImage('image')}
                      disabled={savingProfile}
                      className="flex items-center gap-2 rounded-full border border-hairline-strong px-5 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60"
                    >
                      <Trash2 className="h-4 w-4" /> {t('dash.removePhoto')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Réservations — forfaits de l'artiste revendiqué */}
        {claimed && booking && (
          <div className="mb-8 rounded-3xl border border-hairline bg-surface p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="display-font flex items-center gap-2 text-lg font-bold">
                  <CalendarCheck className="h-5 w-5 text-brand-deep" /> {t('dash.bookingTitle')}
                </h3>
                <p className="mt-1 text-sm text-secondary-text">{t('dash.bookingDesc')}</p>
              </div>
              <label className="flex cursor-pointer items-center gap-3 rounded-full border border-hairline-strong px-4 py-2">
                <span className="text-sm font-bold">{t('dash.bookable')}</span>
                <input
                  type="checkbox"
                  checked={booking.bookable}
                  onChange={(e) =>
                    setBooking((b) => (b ? { ...b, bookable: e.target.checked } : b))
                  }
                  className="h-5 w-5 accent-[#A8FF35]"
                />
              </label>
            </div>

            {booking.bookable && (
              <div className="mt-5 grid gap-3">
                {booking.plans.length === 0 && (
                  <p className="text-sm text-secondary-text">{t('dash.bookingEmpty')}</p>
                )}
                {booking.plans.map((plan, index) => (
                  <div
                    key={plan.id || `plan-${index}`}
                    className="grid gap-2 rounded-2xl border border-hairline p-4 sm:grid-cols-2 lg:grid-cols-6"
                  >
                    <div className="lg:col-span-2">
                      <span className="text-xs font-bold text-secondary-text">{t('dash.planName')}</span>
                      <input
                        value={plan.name}
                        onChange={(e) => patchPlan(index, { name: e.target.value })}
                        placeholder="Concert privé"
                        className="mt-1 w-full rounded-xl border border-hairline-strong bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-deep"
                      />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-secondary-text">{t('dash.planPrice')}</span>
                      <input
                        type="number"
                        value={plan.price}
                        onChange={(e) => patchPlan(index, { price: Number(e.target.value) || 0 })}
                        className="mt-1 w-full rounded-xl border border-hairline-strong bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-deep"
                      />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-secondary-text">{t('dash.planCurrency')}</span>
                      <input
                        value={plan.currency}
                        onChange={(e) => patchPlan(index, { currency: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-hairline-strong bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-deep"
                      />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-secondary-text">{t('dash.planDuration')}</span>
                      <input
                        value={plan.duration}
                        onChange={(e) => patchPlan(index, { duration: e.target.value })}
                        placeholder="2h"
                        className="mt-1 w-full rounded-xl border border-hairline-strong bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-deep"
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm font-medium">
                        <input
                          type="checkbox"
                          checked={plan.active}
                          onChange={(e) => patchPlan(index, { active: e.target.checked })}
                          className="h-4 w-4 accent-[#A8FF35]"
                        />
                        {t('dash.planActive')}
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setBooking((b) =>
                            b
                              ? { ...b, plans: b.plans.filter((_, i) => i !== index) }
                              : b,
                          )
                        }
                        className="ml-auto rounded-full p-2 text-red-600 transition-colors hover:bg-red-50"
                        aria-label={t('dash.planRemove')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="sm:col-span-2 lg:col-span-6">
                      <span className="text-xs font-bold text-secondary-text">{t('dash.planDesc')}</span>
                      <input
                        value={plan.description}
                        onChange={(e) => patchPlan(index, { description: e.target.value })}
                        placeholder="Set complet…"
                        className="mt-1 w-full rounded-xl border border-hairline-strong bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-deep"
                      />
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setBooking((b) =>
                      b
                        ? {
                            ...b,
                            plans: [
                              ...b.plans,
                              {
                                id: `new-${Date.now()}`,
                                name: '',
                                description: '',
                                price: 0,
                                currency: 'EUR',
                                duration: '',
                                active: true,
                              },
                            ],
                          }
                        : b,
                    )
                  }
                  className="flex items-center justify-center gap-2 rounded-full border border-dashed border-hairline-strong px-4 py-2.5 text-sm font-bold text-brand-deep transition-colors hover:bg-brand-soft"
                >
                  + {t('dash.planAdd')}
                </button>
              </div>
            )}

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => void saveBooking()}
                disabled={savingBooking}
                className="flex items-center gap-2 rounded-full bg-brand px-6 py-2.5 text-sm font-bold text-black transition-transform hover:scale-[1.02] disabled:opacity-60"
              >
                <CheckCheck className="h-4 w-4" />
                {savingBooking ? t('common.loading') : t('dash.bookingSave')}
              </button>
            </div>
          </div>
        )}

        {/* Statistiques */}
        <div
          className={`mb-8 grid grid-cols-2 gap-3 sm:gap-4 ${
            isArtist ? 'sm:grid-cols-3 lg:grid-cols-5' : 'sm:grid-cols-4'
          }`}
        >
          {statCards.map(({ icon: Icon, label, value }) => (
            <div
              key={label}
              className="flex items-center gap-4 rounded-3xl border border-hairline bg-surface p-5"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand-deep">
                <Icon className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <p className="display-font truncate text-2xl font-bold sm:text-3xl">{value}</p>
                <p className="truncate text-xs text-secondary-text sm:text-sm">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Streak de connexion + récompenses par rôle */}
        {(streak || rewards) && (
          <div className="mb-8 space-y-4">
            {streak && (
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-hairline bg-surface p-5 sm:p-6">
                <div className="flex items-center gap-4">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-black">
                    <Flame className="h-7 w-7" />
                  </span>
                  <div>
                    <p className="font-bold">{t('dash.streakTitle')}</p>
                    <p className="text-xs text-secondary-text">{t('dash.streakHint')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-5 sm:gap-7">
                  <div className="text-center">
                    <p className="display-font text-3xl font-bold sm:text-4xl">{streak.current}</p>
                    <p className="text-[11px] font-medium text-secondary-text">{t('dash.streakDays')}</p>
                  </div>
                  <div className="h-11 w-px bg-hairline" />
                  <div className="text-center">
                    <p className="display-font text-3xl font-bold sm:text-4xl">{streak.best}</p>
                    <p className="text-[11px] font-medium text-secondary-text">{t('dash.streakBest')}</p>
                  </div>
                  {streak.checkedToday && (
                    <>
                      <div className="hidden h-11 w-px bg-hairline sm:block" />
                      <span className="rounded-full bg-brand-soft px-4 py-2 text-xs font-bold text-brand-deep">
                        {t('dash.streakChecked')}
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}
            {rewards && (
              <div className="rounded-3xl border border-hairline bg-surface p-5 sm:p-6">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand-deep">
                      <Trophy className="h-5 w-5" />
                    </span>
                    <div>
                      <h2 className="display-font text-xl font-bold sm:text-2xl">{t('dash.rewardsTitle')}</h2>
                      <p className="text-xs text-secondary-text">{t('dash.rewardsSub')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="rounded-full bg-brand px-3 py-1.5 font-bold text-black">
                      {t('dash.rewardsLevel', { level: levelFromPoints(earnedPoints(rewards)) })}
                    </span>
                    <span className="rounded-full bg-secondary-bg px-3 py-1.5 font-bold">
                      {t('dash.rewardsEarned', {
                        earned: earnedCount(rewards),
                        total: rewards.length,
                      })}
                    </span>
                  </div>
                </div>
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {rewards.map((badge) => {
                    const BadgeIcon = BADGE_ICONS[badge.icon]
                    return (
                      <li
                        key={badge.id}
                        className={`rounded-2xl border p-4 transition-colors ${
                          badge.earned
                            ? 'border-brand-deep/30 bg-brand-soft/40'
                            : 'border-hairline bg-surface/60 hover:border-hairline-strong'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                              badge.earned ? 'bg-brand text-black' : 'bg-secondary-bg text-secondary-text'
                            }`}
                          >
                            <BadgeIcon className="h-5 w-5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center justify-between gap-2">
                              <span className="truncate font-bold">
                                {t(`gamify.badge.${badge.id}.title` as never)}
                              </span>
                              <span className="shrink-0 rounded-full bg-hairline px-2 py-0.5 text-[10px] font-bold text-secondary-text">
                                +{badge.points} pts
                              </span>
                            </span>
                            <span className="mt-0.5 block text-xs leading-snug text-secondary-text">
                              {t(`gamify.badge.${badge.id}.desc` as never)}
                            </span>
                          </span>
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-hairline-strong">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-brand-deep to-brand transition-all duration-500"
                              style={{ width: `${Math.round(badge.progress * 100)}%` }}
                            />
                          </div>
                          <span className="shrink-0 text-[11px] font-semibold text-secondary-text">
                            {badge.earned ? t('dash.rewardsDone') : `${badge.current}/${badge.target}`}
                          </span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Analytique détaillée (artiste revendiqué) : vues uniques, pays, 14 jours, récurrents */}
        {isArtist && detailStats && (
          <div className="mb-8 rounded-3xl border border-hairline bg-surface p-6">
            <h2 className="display-font mb-4 flex items-center gap-2 text-2xl font-bold">
              <Eye className="h-5 w-5 text-brand-deep" /> {t('dash.analyticsTitle')}
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <div className="rounded-2xl bg-secondary-bg p-4">
                <p className="text-xs text-secondary-text">{t('dash.analyticsTotal')}</p>
                <p className="display-font mt-1 text-3xl font-bold">{detailStats.total}</p>
              </div>
              <div className="rounded-2xl bg-secondary-bg p-4">
                <p className="text-xs text-secondary-text">{t('dash.statLikes')}</p>
                <p className="display-font mt-1 text-3xl font-bold">{detailStats.likes ?? 0}</p>
              </div>
              <div className="rounded-2xl bg-secondary-bg p-4">
                <p className="text-xs text-secondary-text">{t('dash.analyticsUnique')}</p>
                <p className="display-font mt-1 text-3xl font-bold">{detailStats.unique_viewers}</p>
                <p className="mt-1 text-xs text-secondary-text">
                  {detailStats.viewers_connected} {t('dash.analyticsConnected')}
                </p>
              </div>
              <div className="rounded-2xl bg-secondary-bg p-4">
                <p className="text-xs text-secondary-text">{t('dash.statProfileViews')}</p>
                <p className="display-font mt-1 text-3xl font-bold">{detailStats.profile_views}</p>
              </div>
              <div className="rounded-2xl bg-secondary-bg p-4">
                <p className="text-xs text-secondary-text">{t('dash.statPinViews')}</p>
                <p className="display-font mt-1 text-3xl font-bold">{detailStats.pin_views}</p>
              </div>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              {/* Répartition de l'engagement : profil vs pin vs likes */}
              <ChartCard title={t('dash.chartEngagement')} subtitle={t('dash.chartEngagementSub')}>
                <Donut
                  segments={[
                    { label: t('dash.statProfileViews'), value: detailStats.profile_views, color: DEEP },
                    { label: t('dash.statPinViews'), value: detailStats.pin_views, color: LIME },
                    { label: t('dash.statLikes'), value: detailStats.likes ?? 0, color: SOFT },
                  ]}
                  centerLabel={t('dash.chartTotal')}
                  centerValue={detailStats.total}
                />
              </ChartCard>

              {/* 14 derniers jours — courbe */}
              <ChartCard
                title={t('dash.analyticsDays')}
                subtitle={detailStats.by_day.length === 0 ? t('dash.analyticsNoData') : undefined}
              >
                {detailStats.by_day.length === 0 ? (
                  <p className="py-6 text-sm text-secondary-text">{t('dash.analyticsNoData')}</p>
                ) : (
                  <>
                    <TrendArea
                      data={detailStats.by_day.map((d) => d.views)}
                      height={140}
                      color={DEEP}
                      fillColor={DEEP}
                    />
                    <div className="mt-1 flex justify-between text-[11px] text-secondary-text">
                      <span>{dayLabel(detailStats.by_day[0].day, lang)}</span>
                      <span>{dayLabel(detailStats.by_day[detailStats.by_day.length - 1].day, lang)}</span>
                    </div>
                  </>
                )}
              </ChartCard>

              {/* Top pays */}
              <ChartCard
                title={t('dash.analyticsCountries')}
                subtitle={detailStats.top_countries.length === 0 ? t('dash.analyticsNoData') : undefined}
              >
                {detailStats.top_countries.length === 0 ? (
                  <p className="py-6 text-sm text-secondary-text">{t('dash.analyticsNoData')}</p>
                ) : (
                  <HBarList
                    data={detailStats.top_countries.map((c) => ({
                      label: c.country,
                      value: c.views,
                      sub: c.unique_viewers > 0 ? `${c.unique_viewers} ${t('dash.analyticsUniqShort')}` : undefined,
                    }))}
                    showSub
                  />
                )}
              </ChartCard>

              {/* Likes 14 derniers jours — histogramme */}
              <ChartCard
                title={t('dash.analyticsLikesDays')}
                subtitle={
                  !detailStats.likes_by_day || detailStats.likes_by_day.length === 0
                    ? t('dash.analyticsNoData')
                    : undefined
                }
              >
                {!detailStats.likes_by_day || detailStats.likes_by_day.length === 0 ? (
                  <p className="py-6 text-sm text-secondary-text">{t('dash.analyticsNoData')}</p>
                ) : (
                  <BarChart
                    data={detailStats.likes_by_day.map((d) => ({
                      label: new Date(d.day).toLocaleDateString('fr-FR', { day: '2-digit' }),
                      value: d.likes,
                    }))}
                    height={150}
                    color={LIME}
                    highlight={DEEP}
                  />
                )}
              </ChartCard>
            </div>

            {/* Viewers récurrents */}
            {detailStats.top_viewers.length > 0 && (
              <div className="mt-5">
                <h3 className="mb-3 text-sm font-bold text-secondary-text">{t('dash.analyticsRepeat')}</h3>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {detailStats.top_viewers.map((v) => (
                    <li
                      key={v.label}
                      className="flex items-center justify-between rounded-xl bg-secondary-bg px-4 py-2.5 text-sm"
                    >
                      <span className="min-w-0 truncate font-medium">{v.label}</span>
                      <span className="shrink-0 text-secondary-text">
                        {v.views} {v.views > 1 ? t('dash.analyticsVisits') : t('dash.analyticsVisit')}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Mélomane : graphique d'activité (favoris / suivis) — sans réservation
            pour les comptes non-business */}
        {!isArtist && (
          <ChartCard
            title={t('dash.chartActivity')}
            subtitle={isBusiness ? t('dash.chartActivitySub') : t('dash.chartActivitySubBasic')}
            className="mb-8"
            right={
              <span className="rounded-full bg-secondary-bg px-3 py-1 text-xs font-bold">
                {stats.favorites + stats.following + (isBusiness ? stats.bookings : 0)}
              </span>
            }
          >
            <Donut
              segments={[
                { label: t('dash.statFavorites'), value: stats.favorites, color: DEEP },
                { label: t('dash.statFollowing'), value: stats.following, color: LIME },
                ...(isBusiness
                  ? [{ label: t('dash.statBookings'), value: stats.bookings, color: SOFT }]
                  : []),
              ]}
              centerLabel={t('dash.chartTotal')}
            />
          </ChartCard>
        )}

        {/* Mélomane : artistes enregistrés / suivis (contenu réel, pas juste des chiffres) */}
        {!isArtist && (
          <div className="mb-8 rounded-3xl border border-hairline bg-surface p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="display-font text-2xl font-bold">{t('dash.myArtists')}</h2>
              <div className="flex rounded-full bg-secondary-bg p-1">
                <button
                  type="button"
                  onClick={() => setArtistTab('favorites')}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    artistTab === 'favorites' ? 'bg-brand-deep text-brand-deep-foreground' : 'text-secondary-text'
                  }`}
                >
                  {t('dash.favoritesTab')} ({stats.favorites})
                </button>
                <button
                  type="button"
                  onClick={() => setArtistTab('following')}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    artistTab === 'following' ? 'bg-brand-deep text-brand-deep-foreground' : 'text-secondary-text'
                  }`}
                >
                  {t('dash.followingTab')} ({stats.following})
                </button>
              </div>
            </div>
            {favorites.length === 0 && following.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-hairline-strong bg-surface/50 p-10 text-center">
                <p className="mx-auto max-w-sm text-secondary-text">{t('dash.myArtistsEmpty')}</p>
                <Link
                  to={localize('/globe')}
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-deep px-6 py-3 text-sm font-medium text-brand-deep-foreground transition-transform hover:scale-105"
                >
                  <Globe2 className="h-4 w-4" /> {t('dash.myArtistsCta')}
                </Link>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(artistTab === 'favorites' ? favorites : following).map((artist) => (
                  <Link
                    key={artist.id}
                    to={localize(`/artist/${artist.id}`)}
                    className="group flex items-center gap-3 rounded-2xl border border-hairline bg-surface p-3 transition-colors hover:border-brand-deep/40 hover:bg-secondary-bg"
                  >
                    <AnimatedAvatar
                      name={artist.name}
                      image={artist.image}
                      alt={artist.name}
                      className="h-12 w-12 rounded-full"
                      initialsClassName="bg-brand-soft text-lg font-extrabold text-brand-deep"
                    />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1 truncate font-bold">
                        {artist.name}
                        {artist.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-brand-deep" />}
                      </span>
                      <span className="truncate text-xs text-secondary-text">
                        {[artist.genre, [artist.city, artist.country].filter(Boolean).join(', ')]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Notifications récentes */}
        {notifications !== null && notifications.length > 0 && (
          <div className="mb-8 rounded-3xl border border-hairline bg-surface p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="display-font flex items-center gap-2 text-2xl font-bold">
                <Bell className="h-5 w-5 text-brand-deep" /> {t('dash.notifications')}
              </h2>
              {notifications.some((n) => !n.read) && (
                <button
                  type="button"
                  onClick={() => void markAllRead()}
                  className="flex items-center gap-1.5 rounded-full border border-hairline-strong px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary-bg"
                >
                  <CheckCheck className="h-3.5 w-3.5" /> {t('dash.markAllRead')}
                </button>
              )}
            </div>
            <ul className="grid gap-1">
              {notifications.slice(0, 6).map((n) => (
                <li
                  key={n.id}
                  className={`flex items-start gap-3 rounded-xl px-3 py-2.5 text-sm ${
                    n.read ? '' : 'bg-brand-soft/50'
                  }`}
                >
                  <span className="mt-0.5 text-base">{notificationIcon(n.type)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block leading-snug">
                      {n.message ??
                        (n.artist_name ? `${n.artist_name} ${n.city ? `· ${n.city}` : ''}` : t('dash.notifications'))}
                    </span>
                    <span className="text-xs text-secondary-text">{timeAgo(n.created_at, lang)}</span>
                  </span>
                  {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-deep" />}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">

          <aside className="space-y-6">
            <div className="rounded-3xl border border-hairline bg-surface p-6">
              <h2 className="mb-4 font-bold">{t('dash.accountInfo')}</h2>
              <ul className="space-y-3 text-sm">
                <li className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-brand-deep" /> {user.email}
                </li>
                <li className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-brand-deep" /> {user.city ?? '—'}
                </li>
                <li className="flex items-center gap-3">
                  <Users className="h-4 w-4 text-brand-deep" /> {t('dash.roleLabel')} :{' '}
                  {isArtist ? t('auth.roleArtist') : t('auth.roleMelomane')}
                </li>
                <li className="flex items-center gap-3">
                  <Briefcase className="h-4 w-4 text-brand-deep" /> {t('dash.accountType')} :{' '}
                  {isBusiness ? t('dash.business') : t('dash.personal')}
                </li>
              </ul>

              {/* Bascule business : débloque la réservation d'artistes */}
              <button
                type="button"
                onClick={() => void switchAccountType()}
                disabled={switching}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-brand-deep py-3 text-sm font-bold text-brand-deep-foreground transition-transform hover:scale-[1.02] disabled:opacity-60"
              >
                <Briefcase className="h-4 w-4" />
                {isBusiness ? t('dash.switchPersonal') : t('dash.switchBusiness')}
              </button>
              <p className="mt-2 text-center text-xs text-secondary-text">{t('dash.businessDesc')}</p>

              <Link
                to={localize('/profil')}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-hairline-strong py-3 text-sm font-medium transition-colors hover:bg-secondary-bg"
              >
                <PenLine className="h-4 w-4" /> {t('dash.editProfile')}
              </Link>
            </div>

            {/* Réservation : rien affiché pour les comptes non-business */}
            {isBusiness && (
              <Link
                to={localize('/globe')}
                className="flex items-center justify-between rounded-3xl bg-brand-deep p-6 transition-transform hover:scale-[1.01]"
              >
                <span>
                  <span className="block font-bold text-brand-deep-foreground">{t('dash.book')}</span>
                  <span className="block text-sm text-brand-deep-foreground/70">
                    {isArtist ? t('dash.bookArtistHint') : t('dash.bookMelomaneHint')}
                  </span>
                </span>
                <CalendarHeart className="h-7 w-7 text-brand-deep-foreground" />
              </Link>
            )}
          </aside>

          {isBusiness ? (
          <section>
            <h2 className="mb-4 display-font text-2xl font-bold">
              {isArtist ? t('dash.receivedBookings') : t('dash.myBookings')}
            </h2>
            {bookings === null ? (
              <p className="text-sm text-secondary-text">{t('common.loading')}</p>
            ) : bookings.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-hairline-strong bg-surface/50 p-10 text-center">
                <p className="text-secondary-text">
                  {isArtist ? t('dash.noReceived') : t('dash.noBookings')}
                </p>
                {isBusiness && (
                  <Link
                    to={localize('/globe')}
                    className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-deep px-6 py-3 text-sm font-medium text-brand-deep-foreground transition-transform hover:scale-105"
                  >
                    <Globe2 className="h-4 w-4" /> {t('dash.bookCta')}
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid gap-4">
                {bookings.map((booking) => (
                  <BookingCard key={booking.id} booking={booking} t={t as (k: string) => string} />
                ))}
              </div>
            )}
          </section>
          ) : null}
        </div>
      </div>
    </div>
  )
}
