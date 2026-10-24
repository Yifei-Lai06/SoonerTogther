// Prints which environment variables are set in .env.local — names only, never values.
import { existsSync, readFileSync } from "node:fs";

const vars = {};
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m) vars[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
} else {
  console.log(".env.local not found (copy .env.example to .env.local).");
}

const checks = [
  ["NEXT_PUBLIC_SUPABASE_URL", "required for cloud mode", (v) => v.startsWith("https://") && v.includes(".supabase.co")],
  ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "required for cloud mode (or NEXT_PUBLIC_SUPABASE_ANON_KEY)", (v) => v.length > 20],
  ["SUPABASE_SECRET_KEY", "required: matching, AI quota, account deletion (or SUPABASE_SERVICE_ROLE_KEY)", (v) => v.length > 20],
  ["SUPABASE_DB_URL", "only for `npm run db:migrate` on your laptop", (v) => v.startsWith("postgres")],
  ["DEEPSEEK_API_KEY", "optional: enables the AI assistant", (v) => v.length > 10],
  ["ADMIN_EMAILS", "optional: who can open /admin/feedback", (v) => v.includes("@")],
  ["RESEND_API_KEY", "optional: OU email verification codes", (v) => v.length > 10],
];
const alias = { NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "NEXT_PUBLIC_SUPABASE_ANON_KEY", SUPABASE_SECRET_KEY: "SUPABASE_SERVICE_ROLE_KEY" };

for (const [name, why, ok] of checks) {
  const value = vars[name] ?? (alias[name] ? vars[alias[name]] : undefined);
  const status = !value ? "missing" : ok(value) ? "set ✓" : "set, but looks wrong";
  console.log(`${status.padEnd(22)} ${name.padEnd(38)} ${why}`);
}
