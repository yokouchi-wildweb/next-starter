// src/domains/__domain__/services/server/__domain__Base.ts

import { createFirestoreCrudService } from "@/lib/crud/server";
import type { FirestoreCrudServiceOptions } from "@/lib/crud/server";
import type { __Domain__ } from "@/domains/__domain__/entities";
import { __Domain__CreateSchema, __Domain__UpdateSchema } from "@/domains/__domain__/entities/schema";

export const baseOptions = __serviceOptions__ satisfies FirestoreCrudServiceOptions;

// 互換性のためエイリアスもエクスポート
export const __domain__ServiceOptions = baseOptions;

export const __domain__Base = createFirestoreCrudService<__Domain__>("__domains__", {
  ...baseOptions,
  parseCreate: (data) => __Domain__CreateSchema.parse(data),
  parseUpdate: (data) => __Domain__UpdateSchema.parse(data),
  parseUpsert: (data) => __Domain__CreateSchema.parse(data),
});
