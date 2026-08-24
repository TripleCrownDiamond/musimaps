/**
 * Parcours d'inscription en étapes.
 *
 * Le risque d'un formulaire découpé, c'est de laisser passer un champ : soit
 * en bloquant une étape sur un champ qu'elle ne contient pas, soit en
 * autorisant la soumission d'un brouillon incomplet. Les deux sont couverts.
 */
import { describe, expect, it } from 'vitest';
import {
  SIGNUP_STEPS,
  firstIncompleteStep,
  isSignupStepComplete,
  signupProgress,
  validateSignup,
  validateSignupStep,
  type SignupDraft,
} from './signup';

/** Brouillon complet et valide, dégradé au cas par cas. */
const full: SignupDraft = {
  role: 'melomane',
  name: 'Awa Diop',
  city: 'Dakar',
  country: 'SN',
  email: 'awa@example.com',
  password: 'motdepasse1',
  confirm: 'motdepasse1',
};

const without = (patch: Partial<SignupDraft>): SignupDraft => ({ ...full, ...patch });

describe('découpage', () => {
  it('compte trois étapes, dans un ordre stable', () => {
    expect(SIGNUP_STEPS).toEqual(['role', 'identity', 'credentials']);
  });

  it('rend une progression croissante jusqu’à 1', () => {
    const values = SIGNUP_STEPS.map(signupProgress);
    expect(values[values.length - 1]).toBe(1);
    expect([...values].sort((a, b) => a - b)).toEqual(values);
  });
});

describe('validateSignupStep', () => {
  it('valide un brouillon complet à chaque étape', () => {
    for (const step of SIGNUP_STEPS) expect(validateSignupStep(step, full)).toBeNull();
  });

  it('exige un rôle à la première étape', () => {
    expect(validateSignupStep('role', without({ role: null }))).toBe('auth.missingRole');
  });

  it('signale le premier champ manquant de l’identité, dans l’ordre', () => {
    expect(validateSignupStep('identity', without({ name: '  ' }))).toBe('auth.missingName');
    expect(validateSignupStep('identity', without({ city: '' }))).toBe('auth.missingCity');
    expect(validateSignupStep('identity', without({ country: '' }))).toBe('auth.missingCountry');
  });

  it('contrôle email, longueur et confirmation du mot de passe', () => {
    expect(validateSignupStep('credentials', without({ email: 'pas-une-adresse' }))).toBe(
      'auth.invalidEmail',
    );
    expect(
      validateSignupStep('credentials', without({ password: 'court', confirm: 'court' })),
    ).toBe('auth.passwordShort');
    expect(validateSignupStep('credentials', without({ confirm: 'autre-chose' }))).toBe(
      'auth.passwordMismatch',
    );
  });

  // Le piège du multi-étapes : bloquer une étape sur un champ d'une AUTRE.
  it('ne bloque jamais une étape sur un champ qu’elle ne contient pas', () => {
    const noCredentials = without({ email: '', password: '', confirm: '' });
    expect(validateSignupStep('role', noCredentials)).toBeNull();
    expect(validateSignupStep('identity', noCredentials)).toBeNull();

    const noIdentity = without({ name: '', city: '', country: '' });
    expect(validateSignupStep('role', noIdentity)).toBeNull();
    expect(validateSignupStep('credentials', noIdentity)).toBeNull();
  });
});

describe('validateSignup', () => {
  it('accepte un brouillon complet', () => {
    expect(validateSignup(full)).toBeNull();
  });

  it('rend la première erreur dans l’ordre des étapes', () => {
    // Rôle ET email manquants : c'est le rôle qui doit remonter, il vient avant.
    expect(validateSignup(without({ role: null, email: '' }))).toBe('auth.missingRole');
  });

  it('refuse un brouillon incomplet même si la navigation a été contournée', () => {
    expect(validateSignup(without({ password: '', confirm: '' }))).toBe('auth.passwordShort');
  });
});

describe('firstIncompleteStep', () => {
  it('ouvre sur la première étape à remplir', () => {
    expect(firstIncompleteStep({ ...full, role: null })).toBe('role');
    expect(firstIncompleteStep({ ...full, city: '' })).toBe('identity');
    expect(firstIncompleteStep({ ...full, email: '' })).toBe('credentials');
  });

  it('reste sur la dernière étape quand tout est rempli', () => {
    // Un brouillon complet ne renvoie pas l'utilisateur au début : il soumet.
    expect(firstIncompleteStep(full)).toBe('credentials');
  });
});

describe('isSignupStepComplete', () => {
  it('reflète exactement l’absence d’erreur', () => {
    expect(isSignupStepComplete('role', full)).toBe(true);
    expect(isSignupStepComplete('role', without({ role: null }))).toBe(false);
  });
});
