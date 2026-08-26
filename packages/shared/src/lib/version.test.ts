/**
 * Décision de mise à jour.
 *
 * Le risque couvert ici est asymétrique. Ne pas proposer une mise à jour est
 * un désagrément ; bloquer à tort une app installée est une panne totale pour
 * l'utilisateur, déclenchée à distance par une simple faute de frappe dans
 * l'admin. Les tests insistent donc sur ce qui ne doit JAMAIS bloquer.
 */
import { describe, expect, it } from 'vitest';
import { compareVersions, isValidVersion, updateRequirement } from './version';

describe('compareVersions', () => {
  it('ordonne les versions', () => {
    expect(compareVersions('1.0.0', '1.0.1')).toBeLessThan(0);
    expect(compareVersions('1.2.0', '1.10.0')).toBeLessThan(0); // pas un tri texte
    expect(compareVersions('2.0.0', '1.9.9')).toBeGreaterThan(0);
  });

  it('traite les segments manquants comme des zéros', () => {
    expect(compareVersions('1.2', '1.2.0')).toBe(0);
    expect(compareVersions('1', '1.0.0')).toBe(0);
    expect(compareVersions('1.2', '1.2.1')).toBeLessThan(0);
  });

  it('ignore un suffixe de pré-version', () => {
    expect(compareVersions('1.2.3-beta.1', '1.2.3')).toBe(0);
    expect(compareVersions('1.2.3+build7', '1.2.3')).toBe(0);
  });
});

describe('isValidVersion', () => {
  it('accepte les formes usuelles', () => {
    for (const v of ['1', '1.0', '1.0.0', '10.20.30', '1.2.3-beta']) {
      expect(isValidVersion(v), v).toBe(true);
    }
  });

  it('refuse ce qui n’est pas une version', () => {
    for (const v of ['', '  ', 'v1.0.0', 'latest', 'abc', '1.0.0.beta']) {
      expect(isValidVersion(v), v).toBe(false);
    }
  });
});

describe('updateRequirement', () => {
  it('ne propose rien quand l’app est à jour', () => {
    expect(updateRequirement({ current: '1.2.0', latest: '1.2.0' })).toBe('none');
    expect(updateRequirement({ current: '1.3.0', latest: '1.2.0' })).toBe('none');
  });

  it('invite quand une version plus récente existe', () => {
    expect(updateRequirement({ current: '1.2.0', latest: '1.3.0' })).toBe('optional');
  });

  it('exige en dessous de la version minimale', () => {
    expect(updateRequirement({ current: '1.0.0', minimum: '1.2.0', latest: '1.3.0' })).toBe(
      'required',
    );
  });

  it('le blocage prime sur l’invitation', () => {
    expect(updateRequirement({ current: '0.9.0', minimum: '1.0.0', latest: '2.0.0' })).toBe(
      'required',
    );
  });

  it('ne bloque pas quand la version installée atteint le minimum', () => {
    expect(updateRequirement({ current: '1.2.0', minimum: '1.2.0' })).toBe('none');
  });

  // ─── Ce qui ne doit JAMAIS bloquer ───────────────────────────────────────
  it('ne bloque pas sur un minimum mal saisi', () => {
    for (const minimum of ['', 'v2.0.0', 'bientôt', '2,0,0']) {
      expect(updateRequirement({ current: '1.0.0', minimum }), minimum).toBe('none');
    }
  });

  it('ne bloque pas quand le CMS ne renseigne rien', () => {
    expect(updateRequirement({ current: '1.0.0' })).toBe('none');
    expect(updateRequirement({ current: '1.0.0', latest: '', minimum: '' })).toBe('none');
  });

  it('ne bloque pas quand la version installée est illisible', () => {
    // Version locale absente (build de développement) : on laisse passer.
    expect(updateRequirement({ current: '', minimum: '99.0.0' })).toBe('none');
    expect(updateRequirement({ current: 'dev', minimum: '99.0.0' })).toBe('none');
  });

  it('ignore une dernière version invalide sans rien casser', () => {
    expect(updateRequirement({ current: '1.0.0', latest: 'à venir' })).toBe('none');
  });
});
