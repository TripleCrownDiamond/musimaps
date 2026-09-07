import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { GUEST_NUDGE_DELAY_MS, GUEST_NUDGE_DURATION_MS } from '@musimaps/shared'
import { useAuth } from '../context/AuthContext'
import { useLanguage, useLocalizedPath } from '../i18n/LanguageContext'
import { toast } from 'sonner'

/** Rappel non intrusif, une seule fois par visite de la carte pour les invités. */
export default function GuestExperienceToast() {
  const { user, loading } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const localize = useLocalizedPath()
  const { t } = useLanguage()
  const shownRef = useRef(false)
  const strippedPath = pathname.replace(/^\/(en)(?=\/|$)/, '') || '/'

  useEffect(() => {
    if (loading || user || strippedPath !== '/globe' || shownRef.current) return
    const timer = window.setTimeout(() => {
      if (shownRef.current) return
      shownRef.current = true
      toast.info(t('guest.nudge'), {
        duration: GUEST_NUDGE_DURATION_MS,
        action: {
          label: t('guest.createAccount'),
          onClick: () => navigate(localize('/signup')),
        },
      })
    }, GUEST_NUDGE_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [loading, localize, navigate, strippedPath, t, user])

  return null
}
