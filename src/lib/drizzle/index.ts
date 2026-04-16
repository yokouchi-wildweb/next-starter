// src/lib/drizzle/index.ts

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from '@/registry/schemaRegistry';

const globalForDb = globalThis as unknown as {
  queryClient: ReturnType<typeof postgres> | undefined;
};

const queryClient = globalForDb.queryClient ?? postgres(process.env.DATABASE_URL!, { prepare: false, max: 3 });

if (process.env.NODE_ENV !== "production") {
  globalForDb.queryClient = queryClient;
}

export const db = drizzle(queryClient, { schema });
