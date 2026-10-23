import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Flag, Loader2, MapPin, Share2, UserCheck, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import {
  fetchPublicProfile,
  followPerson,
  onUserBlocked,
  profileUrl,
  unfollowPerson,
  type PublicProfile as PublicProfileData,
} from '@musimaps/shared'
import { useAuth } from '../context/AuthContext'
import { useLanguage, useLocalizedPath } from '../i18n/LanguageContext'
import { AccountAvatar } from '../components/AccountMedia'
import { SecondaryPageHeader } from '../components/SecondaryPageHeader'
import { CollectionCard, shareLink } from '../components/community/CommunityCards'
import ReportDialog from '../components/ReportDialog'

/**
 * Profil public d'un mélomane (`/m/:handle`) — même contenu que
 * `PublicProfileScreen` côté mobile. Données : RPC `get_public_profile`.
 */
export default function PublicProfile() {
  const { handle = '' } = useParams()
  const { user } = useAuth()
  const { t, lang } = useLanguage()
  const localize = useLocalizedPath()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<PublicProfileData | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    setProfile(undefined)
    void fetchPublicProfile(handle).then((data) => {
      if (!cancelled) setProfile(data)
    })
    return () => {
      cancelled = true
    }
  }, [handle, user?.id])

  useEffect(() => onUserBlocked(() => navigate(localize('/communaute'))), [navigate, localize])

  const toggleFollow = async () => {
    if (!profile) return
    if (!user) return navigate(localize('/login'), { state: { from: localize(`/m/${handle}`) } })
    setBusy(true)
    const result = profile.isFollowing ? await unfollowPerson(profile.id) : await followPerson(profile.id)
    setBusy(false)
    if (!result.ok) return toast.error(t('community.error'))
    setProfile({
      ...profile,
      isFollowing: !profile.isFollowing,
      followerCount: profile.followerCount + (profile.isFollowing ? -1 : 1),
    })
  }

  const back = () => (window.history.length > 1 ? navigate(-1) : navigate(localize('/communaute')))

  if (profile === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-warm-white">
        <Loader2 className="h-7 w-7 animate-spin text-brand-deep" />
      </div>
    )
  }

  if (profile === null) {
    return (
      <main className="min-h-screen bg-warm-white px-5 pt-36 pb-24 sm:px-6 md:px-12 md:pt-44">
        <div className="mx-auto w-full max-w-3xl">
          <SecondaryPageHeader onBack={back} backLabel={t('common.back')} />
          <p className="rounded-3xl border border-hairline bg-surface p-8 text-center text-secondary-text">{t('community.notFound')}</p>
        </div>
      </main>
    )
  }

  const name = profile.displayName || profile.handle || '—'
  const joined = new Date(profile.joinedAt).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { month: 'long', year: 'numeric' })

  return (
    <main className="min-h-screen bg-warm-white px-5 pt-36 pb-24 sm:px-6 md:px-12 md:pt-44">
      <div className="mx-auto w-full max-w-3xl">
        <SecondaryPageHeader onBack={back} backLabel={t('common.back')} />

        <section className="rounded-[2rem] border border-hairline bg-surface p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <AccountAvatar name={name} image={profile.avatarUrl} />
            <div className="min-w-0 flex-1">
              <h1 className="display-font truncate text-3xl font-bold">{name}</h1>
              {profile.handle && <p className="text-sm text-secondary-text">@{profile.handle}</p>}
              <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-secondary-text">
                {profile.city && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" /> {profile.city}
                  </span>
                )}
                <span>{t('community.memberSince', { date: joined })}</span>
              </p>
              <p className="mt-2 flex gap-4 text-sm">
                <span className="font-semibold">{t('community.followers', { n: profile.followerCount })}</span>
                <span className="font-semibold">{t('community.followingCount', { n: profile.followingCount })}</span>
              </p>
            </div>
          </div>

          {profile.bio && <p className="mt-5 whitespace-pre-line text-sm leading-relaxed">{profile.bio}</p>}
          {profile.favoriteGenres.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {profile.favoriteGenres.map((genre) => (
                <span key={genre} className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-deep dark:text-brand">
                  {genre}
                </span>
              ))}
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-2">
            {profile.isMe ? (
              <Link
                to={localize('/profil')}
                className="flex items-center justify-center gap-2 rounded-full border border-hairline-strong px-5 py-3 text-sm font-semibold hover:bg-secondary-bg"
              >
                {t('profile.editProfile')}
              </Link>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void toggleFollow()}
                className={`flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold transition-colors disabled:opacity-60 ${
                  profile.isFollowing
                    ? 'border border-hairline-strong hover:bg-secondary-bg'
                    : 'bg-brand-deep text-brand-deep-foreground'
                }`}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : profile.isFollowing ? <UserCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                {profile.isFollowing ? t('community.unfollow') : t('community.follow')}
              </button>
            )}
            {profile.handle && profile.isPublic && (
              <button
                type="button"
                onClick={() => void shareLink(profileUrl(profile.handle!, lang), name, () => toast.success(t('community.linkCopied')))}
                className="flex items-center justify-center gap-2 rounded-full border border-hairline-strong px-5 py-3 text-sm font-semibold hover:bg-secondary-bg"
              >
                <Share2 className="h-4 w-4" /> {t('community.share')}
              </button>
            )}
          </div>
          {profile.isMe && !profile.isPublic && (
            <p className="mt-4 rounded-2xl bg-secondary-bg px-4 py-3 text-sm text-secondary-text">{t('community.privateNotice')}</p>
          )}
        </section>

        <section className="mt-8">
          <h2 className="mb-3 text-lg font-bold">{t('community.collections')}</h2>
          {profile.collections.length === 0 ? (
            <p className="text-sm text-secondary-text">{t('community.noCollections')}</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {profile.collections.map((collection) => (
                <CollectionCard key={collection.id} collection={collection} />
              ))}
            </div>
          )}
        </section>

        <section className="mt-8">
          <h2 className="mb-3 text-lg font-bold">{t('community.followedArtists')}</h2>
          {profile.followedArtists.length === 0 ? (
            <p className="text-sm text-secondary-text">{t('community.noArtists')}</p>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {profile.followedArtists.map((artist) => (
                <Link
                  key={artist.id}
                  to={localize(`/artist/${artist.id}`)}
                  className="flex flex-col items-center gap-2 rounded-2xl p-2 text-center transition-colors hover:bg-secondary-bg"
                >
                  <AccountAvatar name={artist.name} image={artist.image} variant="edit" />
                  <span className="line-clamp-2 text-xs font-semibold">{artist.name}</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {!profile.isMe && user && (
          <button
            type="button"
            onClick={() => setReportOpen(true)}
            className="mt-10 flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-xs font-bold text-red-500 transition-colors hover:bg-red-500/10"
          >
            <Flag className="h-3.5 w-3.5 fill-current" /> {t('community.reportProfile')}
          </button>
        )}
        {!profile.isMe && (
          <ReportDialog
            target={{ kind: 'profile', id: profile.id }}
            name={name}
            blockUserId={profile.id}
            open={reportOpen}
            onOpenChange={setReportOpen}
          />
        )}
      </div>
    </main>
  )
}
