// Parses an integer from a route param or query string value.
// Returns undefined when the value is absent, null when it's present but not an integer,
// so callers can tell "no filter" apart from "bad input" (Prisma throws on NaN).
export function parseIntParam(value: unknown): number | undefined | null {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !/^-?\d+$/.test(value)) return null;
  return Number(value);
}
