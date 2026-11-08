// src/features/core/couponAttributionReward/services/server/domainEntry.ts
// core ドメインの登録（手書き。core の domain.json は pnpm generate domain の対象外）。登録表 src/registry/serviceRegistry.ts は
// このファイルから pnpm generate registry が作る。fork が access を変えるときは隣に domainEntry.override.ts を置く（このファイルは編集しない）。
// access = 汎用 API（/api/<domain>/**）と管理データ操作（truncateAll / export / import）の認可。詳細: src/lib/domain/README.md

import type { DomainEntries } from "@/lib/domain/types";
import { ADMIN_DATA_OPERATIONS, ADMIN_ONLY } from "@/lib/domain/accessPresets";

export const domainEntries = {
  // クーポン帰属報酬台帳。付与は grant()（ハンドラー onRedeemed から tx 付き）のみ。
  // 本人の閲覧は /api/me/coupon-attribution-rewards。汎用 API は admin の一覧・検索・補正。
  couponAttributionReward: {
    service: () => import("./index").then((m) => m.couponAttributionRewardService),
    table: "coupon_attribution_rewards",
    idColumn: "id",
    access: { ...ADMIN_ONLY, operations: ADMIN_DATA_OPERATIONS },
    // 前提の機能(門番の依存の検査): 報酬の付与はウォレットへの加算(表もウォレットの通貨の型を使う)
    requires: ["wallet"],
  },
} satisfies DomainEntries;
