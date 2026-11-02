# Recipe: postgres

Status: unverified. Written against `contracts.md`; the verification below has not been run. Say so to the person, and run it before calling the panel done.

## 1. When to use it

Many items, several editors, or a project that already runs Postgres. It fills the **data** contract.

## 2. Prerequisites

- A Postgres 13+ database, and its connection string in the environment variable named by `url_env` (for example `DATABASE_URL`). Never the string itself in the schema.
- The project server. This recipe adds one dependency to the project's server: the `pg` package. Say so; it is the project's dependency, not Panel's.

## 3. Contract

Data, as in `contracts.md`. One table holds every type's items, and one holds singletons, in `schema` (default `public`):

```sql
create table if not exists panel_items (
  type        text not null,
  id          text not null,
  status      text,
  values      jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (type, id)
);
create table if not exists panel_singletons (
  id          text primary key,
  values      jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
```

## 4. Steps

1. Write `server/postgres.mjs` exporting `createPostgres({ url, schema, config })` with the same functions and checks as `recipes/server/json-files.mjs`: schema types only, schema field names only, valid statuses, ids from `randomBytes(5).toString("hex")`.
2. Use parameterized queries only (`$1`, `$2`). Map rows to items: `created_at` → `createdAt` as ISO strings.
3. `update` is one `update ... where type = $1 and id = $2 returning *`; no row → `not-found`.
4. Map connection errors to `unavailable`.
5. Run the `create table` statements once, from a `migrate` script the person runs; never on every start.
6. **If** the host app already has tables for this content: stop. Binding to existing tables is out of scope (Appendix E, known gap).

## 5. Verify

- [ ] Run the migration; both tables exist.
- [ ] Create, edit, publish, reload: the item is back, and the row matches.
- [ ] Singletons persist.
- [ ] Delete removes the row.
- [ ] Unknown types, fields, and statuses are refused with 400.
- [ ] Stop the database mid-save: the save bar shows its error.

## 6. Pitfalls

- Building SQL with string concatenation.
- Logging the connection string.
- One table per type, generated from the schema: every schema change becomes a migration. The `jsonb` column avoids it.
- Partial updates with `jsonb_set`. The contract replaces `values` whole.
