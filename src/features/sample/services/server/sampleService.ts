// src/features/sample/services/server/sampleService.ts

import { base } from "./drizzleBase";
import { duplicate } from "./wrappers/duplicate";

export const sampleService = {
  ...base,
  // remove / bulkDeleteByIds / hardDelete 等の削除系は base が storageCleanupFields を
  // 受け取り Storage クリーンアップまで行うため、個別ラッパーは不要。
  duplicate,
};
