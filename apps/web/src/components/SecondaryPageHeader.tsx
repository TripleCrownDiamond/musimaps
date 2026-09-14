import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import NotificationBell from './NotificationBell'

/** En-tête des pages secondaires : retour à gauche, notifications à droite. */
export function SecondaryPageHeader({
  onBack,
  backLabel,
  beforeNotification,
  unreadCount,
}: {
  onBack: () => void
  backLabel: string
  beforeNotification?: ReactNode
  unreadCount?: number
}) {
  return (
    <div className="mb-8 flex w-full items-center justify-between">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 rounded-full border border-hairline-strong px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary-bg"
      >
        <ArrowLeft className="h-4 w-4" /> {backLabel}
      </button>
      <div className="flex items-center gap-2">
        {beforeNotification}
        <NotificationBell showWhenLoggedOut unreadCount={unreadCount} />
      </div>
    </div>
  )
}
