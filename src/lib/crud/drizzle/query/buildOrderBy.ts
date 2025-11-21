import { asc, desc, SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import type { OrderBySpec } from "@/lib/crud/types";

export const buildOrderBy = (table: PgTable, spec?: OrderBySpec): SQL[] => {
  if (!spec || spec.length === 0) return [];
  return spec.map(([field, dir]) =>
    dir === "ASC" ? asc((table as any)[field]) : desc((table as any)[field]),
  );
};
