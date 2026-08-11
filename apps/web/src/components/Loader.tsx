export default function Loader() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-warm-white"
    >
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-hairline border-t-brand" />
      <span className="sr-only">Chargement…</span>
    </div>
  )
}
