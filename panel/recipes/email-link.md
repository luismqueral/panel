# Recipe: email-link

Status: unverified. Written against `contracts.md`; the verification below has not been run. Say so to the person, and run it before calling the panel done.

## 1. When to use it

Editors without Google accounts, on a deployed panel. They type their address and get a one-time sign-in link. Only addresses on `allow` get a link. It fills the **auth** contract.

## 2. Prerequisites

- An email sending service with an HTTP API (for example Postmark, Resend, or SES), and its key in an environment variable such as `EMAIL_API_KEY`. Never in the schema or the repo.
- A sending address the service has verified.
- `SESSION_SECRET` (at least 32 random characters), and the project server.

## 3. Contract

Auth, as in `contracts.md`. `renderMethods()` renders a `field-text` (type email, label "Email address") and a primary `pn-button` "Email me a link" into `methods`. After sending, it replaces them with the text "Check your email for a sign-in link." `session()` and `logout()` work as in `google-login`.

## 4. Steps

1. Reuse `recipes/server/session.mjs` and `isAllowed` from `recipes/server/google.mjs` (exact addresses only; `*@domain` entries match by the address ending, because there is no `hd` claim; warn the person).
2. Add `POST /api/session/link` ← `{ email }`:
   - Always answer 204, whether or not the address is allowed, so the endpoint does not reveal who is.
   - If allowed: make a token of 32 random bytes, store only its SHA-256 hash with the address and an expiry of 15 minutes, and email `https://<origin>/api/session/link?token=<token>`.
   - Allow at most 5 requests per address per hour.
3. Add `GET /api/session/link?token=` : hash the token, find it, check expiry, delete it (one use), check `allow` again, set the session cookie, and redirect to `/`.
4. In the browser, `renderMethods` posts the address with `x-panel: 1`.

## 5. Verify

- [ ] An allowed address gets an email; the link signs in and opens Home.
- [ ] The same link a second time does not sign in.
- [ ] A link older than 15 minutes does not sign in.
- [ ] An address not on `allow` gets no email, and the page says the same thing as for an allowed one.
- [ ] The sixth request in an hour sends nothing.
- [ ] The cookie is `HttpOnly`, `SameSite=Lax`, and `Secure` on HTTPS.

## 6. Pitfalls

- Storing the raw token. Store its hash.
- Saying "this address isn't allowed" on the request form. It tells strangers who is.
- Links that work more than once, or never expire.
- Building the link from the request's `Host` header without checking it against the known origin.
- No rate limit: the form becomes a way to spam an address.
