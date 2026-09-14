import { describe, expect, it } from 'vitest';
import { cameraArrival } from './index';

const godomey = { center: [2.3521983, 6.3703], zoom: 13 };

describe('cameraArrival', () => {
  it('flags a flight that reached its zoom on the equator', () => {
    // Trace réelle : vol parti du globe, immobilisé à [2.352, 0] au zoom 13.
    expect(cameraArrival({ center: [2.3521983, 0], zoom: 13 }, godomey)).toEqual({
      zoomReached: true,
      centerReached: false,
    });
  });

  it('accepts a camera that reached both zoom and center', () => {
    expect(cameraArrival({ center: [2.3521982999999977, 6.370300000000001], zoom: 13.02 }, godomey)).toEqual({
      zoomReached: true,
      centerReached: true,
    });
  });

  it('keeps waiting while the zoom is still moving', () => {
    expect(cameraArrival({ center: [2.4, 0], zoom: 0.96 }, godomey).zoomReached).toBe(false);
  });

  it('compares longitudes across the antimeridian', () => {
    expect(cameraArrival({ center: [-179.999, 10], zoom: 5 }, { center: [179.999, 10], zoom: 5 }).centerReached).toBe(true);
  });

  it('treats a target without center as a zoom-only move', () => {
    expect(cameraArrival({ center: [10, 10], zoom: 5 }, { zoom: 5 })).toEqual({ zoomReached: true, centerReached: true });
  });
});
