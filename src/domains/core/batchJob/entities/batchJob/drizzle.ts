// src/domains/core/batchJob/entities/batchJob/drizzle.ts

import { BATCH_JOB_STATUSES } from "@/domains/batchJob/types";
import { integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

// --- Enum ---

export const BatchJobStatusEnum = pgEnum("batch_job_status", BATCH_JOB_STATUSES);
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
