// src/domains/core/batchJob/entities/batchJobItem/drizzle.ts

import { BatchJobTable } from "../batchJob/drizzle";
import { BATCH_JOB_ITEM_STATUSES } from "@/domains/batchJob/types";
import { index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const BatchJobItemStatusEnum = pgEnum("batch_job_item_status", BATCH_JOB_ITEM_STATUSES);
// --- batch_job_items ---

export const BatchJobItemTable = pgTable(
  "batch_job_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    job_id: uuid("job_id")
      .notNull()
      .references(() => BatchJobTable.id, { onDelete: "cascade" }),
    item_key: text("item_key").notNull(),
    status: BatchJobItemStatusEnum("status").notNull().default("pending"),
    retry_count: integer("retry_count").notNull().default(0),
    error_message: text("error_message"),
    processed_at: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    jobIdItemKeyUnique: uniqueIndex("batch_job_items_job_id_item_key_idx").on(table.job_id, table.item_key),
    jobIdStatusIdx: index("batch_job_items_job_id_status_idx").on(table.job_id, table.status),
  }),
);
