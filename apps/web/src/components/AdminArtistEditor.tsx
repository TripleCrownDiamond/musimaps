import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { ADMIN_COORD_DECIMALS, distanceKm, slugify, type Artist } from '@musimaps/shared'
import { useLanguage } from '../i18n/LanguageContext'
import { saveMapArtist, type MapArtistPatch } from '../lib/mapAdmin'

interface AdminArtistEditorProps {
  artist: Artist
  /**
   * Coordonnée déjà corrigée par un glisser en cours, pas encore enregistrée.
   * Absente tant que l'admin n'a rien déplacé.
   */
  pendingCoordinates?: [number, number] | null
  onClose: () => void
  /** L'artiste a été écrit en base — au parent de rafraîchir la carte. */
  onSaved: (patch: MapArtistPatch) => void
}

/**
 * Panneau de correction d'un artiste, ouvert depuis un pin de la carte.
 *
 * Volontairement limité à la LOCALISATION et à l'identité minimale : le reste
 * de la fiche se gère dans l'admin, qui a l'écran pour ça. Deux formulaires
 * pour une même donnée, c'est deux façons de la faire diverger.
 */
export default function AdminArtistEditor({
  artist,
  pendingCoordinates,
  onClose,
  onSaved,
}: AdminArtistEditorProps) {
  const { t } = useLanguage()
  const [name, setName] = useState(artist.name)
  const [genre, setGenre] = useState(artist.genre ?? '')
  const [district, setDistrict] = useState(artist.district ?? '')
  const [city, setCity] = useState(artist.city ?? '')
  const [country, setCountry] = useState(artist.country ?? '')
  const [slug, setSlug] = useState(artist.slug ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  // Changer de pin en gardant le panneau ouvert doit recharger les champs :
  // sans ça, on éditerait un artiste en voyant les valeurs du précédent.
  useEffect(() => {
    setName(artist.name)
    setGenre(artist.genre ?? '')
    setDistrict(artist.district ?? '')
    setCity(artist.city ?? '')
    setCountry(artist.country ?? '')
    setSlug(artist.slug ?? '')
    setError(null)
    setDone(false)
  }, [artist.id, artist.name, artist.genre, artist.district, artist.city, artist.country, artist.slug])

  const coordinates = pendingCoordinates ?? artist.coordinates
  const movedKm = pendingCoordinates
    ? distanceKm(artist.coordinates, pendingCoordinates)
    : 0

  const submit = async () => {
    setSaving(true)
    setError(null)
    const patch: MapArtistPatch = { name, genre, district, city, country, slug: slug || null }
    if (pendingCoordinates) patch.coordinates = pendingCoordinates
    const result = await saveMapArtist(artist.id, patch)
    setSaving(false)
    if (!result.ok) {
      setError(t('mapAdmin.error', { message: result.error ?? '' }))
      return
    }
    setDone(true)
    onSaved(patch)
  }

  const field = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    autoFocus = false,
  ) => (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-secondary-text">
        {label}
      </span>
      <input
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-hairline-strong bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-deep"
      />
    </label>
  )

  return (
    <div className="pointer-events-auto absolute right-4 top-24 z-50 w-[22rem] max-w-[calc(100vw-2rem)] rounded-3xl border border-hairline bg-surface p-5 shadow-2xl">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="display-font truncate text-lg font-bold">{t('mapAdmin.title')}</h2>
          <p className="mt-0.5 text-xs text-secondary-text">{t('mapAdmin.dragHint')}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('mapAdmin.close')}
          title={t('mapAdmin.close')}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-secondary-text transition-colors hover:bg-secondary-bg hover:text-primary-text"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-3">
        {field(t('mapAdmin.name'), name, setName, true)}
        {field(t('mapAdmin.genre'), genre, setGenre)}
        {field(t('mapAdmin.district'), district, setDistrict)}
        {field(t('mapAdmin.city'), city, setCity)}
        {field(t('mapAdmin.country'), country, setCountry)}
        {field(t('mapAdmin.slug'), slug ?? '', setSlug)}
        {slug ? (
          <p className="mt-1 text-xs text-secondary-text">
            <span className="text-brand-deep font-medium">{window.location.origin}</span>/artist/<span className="font-mono text-primary-text">{slugify(slug)}</span>
          </p>
        ) : (
          <p className="mt-1 text-xs text-secondary-text">{t('mapAdmin.slugHint')}{artist.id}</p>
        )}
      </div>

      <div className="mt-4 rounded-xl bg-secondary-bg p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-secondary-text">
          {t('mapAdmin.coordinates')}
        </p>
        <p className="mt-1 font-mono text-sm">
          {coordinates[1].toFixed(ADMIN_COORD_DECIMALS)}, {coordinates[0].toFixed(ADMIN_COORD_DECIMALS)}
        </p>
        {pendingCoordinates && (
          <p className="mt-1 text-xs font-medium text-brand-deep">
            {t('mapAdmin.moved', { km: movedKm.toFixed(movedKm < 10 ? 1 : 0) })}
          </p>
        )}
        <p className="mt-1 text-[11px] leading-snug text-secondary-text">
          {t('mapAdmin.precision')}
        </p>
      </div>

      {error && <p className="mt-3 text-xs font-medium text-danger">{error}</p>}
      {done && !error && (
        <p className="mt-3 text-xs font-medium text-success">{t('mapAdmin.saved')}</p>
      )}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="flex-1 rounded-full bg-brand-deep px-4 py-2.5 text-sm font-bold text-brand-deep-foreground transition-transform hover:scale-[1.02] disabled:opacity-60"
        >
          {saving ? t('mapAdmin.saving') : t('mapAdmin.save')}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-hairline-strong px-4 py-2.5 text-sm font-bold transition-colors hover:bg-secondary-bg"
        >
          {t('mapAdmin.cancel')}
        </button>
      </div>
    </div>
  )
}
