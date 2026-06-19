// src/features/__domain__/services/server/__domain__Service.ts

import { base } from "./__serviceBase__";
import { duplicate } from "./wrappers/duplicate";

// 削除系（remove / bulkDeleteByIds / bulkDeleteByQuery / hardDelete）は drizzleBase が
// createCrudService に storageCleanupFields を渡すことで、物理削除時の Storage クリーンアップを
// base 側で自動的に行う。duplicate のみファイル複製が必要なためラッパーで上書きする。
export const __domain__Service = {
  ...base,
  duplicate,
};
