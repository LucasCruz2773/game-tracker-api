import { randomInt } from 'node:crypto';

const BASE_MAX_LENGTH = 24;
const FALLBACK_USERNAME = 'player';

/**
 * Builds a username such as "lucas_fernandes" from a display name.
 * The email is deliberately not used as a source, since usernames are public.
 */
export function toUsernameBase(displayName: string | null): string {
  const base = (displayName ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .slice(0, BASE_MAX_LENGTH)
    .replace(/^_+|_+$/g, '');

  return base.length >= 3 ? base : FALLBACK_USERNAME;
}

/** Appends a 4-digit suffix; the result stays within the 30-character limit. */
export function withRandomSuffix(base: string): string {
  return `${base}_${randomInt(1000, 10000)}`;
}
