import MDEditor from '@uiw/react-md-editor'
import '@uiw/react-md-editor/markdown-editor.css'
import { useThemeValue } from '@/lib/theme'

/**
 * Éditeur riche (markdown + HTML) pour l'admin.
 * Stoque du markdown (le HTML reste possible), avec aperçu en direct.
 * Suit le thème clair/sombre du dashboard.
 */
export function RichEditor({
  value,
  onChange,
  placeholder,
  height = 220,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  height?: number
}) {
  const theme = useThemeValue()

  return (
    <div data-color-mode={theme}>
      <MDEditor
        value={value}
        onChange={(v) => onChange(v ?? '')}
        height={height}
        preview="live"
        textareaProps={{ placeholder }}
        data-gramm="false"
      />
    </div>
  )
}
