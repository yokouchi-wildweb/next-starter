// src/features/sample/services/server/sampleService.ts

import { base } from "./drizzleBase";
import { duplicate } from "./wrappers/duplicate";

// 削除系（remove / bulkDeleteByIds / bulkDeleteByQuery / hardDelete）は drizzleBase が
// createCrudService に storageCleanupFields を渡すことで、物理削除時の Storage クリーンアップを
// base 側で自動的に行う。duplicate のみファイル複製が必要なためラッパーで上書きする。
export const sampleService = {
  ...base,
  duplicate,
};
