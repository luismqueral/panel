# Recipe: supabase

Status: unverified. Written against `contracts.md`; the verification below has not been run. Say so to the person, and run it before calling the panel done.

## 1. When to use it

The project already uses Supabase, or the person wants a hosted Postgres without running one. It fills the **data** contract.

## 2. Prerequisites

- A Supabase project. Its URL in the variable named by `url_env`, and its **service role** key in the variable named by `key_env`. Both on the server only.
- The project server. Supabase is reached from the server with `fetch` to its REST API; no client library.

## 3. Contract

Data, as in `contracts.md`, over the same two tables as `postgres.md` (create them in the Supabase SQL editor). Turn on row level security for both tables with no policies, so only the service role can reach them.

## 4. Steps

1. Write `server/supabase.mjs` exporting the same functions and checks as `recipes/server/json-files.mjs`.
2. Call `${url}/rest/v1/panel_items` with headers `apikey` and `Authorization: Bearer <key>`, and `Prefer: return=representation` on writes. Filter with `type=eq.<type>&id=eq.<id>`, URL-encoded.
3. Map 401 and 403 from Supabase to `unavailable` (a configuration problem, not the editor's), and log it.
4. Never send the service role key to the browser. The panel talks to the project server, which talks to Supabase.
5. **If** the person wants to use Supabase Auth for login: that is a separate auth recipe, not this one. Record it as an open question.

## 5. Verify

- [ ] Create, edit, publish, reload: the item is back, and the row matches in the Supabase table editor.
- [ ] Singletons persist. Delete removes the row.
- [ ] The service role key appears nowhere in the panel's files or network responses.
- [ ] With row level security on and no policies, the anon key cannot read the tables.

## 6. Pitfalls

- Using the anon key with permissive policies instead of the service role on the server.
- Calling Supabase from the browser.
- Forgetting to URL-encode filter values.
