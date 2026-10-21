import { useState } from 'react'
import { toast } from 'sonner'
import { Ban, Flag } from 'lucide-react'
import {
  blockArtist,
  REPORT_DETAILS_MAX,
  REPORT_REASONS,
  reportArtist,
  type Artist,
  type ReportReason,
} from '@musimaps/shared'
import { useLanguage } from '../i18n/LanguageContext'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'

/**
 * Signaler une fiche d'artiste ou bloquer l'artiste — même parcours que
 * `ReportSheet` côté mobile, logique dans `@musimaps/shared/lib/moderation`.
 */
export default function ReportDialog({
  artist,
  open,
  onOpenChange,
  onBlocked,
}: {
  artist: Artist
  open: boolean
  onOpenChange: (open: boolean) => void
  onBlocked?: () => void
}) {
  const { t } = useLanguage()
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)

  const close = () => {
    onOpenChange(false)
    setReason(null)
    setDetails('')
  }

  const send = async () => {
    if (!reason) return
    setBusy(true)
    const result = await reportArtist(artist.id, reason, details)
    setBusy(false)
    if (result.ok) {
      toast.success(t('report.sent'))
      close()
    } else toast.error(t('report.error'), { description: result.error })
  }

  const block = async () => {
    setBusy(true)
    const result = await blockArtist(artist.id)
    setBusy(false)
    if (result.ok) {
      toast.success(t('report.blocked', { name: artist.name }))
      close()
      onBlocked?.()
    } else toast.error(t('report.blockError'), { description: result.error })
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-brand-deep" /> {t('report.title')}
          </DialogTitle>
          <DialogDescription>{t('report.intro')}</DialogDescription>
        </DialogHeader>

        <div role="radiogroup" aria-label={t('report.title')} className="mt-2 flex flex-col gap-2">
          {REPORT_REASONS.map((item) => (
            <label
              key={item}
              className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium transition-colors ${
                reason === item ? 'border-brand-deep bg-brand-soft' : 'border-hairline-strong hover:bg-secondary-bg'
              }`}
            >
              <input
                type="radio"
                name="report-reason"
                value={item}
                checked={reason === item}
                onChange={() => setReason(item)}
                className="accent-[var(--color-brand-deep)]"
              />
              {t(`report.reason.${item}`)}
            </label>
          ))}
        </div>

        <label className="mt-3 block text-sm font-medium">
          {t('report.details')}
          <textarea
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            maxLength={REPORT_DETAILS_MAX}
            rows={3}
            className="mt-1.5 w-full resize-none rounded-2xl border border-hairline-strong bg-transparent px-4 py-3 text-sm outline-none focus:border-brand-deep"
          />
        </label>

        <button
          type="button"
          disabled={!reason || busy}
          onClick={() => void send()}
          className="mt-3 w-full rounded-full bg-brand-deep py-3.5 font-bold text-brand-deep-foreground transition-opacity disabled:opacity-50"
        >
          {t('report.submit')}
        </button>

        <div className="mt-2 border-t border-hairline pt-4">
          <button
            type="button"
            disabled={busy}
            onClick={() => void block()}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-hairline-strong py-3 text-sm font-bold text-red-500 transition-colors hover:bg-secondary-bg disabled:opacity-50"
          >
            <Ban className="h-4 w-4" /> {t('report.block')}
          </button>
          <p className="mt-2 text-center text-xs text-secondary-text">{t('report.blockHint')}</p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
