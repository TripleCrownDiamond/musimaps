/**
 * Découpage et validation du parcours d'inscription.
 *
 * L'inscription demande sept informations : rôle, nom, ville, pays, email,
 * mot de passe et sa confirmation. Sur un téléphone, tout afficher d'un coup
 * donne un mur de champs — et une erreur en bas de page pour un champ oublié
 * en haut. On regroupe donc par intention :
 *
 *   1. QUI vous êtes    — artiste ou mélomane ;
 *   2. OÙ vous êtes     — nom, ville, pays (ce qui vous place sur la carte) ;
 *   3. VOS ACCÈS        — email et mot de passe.
 *
 * L'ordre reprend exactement celui de la validation existante : un champ ne
 * peut pas bloquer une étape qu'il ne concerne pas.
 *
 * Ce module est pur — pas de traduction, pas de React. Il rend des CLÉS i18n,
 * que chaque plateforme affiche à sa façon. C'est ce qui permet au web et au
 * mobile de partager le même parcours sans partager de composant.
 */

import type { MessageKey } from '../i18n';

export type SignupStep = 'role' | 'identity' | 'credentials';

/** Ordre des étapes. La première est l'index 0. */
export const SIGNUP_STEPS: SignupStep[] = ['role', 'identity', 'credentials'];

/** Clé i18n du titre de chaque étape. */
export const SIGNUP_STEP_TITLES: Record<SignupStep, MessageKey> = {
  role: 'auth.role',
  identity: 'auth.stepIdentity',
  credentials: 'auth.stepCredentials',
};

export interface SignupDraft {
  role: string | null;
  name: string;
  city: string;
  country: string;
  email: string;
  password: string;
  confirm: string;
}

/**
 * Adresse email — même expression que celle utilisée jusqu'ici côté web.
 * Volontairement permissive : le vrai contrôle est l'email de confirmation.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Longueur minimale du mot de passe, alignée sur `auth.passwordShort`. */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * Première erreur bloquante d'une étape, sous forme de clé i18n.
 * Retourne `null` quand l'étape est complète.
 */
export function validateSignupStep(step: SignupStep, draft: SignupDraft): MessageKey | null {
  switch (step) {
    case 'role':
      return draft.role ? null : 'auth.missingRole';
    case 'identity':
      if (!draft.name.trim()) return 'auth.missingName';
      if (!draft.city.trim()) return 'auth.missingCity';
      if (!draft.country.trim()) return 'auth.missingCountry';
      return null;
    case 'credentials':
      if (!EMAIL_RE.test(draft.email.trim())) return 'auth.invalidEmail';
      if (draft.password.length < MIN_PASSWORD_LENGTH) return 'auth.passwordShort';
      if (draft.password !== draft.confirm) return 'auth.passwordMismatch';
      return null;
  }
}

/** Vrai si l'étape est complète et qu'on peut avancer. */
export function isSignupStepComplete(step: SignupStep, draft: SignupDraft): boolean {
  return validateSignupStep(step, draft) === null;
}

/**
 * Première erreur du parcours ENTIER, dans l'ordre des étapes.
 *
 * C'est le garde-fou de la soumission : il empêche d'envoyer un formulaire
 * incomplet même si l'utilisateur a contourné la navigation par étapes.
 */
export function validateSignup(draft: SignupDraft): MessageKey | null {
  for (const step of SIGNUP_STEPS) {
    const error = validateSignupStep(step, draft);
    if (error) return error;
  }
  return null;
}

/**
 * Première étape incomplète — celle sur laquelle ouvrir le formulaire.
 * Retourne la DERNIÈRE étape quand tout est rempli : il n'y a plus qu'à
 * soumettre, on ne renvoie pas l'utilisateur au début.
 */
export function firstIncompleteStep(draft: SignupDraft): SignupStep {
  return (
    SIGNUP_STEPS.find((step) => !isSignupStepComplete(step, draft)) ??
    SIGNUP_STEPS[SIGNUP_STEPS.length - 1]
  );
}

/** Progression de 0 à 1, pour une barre ou un compteur « 2 / 3 ». */
export function signupProgress(step: SignupStep): number {
  return (SIGNUP_STEPS.indexOf(step) + 1) / SIGNUP_STEPS.length;
}
