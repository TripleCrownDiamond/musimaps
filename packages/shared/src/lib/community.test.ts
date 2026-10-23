import { describe, expect, it } from 'vitest'
import { HANDLE_MAX, isValidHandle, normalizeHandle, suggestHandle } from './community'
import { notificationDestination } from './notifications'
import { collectionPath, profilePath, profileUrl } from './urls'

describe('normalizeHandle', () => {
  it('passe un nom affiché en identifiant valide', () => {
    expect(normalizeHandle('Awa Dossou')).toBe('awa.dossou')
    expect(normalizeHandle('@Zoé_Kouassi!!')).toBe('zoe_kouassi')
    expect(normalizeHandle('  ..Kofi--Mensah..  ')).toBe('kofi-mensah')
  })

  it('respecte la longueur maximale sans finir par une ponctuation', () => {
    const handle = normalizeHandle('a'.repeat(29) + '.bcd')
    expect(handle.length).toBeLessThanOrEqual(HANDLE_MAX)
    expect(isValidHandle(handle)).toBe(true)
  })
})

describe('isValidHandle', () => {
  it('suit la contrainte SQL profiles_handle_format', () => {
    expect(isValidHandle('awa')).toBe(true)
    expect(isValidHandle('ab')).toBe(false)
    expect(isValidHandle('Awa')).toBe(false)
    expect(isValidHandle('awa.')).toBe(false)
    expect(isValidHandle('.awa')).toBe(false)
  })
})

describe('suggestHandle', () => {
  it('complète un nom trop court ou vide', () => {
    expect(suggestHandle('Awa')).toBe('awa')
    expect(isValidHandle(suggestHandle('A'))).toBe(true)
    expect(isValidHandle(suggestHandle(''))).toBe(true)
  })
})

describe('liens communautaires', () => {
  it('construit les chemins publics', () => {
    expect(profilePath('awa.dossou')).toBe('/m/awa.dossou')
    expect(collectionPath('c1')).toBe('/selection/c1')
    expect(profileUrl('awa', 'en')).toBe('https://musimaps.com/en/m/awa')
  })

  it('route les notifications communautaires', () => {
    expect(notificationDestination({ type: 'follow', artist_id: null, ref: 'profile:awa' })).toEqual({ kind: 'profile', handle: 'awa' })
    expect(notificationDestination({ type: 'like', artist_id: null, ref: 'collection:c1:u2' })).toEqual({ kind: 'collection', collectionId: 'c1' })
    expect(notificationDestination({ type: 'collection', artist_id: null, ref: 'collection:c1' })).toEqual({ kind: 'collection', collectionId: 'c1' })
    expect(notificationDestination({ type: 'follow', artist_id: null, ref: 'follower:u9' })).toEqual({ kind: 'globe' })
  })
})
