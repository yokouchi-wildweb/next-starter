// src/features/sample/types/adminBulkAction.ts
// サンプルの管理一覧の一括操作の項目の型(dc:generate が生成する。手で編集しない)

import type { BulkActionItem } from "@/lib/tableSuite";
import type { Sample } from "@/features/sample/entities";
import type { AdminBulkActionAccess } from "@/features/core/user/types";

/** src/features/sample/adminBulkActions/<名前>.tsx の export const bulkAction。作り方: src/lib/tableSuite/README.md「一括操作の受け口」 */
export type SampleAdminBulkActionItem = BulkActionItem<Sample, AdminBulkActionAccess>;
