// src/features/core/taskRun/entities/model.ts

import type { TaskRunKind, TaskRunStatus } from "@/features/core/taskRun/constants";

/** task_runs の 1 行 */
export type TaskRun = {
  id: string;
  name: string;
  kind: TaskRunKind;
  args: string[];
  dryRun: boolean;
  status: TaskRunStatus;
  stopKeys: string[];
  result: unknown;
  error: string | null;
  gitSha: string | null;
  gitDirty: boolean | null;
  actor: string;
  stage: string;
  dbTarget: string | null;
  fileHash: string | null;
  startedAt: Date;
  finishedAt: Date | null;
  resolvedAt: Date | null;
};

/** 走る前に書く行(id・status・時刻は書き手が決める) */
export type TaskRunStartInput = Pick<
  TaskRun,
  "name" | "kind" | "args" | "dryRun" | "stopKeys" | "gitSha" | "gitDirty" | "actor" | "stage" | "dbTarget" | "fileHash"
>;

/** 終わりに書く結果 */
export type TaskRunFinishInput = {
  status: Exclude<TaskRunStatus, "running">;
  result?: unknown;
  error?: string | null;
};
