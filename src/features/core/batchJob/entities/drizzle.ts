// src/features/core/batchJob/entities/drizzle.ts

import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { BATCH_JOB_STATUSES, BATCH_JOB_ITEM_STATUSES } from "@/features/batchJob/types";

// --- Enum ---

export const BatchJobStatusEnum = pgEnum("batch_job_status", BATCH_JOB_STATUSES);
export const BatchJobItemStatusEnum = pgEnum("batch_job_item_status", BATCH_JOB_ITEM_STATUSES);

// --- batch_jobs ---

export const BatchJobTable = pgTable(
  "batch_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    job_type: text("job_type").notNull(),
    job_key: text("job_key").notNull(),
    status: BatchJobStatusEnum("status").notNull().default("pending"),
    total_count: integer("total_count").notNull(),
    processed_count: integer("processed_count").notNull().default(0),
    failed_count: integer("failed_count").notNull().default(0),
    skipped_count: integer("skipped_count").notNull().default(0),
    batch_size: integer("batch_size").notNull().default(100),
    max_retry_count: integer("max_retry_count").notNull().default(2),
    params: jsonb("params"),
    target_query: jsonb("target_query"),
    error_summary: text("error_summary"),
    started_at: timestamp("started_at", { withTimezone: true }),
    completed_at: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    jobTypeJobKeyUnique: uniqueIndex("batch_jobs_job_type_job_key_idx").on(table.job_type, table.job_key),
  }),
);

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
