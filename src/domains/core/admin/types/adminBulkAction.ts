// src/domains/core/admin/types/adminBulkAction.ts
// 管理の一覧の一括操作の点 adminBulkActions(core/admin の 1 点、宣言 ../extensionPoints.ts)の約束の型。
// 項目は差す側のドメインの <ドメイン>/plugs/adminBulkActions/<名前>.tsx(D26: 差す側の自分のフォルダ)。効く一覧 = 項目の domain(省略 = 差したドメイン)。
// 行の型はドメインごとなので一覧の型は行を問わない(各ドメインは自分の <Domain>AdminBulkActionItem = AdminBulkActionItemOf<行> で satisfies し、
// 読み手 useDomainAdminBulkActions が戻す)

import type { BulkActionItem } from "@/lib/tableSuite";
import type { AdminBulkActionAccess } from "@/domains/core/user/types";

/**
 * 1 つの一覧の行の一括操作の項目。domain = 効く一覧のドメインのフォルダ名(src/domains/<名前> か src/domains/core/<名前> の <名前>)。
 * 省けば差したドメインの一覧。fork は上流のドメインの中に足さず、自分のドメインの plugs に置いて domain で上流の一覧を名指す
 */
export type AdminBulkActionItemOf<Row> = BulkActionItem<Row, AdminBulkActionAccess> & {
  domain?: string;
};

// 行は any: 項目の部品は自分のドメインの行の props を受けるので(unknown にすると部品が代入できない)
export type AdminBulkActionItem = AdminBulkActionItemOf<any>;
