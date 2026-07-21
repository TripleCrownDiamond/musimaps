import logoLight from '../assets/logo/musimaps-03.png'
import logoDark from '../assets/logo/musimaps-01.png'

export default function Loader() {
  // Lecture directe du theme deja pose sur <html> : le loader s'affiche avant tout effet.
  const dark = document.documentElement.dataset.theme === 'dark'

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-8 bg-warm-white"
    >
      <div className="absolute inset-0 map-bg opacity-40" />
      <img src={dark ? logoDark : logoLight} alt="" className="relative w-28 h-auto loader-pulse" />
      <span className="sr-only">Chargement…</span>
      <div className="relative h-[2px] w-40 overflow-hidden rounded-full bg-secondary-bg">
        <div className="h-full w-1/3 rounded-full bg-brand loader-track" />
      </div>
    </div>
  )
}
