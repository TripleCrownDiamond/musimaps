import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Eraser,
  FileCode2,
  Gauge,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase, hasSupabase } from '@/lib/supabase'
import { useCms } from '@/context/CmsContext'
import {
  bumpCacheVersion,
  DEFAULT_HTACCESS_CACHE,
  fetchCachePolicy,
  saveCachePolicy,
} from '@/lib/cms'
import { cn } from '@/lib/utils'

interface CacheProbe {
  label: string
  status: number | null
  cacheControl: string
  age: string
  hcdn: string
  error?: string
}

/** URLs stables à inspecter (mêmes origines : en-têtes lisibles sans CORS). */
const PROBES: { label: string; url: string }[] = [
  { label: 'Page d’accueil', url: '/' },
  { label: 'Version anglaise', url: '/en' },
  { label: 'Globe', url: '/globe' },
  { label: 'Favicon', url: '/favicon-v2.png' },
  { label: 'Image OG', url: '/og-image.jpg' },
]

export default function CachePage() {
  const { cacheVersion, reload } = useCms()
  const [version, setVersion] = useState(cacheVersion)
  const [probes, setProbes] = useState<CacheProbe[]>([])
  const [probing, setProbing] = useState(false)
  const [purging, setPurging] = useState(false)
  const [purgeResult, setPurgeResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [policy, setPolicy] = useState(DEFAULT_HTACCESS_CACHE)
  const [policyDirty, setPolicyDirty] = useState(false)
  const [savingPolicy, setSavingPolicy] = useState(false)

  useEffect(() => {
    setVersion(cacheVersion)
  }, [cacheVersion])

  const loadPolicy = useCallback(async () => {
    setPolicy(await fetchCachePolicy())
    setPolicyDirty(false)
  }, [])

  useEffect(() => {
    void loadPolicy()
    void runProbes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const runProbes = async () => {
    setProbing(true)
    const entries: CacheProbe[] = []
    // Dernier bundle haché servi (source de vérité des assets immutables).
    const latestAsset = document
      .querySelector('script[type="module"]')
      ?.getAttribute('src')
    const targets = [
      ...PROBES,
      ...(latestAsset ? [{ label: 'Bundle haché (immutable)', url: latestAsset }] : []),
    ]
    for (const t of targets) {
      const entry: CacheProbe = { label: t.label, status: null, cacheControl: '—', age: '—', hcdn: '—' }
      try {
        // cache:'reload' force la revalidation : on lit les en-têtes du CDN/origine.
        const res = await fetch(t.url, { cache: 'reload' })
        entry.status = res.status
        entry.cacheControl = res.headers.get('cache-control') ?? '—'
        entry.age = res.headers.get('age') ?? '—'
        entry.hcdn = res.headers.get('x-hcdn-cache-status') ?? '—'
      } catch (err) {
        entry.error = err instanceof Error ? err.message : 'Erreur réseau'
      }
      entries.push(entry)
    }
    setProbes(entries)
    setProbing(false)
  }

  /** Invalidation immédiate : la version ?v=N change, tous les visiteurs rechargent. */
  const invalidate = async () => {
    const next = await bumpCacheVersion()
    setVersion(next)
    await reload()
    toast.success(`Cache invalidé — nouvelle version ?v=${next}`, {
      description: 'Favicon, image OG et logos seront rechargés par les visiteurs.',
    })
  }

  /** Purge CDN Hostinger via l'edge function (si déployée et configurée). */
  const runPurge = async () => {
    if (!hasSupabase()) {
      setPurgeResult({ ok: false, message: 'Supabase non configuré.' })
      return
    }
    setPurging(true)
    setPurgeResult(null)
    try {
      const { data, error } = await supabase!.functions.invoke('purge-cache')
      if (error) throw error
      const result = (data ?? {}) as { ok?: boolean; error?: string; configured?: boolean }
      setPurgeResult({
        ok: Boolean(result.ok),
        message: result.error ?? 'Cache purgé (serveur + CDN).',
      })
    } catch {
      setPurgeResult({
        ok: false,
        message:
          "Fonction de purge non déployée. Déployez-la une fois : npx supabase functions deploy purge-cache, puis configurez le jeton API Hostinger (hPanel → API) avec npx supabase secrets set HOSTINGER_API_TOKEN=… HOSTINGER_ACCOUNT_USERNAME=…",
      })
    }
    setPurging(false)
  }

  const savePolicy = async () => {
    const trimmed = policy.trim()
    if (!trimmed.includes('<IfModule mod_headers.c>') || !trimmed.includes('Cache-Control')) {
      toast.error('Politique invalide', {
        description: 'Le bloc doit contenir <IfModule mod_headers.c> et au moins une règle Cache-Control.',
      })
      return
    }
    setSavingPolicy(true)
    const result = await saveCachePolicy(trimmed)
    setSavingPolicy(false)
    if (!result.ok) {
      toast.error('Enregistrement impossible', { description: result.error })
      return
    }
    setPolicyDirty(false)
    toast.success('Politique de cache enregistrée', {
      description: 'Elle sera appliquée au .htaccess lors du prochain déploiement.',
    })
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      <div>
        <h1 className="text-2xl font-bold">Cache</h1>
        <p className="text-muted-foreground text-sm">
          Inspectez, invalidez et purgez le cache du site (navigateurs + CDN Hostinger), et
          contrôlez les en-têtes de cache appliqués au déploiement.
        </p>
      </div>

      {/* Invalidation immédiate */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="text-muted-foreground size-4" /> Invalidation immédiate
          </CardTitle>
          <CardDescription>
            Incrémente la <strong>version de cache</strong> : les fichiers stables (favicon, image
            OG…) sont alors servis avec une nouvelle URL <code>?v=N</code> — navigateurs et CDN
            sont forcés de re-télécharger, sans attendre la fin du cache.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground text-sm">Version actuelle :</span>
            <span className="rounded-full bg-brand/15 px-3 py-1 text-sm font-bold text-brand-deep">
              v{version}
            </span>
          </div>
          <Button onClick={() => void invalidate()}>
            <Eraser /> Invalider le cache maintenant
          </Button>
          <p className="text-muted-foreground w-full text-xs sm:w-auto sm:flex-1">
            Effet immédiat sur le site public. À utiliser après un changement de logo, favicon ou
            image de partage.
          </p>
        </CardContent>
      </Card>

      {/* Purge CDN */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="text-muted-foreground size-4" /> Purge CDN Hostinger
          </CardTitle>
          <CardDescription>
            Vide le cache serveur et le CDN (hCDN) via l'API Hostinger. La purge est le seul moyen
            d'expulser immédiatement un fichier déjà mis en cache « immutable » (1 an).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={() => void runPurge()} disabled={purging}>
              {purging ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              {purging ? 'Purge en cours…' : 'Purger le cache (serveur + CDN)'}
            </Button>
          </div>
          {purgeResult && (
            <div
              className={cn(
                'flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm',
                purgeResult.ok
                  ? 'border-green-600/30 bg-green-50 text-green-700'
                  : 'border-amber-600/30 bg-amber-50 text-amber-700',
              )}
            >
              {purgeResult.ok ? (
                <Gauge className="mt-0.5 size-4 shrink-0" />
              ) : (
                <ShieldAlert className="mt-0.5 size-4 shrink-0" />
              )}
              <span className="leading-relaxed">{purgeResult.message}</span>
            </div>
          )}
          <p className="text-muted-foreground text-xs">
            Prérequis : jeton API Hostinger (hPanel → API) et edge function{' '}
            <code>purge-cache</code> déployée avec les secrets{' '}
            <code>HOSTINGER_API_TOKEN</code> / <code>HOSTINGER_ACCOUNT_USERNAME</code>.
          </p>
        </CardContent>
      </Card>

      {/* État du cache */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="text-muted-foreground size-4" /> État du cache
          </CardTitle>
          <CardDescription>
            En-têtes servis par le CDN pour les URLs clés (cache-control, âge, statut hCDN).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-border border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">URL</th>
                  <th className="pb-2 font-medium">Statut</th>
                  <th className="pb-2 font-medium">Cache-Control</th>
                  <th className="pb-2 font-medium">Âge</th>
                  <th className="pb-2 font-medium">hCDN</th>
                </tr>
              </thead>
              <tbody>
                {probes.map((p) => (
                  <tr key={p.label} className="border-border border-b">
                    <td className="py-2.5 pr-3">{p.label}</td>
                    <td className="py-2.5 pr-3">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-semibold',
                          p.status !== null && p.status < 400
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700',
                        )}
                      >
                        {p.status ?? '—'}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-xs">{p.cacheControl}</td>
                    <td className="py-2.5 pr-3 text-xs">{p.age}</td>
                    <td className="py-2.5 text-xs">{p.hcdn}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <Button variant="outline" size="sm" onClick={() => void runProbes()} disabled={probing}>
              {probing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              {probing ? 'Analyse…' : 'Rafraîchir'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Politiques de cache */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCode2 className="text-muted-foreground size-4" /> Politiques de cache (.htaccess)
          </CardTitle>
          <CardDescription>
            Bloc <code>&lt;IfModule mod_headers / mod_expires&gt;</code> injecté dans le{' '}
            <code>.htaccess</code> au prochain déploiement. Changez les durées de cache ou retirez
            <code>immutable</code> si besoin, puis « Purge » pour expulser l'ancien.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4">
          <Textarea
            value={policy}
            onChange={(e) => {
              setPolicy(e.target.value)
              setPolicyDirty(true)
            }}
            rows={22}
            spellCheck={false}
            className="font-mono text-xs leading-relaxed"
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void savePolicy()} disabled={savingPolicy || !policyDirty}>
              {savingPolicy ? <Loader2 className="animate-spin" /> : null}
              Enregistrer la politique
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setPolicy(DEFAULT_HTACCESS_CACHE)
                setPolicyDirty(true)
              }}
            >
              <RotateCcw /> Restaurer les valeurs par défaut
            </Button>
            {policyDirty && (
              <span className="self-center text-xs text-amber-600">
                Modifications non enregistrées
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
