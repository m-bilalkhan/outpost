import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import { env } from "./env";

type Client = ReturnType<typeof postgres>;

declare global {
  // eslint-disable-next-line no-var
  var __outpostSql: Client | undefined;
}

function client(): Client {
  if (!globalThis.__outpostSql) {
    // Supabase's transaction pooler (port 6543) does not support prepared
    // statements. `prepare: false` keeps this working on either pooler.
    globalThis.__outpostSql = postgres(env.databaseUrl, {
      prepare: false,
      max: 3,
      idle_timeout: 20,
    });
  }
  return globalThis.__outpostSql;
}

/**
 * Lazy on purpose. `next build` imports every route module to collect its
 * config, so a client built at module scope would demand DATABASE_URL at
 * build time -- which is how a deploy fails before it has run a single line.
 */
export const sql = new Proxy(function () {} as unknown as Client, {
  apply(_t, _thisArg, args: unknown[]) {
    return (client() as unknown as (...a: unknown[]) => unknown)(...args);
  },
  get(_t, prop) {
    const c = client() as unknown as Record<string | symbol, unknown>;
    const value = c[prop];
    return typeof value === "function" ? value.bind(c) : value;
  },
}) as Client;

let cachedDb: ReturnType<typeof drizzle> | undefined;

/** Typed query builder, for when raw SQL stops being the clearest option. */
export function getDb() {
  cachedDb ??= drizzle(client(), { schema });
  return cachedDb;
}
