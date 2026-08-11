import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Loader2,
  Send,
  X,
} from 'lucide-react'
import type { Artist } from '@musimaps/shared'
import { useAuth } from '../context/AuthContext'
import { useLanguage, useLocalizedPath } from '../i18n/LanguageContext'
import { requestBooking, type BookingPref } from '../lib/booking'
import { notifyArtistAction } from '../lib/stats'

interface BookingModalProps {
  artist: Artist
  onClose: () => void
}

type Status = 'idle' | 'sending' | 'done' | 'gated' | 'error'

const STEP_KEYS = ['type', 'date', 'location', 'budget', 'audience', 'message', 'contact', 'prefs'] as const
type StepKey = (typeof STEP_KEYS)[number]

interface FormState {
  eventType: string
  eventDate: string
  flexible: boolean
  city: string
  country: string
  address: string
  budgetRange: string
  budgetAmount: string
  audienceSize: string
  message: string
  contactName: string
  company: string
  phone: string
  website: string
  instagram: string
  linkedin: string
  contactPrefs: BookingPref[]
}

const INITIAL_FORM: FormState = {
  eventType: '',
  eventDate: '',
  flexible: false,
  city: '',
  country: '',
  address: '',
  budgetRange: '',
  budgetAmount: '',
  audienceSize: '',
  message: '',
  contactName: '',
  company: '',
  phone: '',
  website: '',
  instagram: '',
  linkedin: '',
  contactPrefs: [],
}

const EVENT_TYPES = ['private', 'festival', 'concert', 'wedding', 'corporate', 'other'] as const
const BUDGETS = ['under500', '500_2000', '2000_5000', '5000_10000', '10000'] as const
const AUDIENCES = ['private', '100', '500', '1000', '5000'] as const
const PREFS: { value: BookingPref; icon: string }[] = [
  { value: 'email', icon: '✉️' },
  { value: 'whatsapp', icon: '💬' },
  { value: 'phone', icon: '📞' },
  { value: 'any', icon: '🙌' },
]

