import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2, Plus, Search, Users } from 'lucide-react'
import { toast } from 'sonner'
import {
  COLLECTION_TITLE_MAX,
  collectionPath,
  createCollection,
  fetchFollowedPeople,
  fetchFollowingCollections,
  fetchMyCollections,
  fetchMyPublicSettings,
  PEOPLE_SEARCH_DEBOUNCE_MS,
  profilePath,
  searchPeople,
  type CollectionSummary,
  type PublicPerson,
} from '@musimaps/shared'
import { useAuth } from '../context/AuthContext'
import { useLanguage, useLocalizedPath } from '../i18n/LanguageContext'
import { SecondaryPageHeader } from '../components/SecondaryPageHeader'
import { CollectionCard, PersonRow } from '../components/community/CommunityCards'

/**
 * Communauté (`/communaute`) : rechercher des mélomanes, ses sélections, le
 * fil des mélomanes suivis. Même contenu que `CommunityScreen` côté mobile.
 */
export default function Community() {
  const { user, loading } = useAuth()
  const { t } = useLanguage()
  const localize = useLocalizedPath()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PublicPerson[] | null>(null)
  const [mine, setMine] = useState<CollectionSummary[] | null>(null)
  const [feed, setFeed] = useState<CollectionSummary[]>([])
  const [followed, setFollowed] = useState<PublicPerson[]>([])
  const [publicSettings, setPublicSettings] = useState<{ isPublic: boolean; handle: string | null } | null>(null)
  const [title, setTitle] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    void Promise.all([fetchMyCollections(), fetchFollowingCollections(), fetchFollowedPeople(), fetchMyPublicSettings()]).then(
      ([collections, following, people, settings]) => {
        if (cancelled) return
        setMine(collections)
        setFeed(following)
        setFollowed(people)
        setPublicSettings(settings)
      },
    )
    return () => {
      cancelled = true
    }
  }, [user])

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      void searchPeople(query).then((people) => {
        if (!cancelled) setResults(people)
      })
    }, PEOPLE_SEARCH_DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query])

  const create = async () => {
    if (!title.trim()) return toast.error(t('collection.titleRequired'))
    setCreating(true)
    const created = await createCollection({ title })
    setCreating(false)
    if ('error' in created) return toast.error(t('community.error'))
    navigate(localize(collectionPath(created.id)))
  }

  const back = () => (window.history.length > 1 ? navigate(-1) : navigate(localize('/dashboard')))

  return (
    <main className="min-h-screen bg-warm-white px-5 pt-36 pb-24 sm:px-6 md:px-12 md:pt-44">
      <div className="mx-auto w-full max-w-4xl">
        <SecondaryPageHeader onBack={back} backLabel={t('common.back')} />
        <h1 className="display-font text-3xl font-bold">{t('community.title')}</h1>
        <p className="mt-1.5 text-sm text-secondary-text">{t('community.subtitle')}</p>

        {!loading && !user && (
          <p className="mt-6 rounded-3xl border border-hairline bg-surface p-5 text-sm">
            {t('community.loginRequired')}{' '}
            <Link to={localize('/login')} state={{ from: localize('/communaute') }} className="font-semibold text-brand-deep hover:underline">
              {t('auth.login')}
            </Link>
          </p>
        )}

        {user && publicSettings && (
          <div className="mt-6 flex flex-col gap-3 rounded-3xl border border-hairline bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm">
              <span className="font-semibold">{publicSettings.isPublic ? t('community.publicOn') : t('community.publicOff')}</span>
              {!publicSettings.isPublic && <span className="block text-secondary-text">{t('community.privateNotice')}</span>}
            </p>
            {publicSettings.isPublic && publicSettings.handle ? (
              <Link to={localize(profilePath(publicSettings.handle))} className="shrink-0 rounded-full border border-hairline-strong px-5 py-2.5 text-center text-sm font-semibold hover:bg-secondary-bg">
                {t('community.viewMyProfile')}
              </Link>
            ) : (
              <Link to={`${localize('/profil')}#public-profile`} className="shrink-0 rounded-full bg-brand-deep px-5 py-2.5 text-center text-sm font-bold text-brand-deep-foreground">
                {t('community.makePublicCta')}
              </Link>
            )}
          </div>
        )}

        {user && (
          <section className="mt-8">
            <h2 className="mb-3 text-lg font-bold">{t('collection.my')}</h2>
            <form
              onSubmit={(event) => {
                event.preventDefault()
                void create()
              }}
              className="mb-4 flex gap-2"
            >
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={COLLECTION_TITLE_MAX}
                placeholder={t('collection.titlePlaceholder')}
                aria-label={t('collection.new')}
                className="min-w-0 flex-1 rounded-full border border-hairline-strong bg-surface px-4 py-2.5 text-sm outline-none focus:border-brand-deep"
              />
              <button type="submit" disabled={creating} className="flex shrink-0 items-center gap-1.5 rounded-full bg-brand-deep px-4 py-2.5 text-sm font-bold text-brand-deep-foreground disabled:opacity-60">
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {t('collection.new')}
              </button>
            </form>
            {mine === null ? (
              <Loader2 className="h-6 w-6 animate-spin text-brand-deep" />
            ) : mine.length === 0 ? (
              <p className="text-sm text-secondary-text">{t('collection.noneYet')}</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {mine.map((collection) => (
                  <CollectionCard key={collection.id} collection={collection} />
                ))}
              </div>
            )}
          </section>
        )}

        {user && (
          <section className="mt-10">
            <h2 className="mb-3 text-lg font-bold">{t('community.feedTitle')}</h2>
            {feed.length === 0 ? (
              <p className="text-sm text-secondary-text">{t('community.feedEmpty')}</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {feed.map((collection) => (
                  <CollectionCard key={collection.id} collection={collection} />
                ))}
              </div>
            )}
          </section>
        )}

        <div className="mt-10 grid gap-8 md:grid-cols-2">
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
              <Search className="h-4 w-4" /> {t('community.peopleTitle')}
            </h2>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('community.searchPlaceholder')}
              aria-label={t('community.searchPlaceholder')}
              className="mb-3 w-full rounded-full border border-hairline-strong bg-surface px-4 py-2.5 text-sm outline-none focus:border-brand-deep"
            />
            {results === null ? (
              <Loader2 className="h-6 w-6 animate-spin text-brand-deep" />
            ) : results.length === 0 ? (
              <p className="text-sm text-secondary-text">{t('community.searchEmpty')}</p>
            ) : (
              <div className="flex flex-col">
                {results.map((person) => (
                  <PersonRow key={person.id} person={person} />
                ))}
              </div>
            )}
          </section>

          {user && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
                <Users className="h-4 w-4" /> {t('community.followedPeople')}
              </h2>
              {followed.length === 0 ? (
                <p className="text-sm text-secondary-text">{t('community.feedEmpty')}</p>
              ) : (
                <div className="flex flex-col">
                  {followed.map((person) => (
                    <PersonRow key={person.id} person={person} />
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </main>
  )
}
