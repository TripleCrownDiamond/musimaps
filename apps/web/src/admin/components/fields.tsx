import { useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { ImagePlus, Loader2, Plus, Trash2, UploadCloud, X } from 'lucide-react'
import { toast } from 'sonner'
import { supabase, hasSupabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'
import { ICON_CHOICES } from '../iconChoices'

const CMS_ASSETS_BUCKET = 'cms-assets'

/**
 * Champ image : colle une URL ou importe un fichier vers Supabase Storage
 * (bucket cms-assets). Renvoie l'URL publique obtenue via onChange.
 *
 * Pour les logos, `previewBg` monte l'aperçu sur le fond où le logo sera
 * réellement affiché (blanc en mode clair, sombre en mode sombre) afin de
 * vérifier sa visibilité, et `objectFit="contain"` évite de rogner un PNG
 * transparent.
 */
export function ImageField({
  value,
  onChange,
  placeholder = 'https://…',
  previewBg = 'auto',
  objectFit = 'cover',
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** Fond de l'aperçu : aide à vérifier la visibilité d'un logo. */
  previewBg?: 'auto' | 'light' | 'dark'
  /** Rendu de l'image dans la vignette (contain pour les logos). */
  objectFit?: 'cover' | 'contain'
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const upload = async (file: File) => {
    if (!supabase) {
      toast.error('Supabase non configuré', {
        description: 'Les images ne peuvent pas être importées sans Supabase.',
      })
      return
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Fichier invalide', { description: 'Seules les images sont acceptées.' })
      return
    }
    setUploading(true)
    try {
      const safeName = file.name
        .toLowerCase()
        .replace(/[^a-z0-9.]+/g, '-')
        .replace(/^-+|-+$/g, '')
      const path = `cms/${Date.now()}-${safeName}`
      const { error: uploadError } = await supabase.storage
        .from(CMS_ASSETS_BUCKET)
        .upload(path, file, { upsert: false })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from(CMS_ASSETS_BUCKET).getPublicUrl(path)
      onChange(data.publicUrl)
      toast.success('Image importée sur Supabase Storage')
    } catch (error) {
      toast.error('Import impossible', {
        description: error instanceof Error ? error.message : 'Erreur inconnue',
      })
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border',
            previewBg === 'light' && 'border-black/10 bg-white',
            previewBg === 'dark' && 'border-white/15 bg-[#14181F]',
            previewBg === 'auto' && 'bg-muted',
          )}
        >
          {value ? (
            <img
              src={value}
              alt="Aperçu du logo"
              className={cn(
                'h-full w-full',
                objectFit === 'contain' ? 'object-contain p-1.5' : 'object-cover',
              )}
            />
          ) : (
            <ImagePlus className="text-muted-foreground size-6" />
          )}
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              aria-label="Retirer l'image"
              className="bg-background absolute top-1 right-1 flex size-5 items-center justify-center rounded-full shadow-sm hover:opacity-80"
            >
              <X className="size-3" />
            </button>
          )}
        </div>
        <div className="grid flex-1 gap-2">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
          />
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void upload(file)
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading || !hasSupabase()}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? <Loader2 className="animate-spin" /> : <UploadCloud />}
              {uploading ? 'Import…' : 'Importer une image'}
            </Button>
            <span className="text-muted-foreground text-xs">ou collez une URL</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Sélecteur d'icône lucide (grille de choix). Stocke le nom de l'icône
 * (ex : 'Globe') dans la valeur — le mobile le mappe sur lucide-react-native.
 */
export function IconSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const selected = ICON_CHOICES.find((c) => c.name === value)
  return (
    <div className="grid gap-2">
      {selected ? (
        <div className="bg-muted flex w-fit items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium">
          <selected.Icon className="size-4" /> {selected.name}
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">Aucune icône sélectionnée.</p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {ICON_CHOICES.map(({ name, Icon }) => (
          <button
            key={name}
            type="button"
            title={name}
            aria-label={name}
            onClick={() => onChange(name)}
            className={cn(
              'flex size-10 items-center justify-center rounded-lg border transition-colors hover:bg-accent',
              value === name
                ? 'border-brand-deep bg-brand-deep/10 text-brand-deep'
                : 'border-border text-muted-foreground',
            )}
          >
            <Icon className="size-5" />
          </button>
        ))}
      </div>
    </div>
  )
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: ReactNode
  hint?: string
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  )
}

export function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  )
}

export function TextAreaInput({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <Textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
    />
  )
}

/** Éditeur d'une liste d'objets simples (ajout / suppression / réordonnancement). */
export function ArrayEditor<T>({
  items,
  onChange,
  renderItem,
  createItem,
  label,
}: {
  items: T[]
  onChange: (items: T[]) => void
  renderItem: (item: T, update: (patch: Partial<T>) => void) => ReactNode
  createItem: () => T
  label: string
}) {
  const move = (from: number, to: number) => {
    const next = [...items]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    onChange(next)
  }

  return (
    <div className="grid gap-3">
      {items.map((item, index) => (
        <div key={index} className="border-border grid gap-3 rounded-lg border p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground text-xs font-medium uppercase">
              {label} {index + 1}
            </span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                disabled={index === 0}
                onClick={() => move(index, index - 1)}
                aria-label="Monter"
              >
                ↑
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                disabled={index === items.length - 1}
                onClick={() => move(index, index + 1)}
                aria-label="Descendre"
              >
                ↓
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive size-7"
                onClick={() => onChange(items.filter((_, i) => i !== index))}
                aria-label="Supprimer"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
          {renderItem(item, (patch) => {
            const next = [...items]
            next[index] = { ...item, ...patch }
            onChange(next)
          })}
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        onClick={() => onChange([...items, createItem()])}
      >
        <Plus /> Ajouter un {label.toLowerCase()}
      </Button>
    </div>
  )
}
