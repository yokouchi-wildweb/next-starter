// src/features/core/taskRun/services/server/drizzleBase.ts
// 登録表(serviceRegistry)に載せる CRUD ベース。記録の読み書きは taskRunService の関数が行う(条件付きの更新が要るため)。

import { TaskRunTable } from "@/features/core/taskRun/entities/drizzle";
import { TaskRunCreateSchema, TaskRunUpdateSchema, type TaskRunWriteInput } from "@/features/core/taskRun/entities/schema";
import { createCrudService } from "@/lib/crud/drizzle";
import type { DrizzleCrudServiceOptions } from "@/lib/crud/drizzle/types";

const taskRunOptions: DrizzleCrudServiceOptions<TaskRunWriteInput> = {
  idType: "uuid",
  defaultOrderBy: [["startedAt", "DESC"]],
  parseCreate: (data) => TaskRunCreateSchema.parse(data),
  parseUpdate: (data) => TaskRunUpdateSchema.parse(data),
};

export const taskRunBase = createCrudService(TaskRunTable, taskRunOptions);
