// src/domains/core/admin/types/adminBulkAction.ts
// 管理の一覧の一括操作の点 adminBulkActions(core/admin の 1 点、宣言 ../extensionPoints.ts)の約束の型。
// 項目は差す側のドメインの <ドメイン>/plugs/adminBulkActions/<名前>.tsx で、そのドメインの一覧に効く。行の型はドメインごとなので
// 一覧の型は行を問わない(各ドメインは自分の <Domain>AdminBulkActionItem で satisfies し、読み手 useDomainAdminBulkActions が戻す)

import type { BulkActionItem } from "@/lib/tableSuite";
import type { AdminBulkActionAccess } from "@/domains/core/user/types";

// 行は any: 項目の部品は自分のドメインの行の props を受けるので(unknown にすると部品が代入できない)
export type AdminBulkActionItem = BulkActionItem<any, AdminBulkActionAccess>;
