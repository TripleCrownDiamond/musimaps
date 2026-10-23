import { describe, expect, it } from 'vitest'
import { parseAuthCallbackUrl, profileGaps, type UserProfile } from './auth'

describe('parseAuthCallbackUrl', () => {
  it('lit le code PKCE dans la query', () => {
    expect(parseAuthCallbackUrl('musimaps://login?code=abc123').code).toBe('abc123')
  })

  it('lit les jetons du flux implicite dans le fragment', () => {
    const params = parseAuthCallbackUrl('musimaps://login#access_token=a.b.c&refresh_token=r1&type=signup')
    expect(params.access_token).toBe('a.b.c')
    expect(params.refresh_token).toBe('r1')
  })

  it('décode les erreurs renvoyées par le fournisseur', () => {
    const params = parseAuthCallbackUrl('https://musimaps.com/login?error=access_denied&error_description=User+cancelled')
    expect(params.error).toBe('access_denied')
    expect(params.error_description).toBe('User cancelled')
  })
})

describe('profileGaps', () => {
  const complete: UserProfile = {
    id: 'u1',
    email: 'a@b.co',
    displayName: 'Awa',
    city: 'Cotonou',
    district: null,
    country: 'BJ',
    role: 'melomane',
    avatarUrl: null,
  }

  it('ne réclame rien à un profil complet', () => {
    expect(profileGaps(complete)).toEqual([])
    expect(profileGaps({ ...complete, roleConfirmed: true })).toEqual([])
  })

  it('réclame rôle, nom et lieu après une connexion Google', () => {
    expect(profileGaps({ ...complete, roleConfirmed: false, displayName: null, city: null })).toEqual([
      'role',
      'name',
      'location',
    ])
  })

  it('réclame le pays manquant même avec une ville', () => {
    expect(profileGaps({ ...complete, country: '' })).toEqual(['location'])
  })
})