export default function BookingModal({ artist, onClose }: BookingModalProps) {
  const { t, lang } = useLanguage()
  const { user } = useAuth()
  const navigate = useNavigate()
  const localize = useLocalizedPath()
  const [step, setStep] = useState<number>(0)
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>('idle')

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  const togglePref = (pref: BookingPref) =>
    setForm((current) => {
      const prefs = current.contactPrefs.includes(pref)
        ? current.contactPrefs.filter((p) => p !== pref)
        : [...current.contactPrefs, pref]
      // « Peu importe » exclut les autres et inversement.
      if (pref === 'any' && prefs.includes('any')) return { ...current, contactPrefs: ['any'] }
      if (pref !== 'any') return { ...current, contactPrefs: prefs.filter((p) => p !== 'any') }
      return { ...current, contactPrefs: prefs }
    })

  const validate = (key: StepKey): string | null => {
    switch (key) {
      case 'type':
        return form.eventType ? null : t('booking.required')
      case 'date':
        return form.flexible || form.eventDate.trim() ? null : t('booking.required')
      case 'location':
        if (!form.city.trim()) return t('booking.city')
        if (!form.country.trim()) return t('booking.country')
        return null
      case 'budget':
        return form.budgetRange || form.budgetAmount.trim() ? null : t('booking.required')
      case 'audience':
        return form.audienceSize ? null : t('booking.required')
      case 'message':
        return form.message.trim() ? null : t('booking.required')
      case 'contact':
        return form.contactName.trim() ? null : t('booking.contact.name')
      case 'prefs':
        return form.contactPrefs.length ? null : t('booking.required')
    }
  }

  const next = () => {
    const err = validate(STEP_KEYS[step])
    if (err) return setError(err)
    setError(null)
    setStep((s) => Math.min(s + 1, STEP_KEYS.length - 1))
  }

  const submit = async () => {
    const err = validate('prefs')
    if (err) return setError(err)
    setError(null)
    setStatus('sending')
    const result = await requestBooking({
      artistId: artist.id,
      artistName: artist.name,
      eventType: t(`booking.type.${form.eventType}` as never),
      eventDate: form.eventDate.trim(),
      flexible: form.flexible,
      city: form.city.trim(),
      country: form.country.trim(),
      address: form.address.trim(),
      budgetRange: form.budgetAmount
        ? `~${form.budgetAmount} €`
        : t(`booking.budget.${form.budgetRange}` as never),
      budgetAmount: form.budgetAmount.trim(),
      audienceSize: t(`booking.audience.${form.audienceSize}` as never),
      message: form.message.trim(),
      contactName: form.contactName.trim(),
      company: form.company.trim(),
      phone: form.phone.trim(),
      website: form.website.trim(),
      instagram: form.instagram.trim(),
      linkedin: form.linkedin.trim(),
      contactPrefs: form.contactPrefs,
    })
    if (result.ok) {
      setStatus('done')
      // Notifie l'artiste revendiqué : une demande de réservation vient d'arriver.
      const typeLabel = t(`booking.type.${form.eventType}` as never)
      const msg =
        lang === 'fr'
          ? `${form.contactName || 'Quelqu\'un'} souhaite te réserver pour un ${typeLabel}.`
          : `${form.contactName || 'Someone'} wants to book you for a ${typeLabel}.`
      void notifyArtistAction(artist.id, 'booking', msg)
    } else if (result.error && /not_subscriber|subscriber/i.test(result.error)) setStatus('gated')
    else {
      setStatus('error')
      setError(result.error ?? t('booking.failed'))
    }
  }

  const field =
    'w-full rounded-2xl border border-hairline-strong px-5 py-3.5 outline-none focus:ring-2 focus:ring-brand-deep'

  const optionCard = (active: boolean) =>
    `flex items-center gap-3 rounded-2xl border p-4 text-left transition-all ${
      active ? 'border-brand-deep bg-brand-soft ring-2 ring-brand-deep' : 'border-hairline-strong hover:bg-secondary-bg'
    }`

  const stepContent = useMemo(() => {
    const stepKey = STEP_KEYS[step]
    switch (stepKey) {
      case 'type':
        return (
          <div>
            <p className="mb-4 text-sm text-secondary-text">{t('booking.type.hint')}</p>
            <div className="grid gap-3">
              {EVENT_TYPES.map((value) => (
                <button key={value} type="button" onClick={() => set('eventType', value)} className={optionCard(form.eventType === value)}>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-black">{form.eventType === value ? <Check className="h-5 w-5" /> : '🎤'}</span>
                  <span className="font-medium">{t(`booking.type.${value}` as never)}</span>
                </button>
              ))}
            </div>
          </div>
        )
      case 'date':
        return (
          <div className="grid gap-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">📅 {t('booking.date.label')}</span>
              <input
                type="text"
                value={form.eventDate}
                onChange={(e) => set('eventDate', e.target.value)}
                disabled={form.flexible}
                placeholder={t('booking.datePh')}
                className={`${field} disabled:opacity-50`}
              />
            </label>
            <button type="button" onClick={() => set('flexible', !form.flexible)} className={optionCard(form.flexible)}>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-black">📆</span>
              <span>
                <span className="block font-medium">{t('booking.flexible')}</span>
                <span className="block text-xs text-secondary-text">{t('booking.flexibleHint')}</span>
              </span>
            </button>
          </div>
        )
      case 'location':
        return (
          <div className="grid gap-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">{t('booking.city')}</span>
              <input value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Paris" className={field} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">{t('booking.country')}</span>
              <input value={form.country} onChange={(e) => set('country', e.target.value)} placeholder="France" className={field} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">{t('booking.address')}</span>
              <input value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="12 rue de la Musique" className={field} />
            </label>
          </div>
        )
      case 'budget':
        return (
          <div className="grid gap-3">
            {BUDGETS.map((value) => (
              <button key={value} type="button" onClick={() => { set('budgetRange', value); set('budgetAmount', '') }} className={optionCard(form.budgetRange === value && !form.budgetAmount)}>
                <span className="font-medium">{t(`booking.budget.${value}` as never)}</span>
              </button>
            ))}
            <div className={`${optionCard(Boolean(form.budgetAmount))} items-center gap-3`}>
              <span className="font-medium">💵 {t('booking.budget.custom')}</span>
              <input
                value={form.budgetAmount}
                onChange={(e) => { set('budgetAmount', e.target.value); if (e.target.value) set('budgetRange', '') }}
                placeholder={t('booking.budget.customPh')}
                inputMode="numeric"
                className="min-w-0 flex-1 rounded-xl border border-hairline-strong px-4 py-2.5 outline-none focus:ring-2 focus:ring-brand-deep"
              />
            </div>
          </div>
        )
      case 'audience':
        return (
          <div className="grid grid-cols-2 gap-3">
            {AUDIENCES.map((value) => (
              <button key={value} type="button" onClick={() => set('audienceSize', value)} className={optionCard(form.audienceSize === value)}>
                <span className="font-medium">{t(`booking.audience.${value}` as never)}</span>
              </button>
            ))}
          </div>
        )
      case 'message':
        return (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">{t('booking.message.title')}</span>
            <textarea
              value={form.message}
              onChange={(e) => set('message', e.target.value)}
              placeholder={t('booking.messagePh')}
              rows={5}
              className={`${field} resize-none`}
            />
          </label>
        )
      case 'contact':
        return (
          <div className="grid gap-4">
            <div className="rounded-2xl bg-brand-soft p-4">
              <span className="block text-xs font-semibold uppercase tracking-wide text-brand-deep">{t('booking.contact.email')}</span>
              <span className="mt-0.5 block font-bold text-black">{user?.email ?? '—'}</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">{t('booking.contact.name')}</span>
                <input value={form.contactName} onChange={(e) => set('contactName', e.target.value)} placeholder="Jean Martin" className={field} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">{t('booking.contact.company')}</span>
                <input value={form.company} onChange={(e) => set('company', e.target.value)} placeholder="Festival XYZ" className={field} />
              </label>
            </div>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">{t('booking.contact.phone')}</span>
              <input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+33 6 12 34 56 78" className={field} />
            </label>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">{t('booking.contact.website')}</span>
                <input value={form.website} onChange={(e) => set('website', e.target.value)} placeholder="https://…" className={field} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">{t('booking.contact.instagram')}</span>
                <input value={form.instagram} onChange={(e) => set('instagram', e.target.value)} placeholder="@…" className={field} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">{t('booking.contact.linkedin')}</span>
                <input value={form.linkedin} onChange={(e) => set('linkedin', e.target.value)} placeholder="in/…" className={field} />
              </label>
            </div>
          </div>
        )
      case 'prefs':
        return (
          <div>
            <p className="mb-4 text-sm text-secondary-text">{t('booking.prefs.title')}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {PREFS.map(({ value, icon }) => (
                <button key={value} type="button" onClick={() => togglePref(value)} className={optionCard(form.contactPrefs.includes(value))}>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-black">{icon}</span>
                  <span className="font-medium">{t(`booking.prefs.${value}` as never)}</span>
                </button>
              ))}
            </div>
          </div>
        )
    }
  }, [step, form, t, user?.email]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalSteps = STEP_KEYS.length
  const isLast = step === totalSteps - 1

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center">
      <button type="button" aria-label={t('booking.cancel')} className="absolute inset-0" onClick={onClose} />
      <div className="sheet-in relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-[2rem] bg-surface p-6 shadow-2xl sm:rounded-[2rem] sm:p-8">
        <button
          type="button"
          onClick={onClose}
          aria-label={t('booking.cancel')}
          className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-hairline transition-colors hover:bg-hairline-strong"
        >
          <X className="h-4 w-4" />
        </button>

        {status === 'done' ? (
          <div className="py-10 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
              <CalendarDays className="h-8 w-8" />
            </div>
            <h2 className="display-font text-2xl font-bold">{t('booking.success')}</h2>
          </div>
        ) : status === 'gated' ? (
          <div className="py-8 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-brand-soft text-brand-deep">👑</div>
            <h2 className="display-font mb-3 text-2xl font-bold">{t('booking.gated')}</h2>
            <p className="text-secondary-text">{t('booking.gatedText')}</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 rounded-full bg-brand-deep px-8 py-3.5 font-medium text-brand-deep-foreground transition-transform hover:scale-105"
            >
              {t('booking.cancel')}
            </button>
          </div>
        ) : !user ? (
          <div className="py-8 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-brand-soft text-brand-deep">
              <CalendarDays className="h-8 w-8" />
            </div>
            <h2 className="display-font mb-3 text-2xl font-bold">{t('booking.loginTitle')}</h2>
            <p className="text-secondary-text">{t('booking.loginText')}</p>
            <button
              type="button"
              onClick={() => {
                onClose()
                navigate(localize('/login'))
              }}
              className="mt-6 rounded-full bg-brand-deep px-8 py-3.5 font-medium text-brand-deep-foreground transition-transform hover:scale-105"
            >
              {t('booking.loginCta')}
            </button>
            <p className="mt-4 text-sm text-secondary-text">
              {t('booking.loginSub')}{' '}
              <button
                type="button"
                onClick={() => {
                  onClose()
                  navigate(localize('/signup'))
                }}
                className="font-medium text-brand-deep hover:underline"
              >
                {t('booking.signupCta')}
              </button>
            </p>
          </div>
        ) : (
          <>
            <div className="mb-6 flex items-center justify-between">
              <h2 className="display-font text-2xl font-bold">{t('booking.title', { artist: artist.name })}</h2>
              <span className="rounded-full bg-secondary-bg px-3 py-1 text-xs font-semibold text-secondary-text">
                {t('booking.stepOf', { current: step + 1, total: totalSteps })}
              </span>
            </div>

            {/* Barre de progression */}
            <div className="mb-6 flex gap-1.5">
              {STEP_KEYS.map((_, index) => (
                <div
                  key={index}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${index <= step ? 'bg-brand-deep' : 'bg-hairline-strong'}`}
                />
              ))}
            </div>

            <div className="mb-2 text-sm font-semibold text-secondary-text">
              {t(
                {
                  type: 'booking.type.title',
                  date: 'booking.date.title',
                  location: 'booking.location.title',
                  budget: 'booking.budget.title',
                  audience: 'booking.audience.title',
                  message: 'booking.message.title',
                  contact: 'booking.contact.title',
                  prefs: 'booking.prefs.title',
                }[STEP_KEYS[step]] as never,
              )}
            </div>

            <div className="mb-6">{stepContent}</div>

            {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setError(null)
                  setStep((s) => Math.max(s - 1, 0))
                }}
                disabled={step === 0}
                className="flex items-center gap-2 rounded-full border border-hairline-strong px-6 py-3.5 font-medium transition-colors hover:bg-secondary-bg disabled:opacity-40"
              >
                <ArrowLeft className="h-4 w-4" /> {t('booking.back')}
              </button>
              {isLast ? (
                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={status === 'sending'}
                  className="flex flex-1 items-center justify-center gap-2 rounded-full bg-brand-deep py-3.5 font-bold text-brand-deep-foreground transition-transform hover:scale-[1.02] disabled:opacity-60"
                >
                  {status === 'sending' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                  {t('booking.submit')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={next}
                  className="flex flex-1 items-center justify-center gap-2 rounded-full bg-brand-deep py-3.5 font-bold text-brand-deep-foreground transition-transform hover:scale-[1.02]"
                >
                  {t('booking.next')} <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
