import { customAlphabet, nanoid } from "nanoid";

/**
 * Default id generator — URL-safe, 21 chars, ~149 bits of entropy.
 * Use directly for entity ids, message ids, etc.
 */
export { nanoid };

/**
 * Numeric-only id generator (12 digits). Use when an id must round-trip
 * through systems that reject non-numeric chars (legacy backends, some
 * spreadsheet exports).
 */
export const numericId = customAlphabet("0123456789", 12);

/**
 * Short id generator (8 chars). Use for human-visible labels where the
 * full 21-char nanoid is overkill.
 */
export const shortId = customAlphabet("0123456789ABCDEFGHJKMNPQRSTVWXYZ", 8);
