// src/features/sampleCategory/types/adminBulkAction.ts
// サンプルカテゴリの管理一覧の一括操作の項目の型(dc:generate が生成する。手で編集しない)

import type { BulkActionItem } from "@/lib/tableSuite";
import type { SampleCategory } from "@/features/sampleCategory/entities";
import type { AdminBulkActionAccess } from "@/features/core/user/types";

/** src/features/sampleCategory/adminBulkActions/<名前>.tsx の export const bulkAction。作り方: src/lib/tableSuite/README.md「一括操作の受け口」 */
export type SampleCategoryAdminBulkActionItem = BulkActionItem<SampleCategory, AdminBulkActionAccess>;
