// Runs the real Supabase migrations inside PGlite (Postgres compiled to WASM) with a
// minimal stand-in for Supabase's `auth` schema and roles, so Row Level Security
// and the server-side functions can be tested on any laptop without Docker.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (
    id uuid primary key,
    email text,
    email_confirmed_at timestamptz,
    raw_user_meta_data jsonb default '{}'::jsonb
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
  create publication supabase_realtime;

  -- Minimal stand-in for Supabase Storage.
  create schema storage;
  create table storage.buckets (
    id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner uuid
  );
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:greatest(array_length(string_to_array(name, '/'), 1) - 1, 0)]
  $$;
  grant usage on schema storage to anon, authenticated, service_role;
  grant select, insert, update, delete on storage.objects to authenticated;
`;

export type Db = PGlite;

export async function createDb(): Promise<Db> {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  const dir = join(import.meta.dirname, "..", "..", "supabase", "migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(dir, file), "utf8"));
  }
  // Mirrors Supabase: the service role can read and write everything.
  await db.exec(`
    grant all on all tables in schema public to service_role;
    grant usage on schema private to service_role;
    grant all on all tables in schema private to service_role;
  `);
  return db;
}

let n = 0;
export async function createUser(db: Db, opts: { name: string; email?: string; confirmed?: boolean }): Promise<string> {
  n++;
  const id = `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  await db.query(
    `insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values ($1, $2, $3, $4)`,
    [id, opts.email ?? `user${n}@example.com`, opts.confirmed === false ? null : new Date().toISOString(), JSON.stringify({ full_name: opts.name })],
  );
  return id;
}

/** Runs one statement as a signed-in user (role `authenticated`, auth.uid() = uid). */
export async function as<T = Record<string, unknown>>(db: Db, uid: string | null, sql: string, params: unknown[] = []) {
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid ?? ""]);
  await db.exec(uid ? "set role authenticated" : "set role anon");
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec("reset role");
  }
}

export async function asService<T = Record<string, unknown>>(db: Db, sql: string, params: unknown[] = []) {
  await db.exec("set role service_role");
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec("reset role");
  }
}

/** Resolves to the Postgres error message, or throws if the statement succeeded. */
export async function errorOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    return (e as Error).message;
  }
  throw new Error("expected the statement to fail, but it succeeded");
}
