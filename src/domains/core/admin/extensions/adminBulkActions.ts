// 生成物・編集不可: pnpm generate extensions が src/domains/core/admin/extensionPoints.ts から生成する
// adminBulkActions: 差す側の <ドメイン>/plugs/adminBulkActions/<名前>.ts(x) か <名前>/index.ts(x)(lib は <lib>/plugs/…)の export const bulkAction(並びは<差す側>/<名前> の順、使う時に gate.plugs で閉じたドメインの項目を外す。隣の <名前>.override.ts の enabled・order を重ねる)

import type { AdminBulkActionItem } from "@/domains/core/admin/types/adminBulkAction";

import { bulkAction as adminBulkActions_bankTransferReview_sendEmail } from "@/domains/core/bankTransferReview/plugs/adminBulkActions/sendEmail";
import { bulkAction as adminBulkActions_messaging_delete } from "@/domains/core/messaging/plugs/adminBulkActions/delete";
import { bulkAction as adminBulkActions_user_userGroupAdd } from "@/domains/core/user/plugs/adminBulkActions/userGroupAdd";
import { bulkAction as adminBulkActions_user_userGroupCreate } from "@/domains/core/user/plugs/adminBulkActions/userGroupCreate";
import { bulkAction as adminBulkActions_user_userTags } from "@/domains/core/user/plugs/adminBulkActions/userTags";

export const adminBulkActions: { domain: string | null; name: string; requires: readonly string[]; plug: AdminBulkActionItem }[] = [
  { domain: "bankTransferReview", name: "sendEmail", requires: [], plug: adminBulkActions_bankTransferReview_sendEmail },
  { domain: "messaging", name: "delete", requires: [], plug: adminBulkActions_messaging_delete },
  { domain: "user", name: "userGroupAdd", requires: [], plug: adminBulkActions_user_userGroupAdd },
  { domain: "user", name: "userGroupCreate", requires: [], plug: adminBulkActions_user_userGroupCreate },
  { domain: "user", name: "userTags", requires: [], plug: adminBulkActions_user_userTags },
];
