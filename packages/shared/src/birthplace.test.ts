import { describe, expect, it } from 'vitest'
import { distinctBirthplace } from './index'

describe('distinctBirthplace', () => {
  it('renvoie la naissance quand elle diffère de la ville du pin', () => {
    expect(distinctBirthplace({ birthplace: 'Kano', city: 'Cotonou' })).toBe('Kano')
  })

  it('masque la naissance identique à la ville du pin', () => {
    expect(distinctBirthplace({ birthplace: 'Cotonou', city: 'Cotonou' })).toBeNull()
  })

  it('ignore la casse et les accents', () => {
    expect(distinctBirthplace({ birthplace: 'Covè', city: 'cove' })).toBeNull()
  })

  it('renvoie null sans naissance documentée (jamais de naissance inventée)', () => {
    expect(distinctBirthplace({ birthplace: '', city: 'Cotonou' })).toBeNull()
    expect(distinctBirthplace({ birthplace: '   ', city: 'Cotonou' })).toBeNull()
    expect(distinctBirthplace({ city: 'Cotonou' })).toBeNull()
    expect(distinctBirthplace({ birthplace: null, city: null })).toBeNull()
  })
})
