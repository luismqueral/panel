// Contract error codes (recipes/contracts.md) and their HTTP statuses.

export const STATUS = { unauthorized: 401, forbidden: 403, "not-found": 404, invalid: 400, conflict: 409, "too-large": 413, unavailable: 503 };

export function fail(code, message) {
  return Object.assign(new Error(message), { code });
}
