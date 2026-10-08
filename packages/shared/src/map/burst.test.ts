import { describe, expect, it } from 'vitest'
import type { Artist } from '../index'
import { PIN_BURST, burstClusterFrame, burstFrame, burstOrigins, declump, lerpCoordinate, PIN_LAYOUT_ZOOM, shouldHoldSpread } from './index'

const artist = (id: string, name: string, coordinates: [number, number]) =>
  ({ id, name, coordinates, city: 'Cotonou', country: 'BJ', flag: '🇧🇯' }) as unknown as Artist

describe('éclatement des groupes en pins', () => {
  it('retient le passage aux pins tant que la caméra bouge, jamais le regroupement', () => {
    expect(shouldHoldSpread('sub', 'spread')).toBe(true)
    expect(shouldHoldSpread('city', 'spread')).toBe(true)
    expect(shouldHoldSpread('spread', 'spread')).toBe(false)
    expect(shouldHoldSpread('spread', 'sub')).toBe(false)
    expect(shouldHoldSpread('country', 'city')).toBe(false)
  })

  it('fait partir chaque pin de la pastille de son groupe, pas les artistes seuls', () => {
    const stacked = [artist('b', 'Zeynab', [2.4401, 6.3734]), artist('a', 'Angélique Kidjo', [2.4401, 6.3734]), artist('c', 'Vano Baby', [2.4402, 6.3733])]
    const alone = artist('d', 'Seul', [3.39, 6.45])
    const { origins, clusters } = burstOrigins([...stacked, alone])
    expect(clusters).toHaveLength(1)
    expect(clusters[0].count).toBe(3)
    expect(origins.has('d')).toBe(false)
    // Ordre alphabétique, comme la pastille du niveau sub.
    expect(origins.get('a')?.index).toBe(0)
    expect(origins.get('c')?.index).toBe(1)
    expect(origins.get('b')?.index).toBe(2)
    for (const id of ['a', 'b', 'c']) expect(origins.get(id)?.from).toEqual(clusters[0].coordinates)
    // Les pins finissent bien à leur place en spirale.
    const spread = declump([...stacked, alone], PIN_LAYOUT_ZOOM)
    const end = lerpCoordinate(origins.get('a')!.from, spread.get('a')!, burstFrame(10_000, 0).travel)
    expect(end[0]).toBeCloseTo(spread.get('a')![0], 9)
    expect(end[1]).toBeCloseTo(spread.get('a')![1], 9)
  })

  it('part de la pastille, sort en cascade et se pose', () => {
    expect(burstFrame(0, 0).travel).toBe(0)
    expect(burstFrame(0, 0).opacity).toBe(0)
    expect(burstFrame(PIN_BURST.durationMs, 0)).toMatchObject({ travel: 1, scale: 1, opacity: 1, done: true })
    // Le 10e pin attend son tour.
    expect(burstFrame(PIN_BURST.staggerMs * 5, 10).travel).toBe(0)
    // La cascade est plafonnée : même le 500e pin a fini à temps.
    expect(burstFrame(PIN_BURST.durationMs + PIN_BURST.maxStaggerMs, 500).done).toBe(true)
    // Léger dépassement avant de se poser.
    const mid = Array.from({ length: 50 }, (_, i) => burstFrame((i / 50) * PIN_BURST.durationMs, 0).travel)
    expect(Math.max(...mid)).toBeGreaterThan(1)
  })

  it('efface la pastille', () => {
    expect(burstClusterFrame(0)).toMatchObject({ scale: 1, opacity: 1, done: false })
    expect(burstClusterFrame(PIN_BURST.clusterFadeMs)).toMatchObject({ scale: 0, opacity: 0, done: true })
  })
})
