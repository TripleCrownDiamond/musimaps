import { KeyRound } from 'lucide-react'

/**
 * Affiche a la place de la carte quand VITE_MAPBOX_TOKEN est absent,
 * plutot que de laisser un ecran vide ou une erreur Mapbox.
 */
export default function MapboxTokenNotice({ compact = false }: { compact?: boolean }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-secondary-bg map-bg p-6">
      <div className="floating-card max-w-md space-y-4 rounded-3xl p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand-deep">
          <KeyRound className="h-6 w-6" />
        </div>
        <h3 className="display-font text-xl font-bold">Token Mapbox manquant</h3>
        {!compact && (
          <>
            <p className="text-sm text-secondary-text">
              Cree le fichier <code className="rounded bg-hairline px-1.5 py-0.5">musimaps-app/.env.local</code> avec
              ta cle publique Mapbox, puis relance le serveur de dev :
            </p>
            <pre className="overflow-x-auto rounded-xl bg-hairline p-3 text-left text-xs">
              VITE_MAPBOX_TOKEN=pk.xxxxx
            </pre>
          </>
        )}
      </div>
    </div>
  )
}
