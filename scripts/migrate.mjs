// Applies supabase/migrations/*.sql to your Supabase database, in order, once each.
// Reads SUPABASE_DB_URL from .env.local. Never prints the URL or password.
//   npm run db:migrate            apply pending migrations

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

function loadEnv() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

loadEnv();
const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("SUPABASE_DB_URL is missing from .env.local — see SETUP_GUIDE.md, step 3.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
const dir = join(import.meta.dirname, "..", "supabase", "migrations");

try {
  await client.connect();
  await client.query(`create schema if not exists private;
    create table if not exists private.schema_migrations (name text primary key, applied_at timestamptz default now())`);
  const done = new Set((await client.query("select name from private.schema_migrations")).rows.map((r) => r.name));
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  let applied = 0;
  for (const file of files) {
    if (done.has(file)) continue;
    process.stdout.write(`Applying ${file} … `);
    await client.query("begin");
    try {
      await client.query(readFileSync(join(dir, file), "utf8"));
      await client.query("insert into private.schema_migrations (name) values ($1)", [file]);
      await client.query("commit");
      console.log("ok");
      applied++;
    } catch (e) {
      await client.query("rollback");
      console.log("FAILED");
      throw e;
    }
  }
  console.log(applied ? `Done: ${applied} migration(s) applied.` : "Database is already up to date.");
} catch (e) {
  // Message only (no connection string).
  console.error("Migration error:", e.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
