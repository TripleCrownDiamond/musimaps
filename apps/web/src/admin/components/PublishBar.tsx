import { useState } from 'react'
import { toast } from 'sonner'
import { Eye, Loader2, Rocket, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'

interface PublishBarProps {
  dirty: boolean
  loading: boolean
  publishedAt: string | null
  /** URL de prévisualisation (masque le bouton Aperçu si vide). */
  previewUrl?: string
  onSave: () => Promise<{ ok: boolean; error?: string }>
  onPublish: () => Promise<{ ok: boolean; error?: string }>
  onDiscard: () => Promise<{ ok: boolean; error?: string }>
  onPreview?: () => void
  className?: string
}

export function PublishBar({
  dirty,
  loading,
  publishedAt,
  previewUrl = '',
  onSave,
  onPublish,
  onDiscard,
  onPreview,
  className,
}: PublishBarProps) {
  const [busy, setBusy] = useState<'save' | 'publish' | 'discard' | null>(null)

  const save = async () => {
    setBusy('save')
    const result = await onSave()
    setBusy(null)
    if (result.ok) toast.success('Brouillon enregistré')
    else toast.error('Enregistrement impossible', { description: result.error })
  }

  const publish = async () => {
    setBusy('publish')
    const result = await onPublish()
    setBusy(null)
    if (result.ok) toast.success('Contenu publié')
    else toast.error('Publication impossible', { description: result.error })
  }

  const discard = async () => {
    setBusy('discard')
    const result = await onDiscard()
    setBusy(null)
    if (result.ok) toast.success('Brouillon annulé — version publiée restaurée')
    else toast.error('Annulation impossible', { description: result.error })
  }

  const openPreview = () => {
    if (onPreview) onPreview()
    else if (previewUrl) window.open(previewUrl, '_blank', 'noopener,noreferrer')
  }

  const disabled = busy !== null || loading

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <Badge variant={dirty ? 'secondary' : 'outline'} className="max-w-full truncate">
        {loading
          ? 'Chargement…'
          : dirty
            ? 'Brouillon non publié'
            : publishedAt
              ? `Publié le ${new Date(publishedAt).toLocaleDateString('fr-FR')}`
              : 'Jamais publié'}
      </Badge>

      <Button variant="outline" size="sm" onClick={save} disabled={disabled} aria-label="Enregistrer le brouillon">
        {busy === 'save' ? <Loader2 className="animate-spin" /> : <Save />}
        <span className="hidden sm:inline">Enregistrer le brouillon</span>
      </Button>

      {(onPreview || previewUrl) && (
        <Button variant="outline" size="sm" onClick={openPreview} disabled={disabled} aria-label="Aperçu">
          <Eye />
          <span className="hidden sm:inline">Aperçu</span>
        </Button>
      )}

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button size="sm" disabled={disabled || !dirty} aria-label="Publier">
            {busy === 'publish' ? <Loader2 className="animate-spin" /> : <Rocket />}
            <span className="hidden sm:inline">Publier</span>
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publier ce contenu ?</AlertDialogTitle>
            <AlertDialogDescription>
              La version publiée remplacera ce que les visiteurs voient actuellement sur le site
              public.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => void publish()}>Publier</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            disabled={disabled || !dirty}
            aria-label="Annuler le brouillon"
          >
            <Trash2 />
            <span className="hidden sm:inline">Annuler le brouillon</span>
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler le brouillon ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les modifications non publiées seront perdues et la version publiée sera restaurée
              dans l’éditeur.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Garder le brouillon</AlertDialogCancel>
            <AlertDialogAction onClick={() => void discard()}>Annuler</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
