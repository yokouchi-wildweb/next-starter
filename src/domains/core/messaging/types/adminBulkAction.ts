// src/domains/core/messaging/types/adminBulkAction.ts
//
// 点 adminBulkActions(core/admin の 1 点。送信一覧の一括操作、D95)の messaging の項目の型。項目 = <ドメイン>/plugs/adminBulkActions/<名前>.tsx の export const bulkAction。
// 上流の既定 = 削除(delete.tsx)。fork は項目を足す・<名前>.override.ts で enabled・order を変える。作り方: src/lib/tableSuite/README.md「一括操作の受け口」

import type { BulkActionItem } from "@/lib/tableSuite";
import type { AdminBulkActionAccess } from "@/domains/core/user/types";

import type { AdminDispatchSummary } from "../services/client/adminMessagingClient";

export type MessagingDispatchAdminBulkActionItem = BulkActionItem<AdminDispatchSummary, AdminBulkActionAccess>;
