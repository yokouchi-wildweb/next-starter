// src/features/core/taskRun/entities/schema.ts

import { z } from "zod";

import { TASK_RUN_KINDS, TASK_RUN_STATUSES } from "@/features/core/taskRun/constants";

/** CRUD ベース(drizzleBase)の create。行を書くのは taskRunService.startRun だけ */
export const TaskRunCreateSchema = z.object({
  name: z.string().trim().min(1),
  kind: z.enum(TASK_RUN_KINDS),
  args: z.array(z.string()),
  dryRun: z.boolean(),
  status: z.enum(TASK_RUN_STATUSES),
  stopKeys: z.array(z.string().min(1)),
  gitSha: z.string().nullable(),
  gitDirty: z.boolean().nullable(),
  actor: z.string().min(1),
  stage: z.string().min(1),
  dbTarget: z.string().nullable(),
  fileHash: z.string().nullable(),
  source: z.string().nullable().optional(),
});

/** CRUD ベースの update。結果を書くのは taskRunService.finishRun / resolveRun だけ */
export const TaskRunUpdateSchema = z.object({
  status: z.enum(TASK_RUN_STATUSES).optional(),
  result: z.unknown().optional(),
  error: z.string().nullable().optional(),
  finishedAt: z.date().nullable().optional(),
  resolvedAt: z.date().nullable().optional(),
});

export type TaskRunWriteInput = z.infer<typeof TaskRunCreateSchema>;
