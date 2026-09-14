import { useEffect, useState, type ReactNode } from 'react'
import { PROFILE_MEDIA, profileInitials } from '@musimaps/shared'

function useMediaFailed(image?: string | null) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [image])
  return [failed, () => setFailed(true)] as const
}

export function AccountCover({ image, children }: { image?: string | null; children?: ReactNode }) {
  const [failed, fail] = useMediaFailed(image)
  return (
    <div data-testid="account-cover" className="relative w-full overflow-hidden bg-gradient-to-br from-brand-deep via-black to-black"
      style={{ backgroundImage: `linear-gradient(135deg, ${PROFILE_MEDIA.fallbackCoverColors.join(', ')})`, aspectRatio: PROFILE_MEDIA.coverAspect[0] / PROFILE_MEDIA.coverAspect[1], minHeight: PROFILE_MEDIA.coverMinHeight, maxHeight: PROFILE_MEDIA.coverMaxHeight }}>
      {image && !failed && <img key={image} src={image} alt="" onError={fail} className="absolute inset-0 h-full w-full object-cover object-center" />}
      {children}
    </div>
  )
}

export function AccountAvatar({ name, image, variant = 'profile' }: {
  name: string; image?: string | null; variant?: keyof typeof PROFILE_MEDIA.avatarSize
}) {
  const [failed, fail] = useMediaFailed(image)
  const size = PROFILE_MEDIA.avatarSize[variant]
  return (
    <div data-testid="account-avatar" className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border-surface bg-gradient-to-br from-brand-deep to-brand font-bold text-black"
      style={{ backgroundImage: `linear-gradient(135deg, ${PROFILE_MEDIA.fallbackAvatarColors.join(', ')})`, color: PROFILE_MEDIA.avatarTextColor, width: size, height: size, borderWidth: PROFILE_MEDIA.avatarBorder, fontSize: size * PROFILE_MEDIA.initialsScale }}>
      {image && !failed ? <img key={image} src={image} alt={name} onError={fail} className="h-full w-full object-cover object-center" />
        : <span aria-label={name}>{profileInitials(name)}</span>}
    </div>
  )
}
