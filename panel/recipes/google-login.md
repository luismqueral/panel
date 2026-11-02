# Recipe: google-login

Status: verified (`evals/recipes/`; the Google side by the manual checklist below).

## 1. When to use it

The panel is reachable over a network and its editors have Google accounts. Only addresses on the `allow` list get in. It fills the **auth** contract. It replaces `none` the moment a panel leaves one computer.

Don't use it when editors have no Google account (use `email-link`), or when the host app already has login (use its host recipe).

## 2. Prerequisites

- A Google Cloud project, and an **OAuth client ID** of type "Web application". No client secret is used.
- **Authorized JavaScript origins** on that client: every origin the panel is served from, for example `http://localhost:4810` and `https://example.com`. No redirect URIs.
- Environment variables on the server, never in the repo:
  - `GOOGLE_CLIENT_ID`: the client ID.
  - `SESSION_SECRET`: at least 32 random characters. Generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.
- The project server (`contracts.md`, "The project server").

## 3. Contract

Auth, as in `contracts.md`. `session()` returns `{ user }` from `GET /api/session`. `renderMethods()` renders Google's sign-in button into `screen-login`'s `methods` container. `logout()` calls `DELETE /api/session`.

## 4. Steps

1. Copy `recipes/server/` into the project (`server/`), and `recipes/client/http.js` and `recipes/client/auth.js` into the panel's `adapters/`. Do not rewrite them; they are owned code now, and the person may change them later.
2. Write the project's `start.mjs` (or the host's equivalent) that builds the auth block, exactly:

   ```js
   const clientId = process.env.GOOGLE_CLIENT_ID;
   if (!clientId) throw new Error("Set GOOGLE_CLIENT_ID");
   const keyFor = createKeyStore();
   const auth = {
     recipe: "google-login",
     allow: PANEL.auth.allow,
     clientId,
     sessions: createSessions(process.env.SESSION_SECRET),
     verify: (credential) => verifyGoogleToken(credential, { clientId, keyFor }),
   };
   ```

3. Put the schema's `allow` list into `panel.config.js` as `auth.allow`, unchanged.
4. In `panel.js`, use `createGoogleAuth(request)` when not in `?test` mode.
5. **If** the person wants a whole Google Workspace domain, the entry is `*@domain.com`. `isAllowed` also requires Google's `hd` claim to equal the domain. Do not loosen this.
6. **If** the person wants roles (some editors can only edit drafts): stop. Roles are out of scope (Appendix L). Record it as an open question.
7. **If** the panel is behind a proxy that ends TLS, make sure it sends `X-Forwarded-Proto: https`, so cookies get `Secure`.
8. Run the server on `127.0.0.1` while developing. Deploying is the person's decision; say what changes (HOST, origins, HTTPS).

## 5. Verify

Automated, in this repository (`npm run test:recipes`): token signature, issuer, audience, expiry, `email_verified`, the allow list (exact, any case, `*@domain` with `hd`), forged and expired cookies, the `x-panel` header, revocation when an address leaves the list, logout, and the login screen when a session ends mid-use.

By hand, once per project, with real Google credentials. Tick each:

- [ ] `GOOGLE_CLIENT_ID` and `SESSION_SECRET` are set in the environment, not in any file in the repo.
- [ ] Opening the panel shows the login screen with Google's button.
- [ ] Signing in with an address on `allow` opens Home, and the account shows in the nav.
- [ ] Signing in with an address not on `allow` shows "This account isn't allowed. Sign in with another one." and does not open the panel.
- [ ] In the browser's dev tools, the `pn_session` cookie is `HttpOnly`, `SameSite=Lax`, and, on HTTPS, `Secure`. No token is in `localStorage`.
- [ ] Create an item, refresh: it is still there.
- [ ] Log out: the login screen returns, and `GET /api/session` answers 401.
- [ ] Remove your address from `allow`, restart the server, reload: you are signed out.

The panel is not done until every box is ticked.

## 6. Pitfalls

- Deciding who is signed in in the browser. The server verifies the token; the browser only passes it on.
- Accepting a token without checking `aud`. Any site's Google token would then work on this panel.
- Trusting `email` without `email_verified: true`.
- Matching `*@domain` by the email's ending alone, without `hd`.
- Accepting `alg: none` or `HS256`. Only `RS256` with Google's published keys.
- Fetching Google's keys on every request, or caching them forever. Cache for the `max-age` Google sends.
- Storing the ID token or a session in `localStorage`. Use the `HttpOnly` cookie.
- Checking the allow list only at sign-in. Check it on every request, so removing an address takes effect.
- Forgetting `x-panel: 1` on writes, or accepting writes without it.
- Committing `SESSION_SECRET`, or using a short one. The server refuses to start with fewer than 32 characters.
- Listening on `0.0.0.0` during development.
- `?test` mode in production: it only ever shows memory data and never reaches the real adapters, but do not link to it.
