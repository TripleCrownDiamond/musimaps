import { Link } from 'react-router-dom'
import { Heart, ListMusic, Lock, MapPin } from 'lucide-react'
import { collectionPath, profilePath, type CollectionSummary, type PublicPerson } from '@musimaps/shared'
import { useLanguage, useLocalizedPath } from '../../i18n/LanguageContext'
import { AccountAvatar } from '../AccountMedia'

/** Vignette d'une sélection : mosaïque des photos d'artistes, titre, compteurs. */
export function CollectionCard({ collection }: { collection: CollectionSummary }) {
  const { t } = useLanguage()
  const localize = useLocalizedPath()
  const covers = collection.covers.filter(Boolean).slice(0, 4) as string[]
  return (
    <Link
      to={localize(collectionPath(collection.id))}
      className="group flex flex-col overflow-hidden rounded-3xl border border-hairline bg-surface transition-transform hover:-translate-y-0.5"
    >
      <div className="grid aspect-[2/1] grid-cols-4 gap-0.5 bg-secondary-bg">
        {covers.length > 0 ? (
          covers.map((src) => <img key={src} src={src} alt="" className="h-full w-full object-cover" loading="lazy" />)
        ) : (
          <span className="col-span-4 flex items-center justify-center text-brand-deep dark:text-brand">
            <ListMusic className="h-8 w-8" />
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="flex items-center gap-1.5 font-bold">
          {!collection.isPublic && <Lock className="h-3.5 w-3.5 shrink-0 text-secondary-text" aria-label={t('collection.private')} />}
          <span className="truncate">{collection.title}</span>
        </p>
        {collection.owner?.displayName && (
          <p className="truncate text-xs text-secondary-text">{t('collection.by', { name: collection.owner.displayName })}</p>
        )}
        <p className="mt-auto flex items-center gap-3 pt-1 text-xs text-secondary-text">
          <span>{t('collection.artists', { n: collection.itemCount })}</span>
          {collection.likeCount > 0 && (
            <span className="flex items-center gap-1">
              <Heart className="h-3 w-3" /> {collection.likeCount}
            </span>
          )}
        </p>
      </div>
    </Link>
  )
}

/** Ligne d'un mélomane : avatar, nom, @identifiant, ville. */
export function PersonRow({ person }: { person: PublicPerson }) {
  const localize = useLocalizedPath()
  const name = person.displayName || person.handle || '—'
  const body = (
    <>
      <AccountAvatar name={name} image={person.avatarUrl} variant="row" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{name}</span>
        <span className="flex items-center gap-2 truncate text-xs text-secondary-text">
          {person.handle && <span>@{person.handle}</span>}
          {person.city && (
            <span className="flex items-center gap-0.5">
              <MapPin className="h-3 w-3" /> {person.city}
            </span>
          )}
        </span>
      </span>
    </>
  )
  return person.handle ? (
    <Link
      to={localize(profilePath(person.handle))}
      className="flex items-center gap-3 rounded-2xl p-2 transition-colors hover:bg-secondary-bg"
    >
      {body}
    </Link>
  ) : (
    <div className="flex items-center gap-3 p-2">{body}</div>
  )
}

/** Partage natif quand il existe, copie du lien sinon. */
export async function shareLink(url: string, title: string, onCopied: () => void) {
  if (navigator.share) {
    await navigator.share({ title, url }).catch(() => {})
    return
  }
  await navigator.clipboard.writeText(url)
  onCopied()
}
