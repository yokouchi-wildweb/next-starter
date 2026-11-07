// 生成カテゴリ components の一部: 管理一覧の一括操作の受け口(棚の評議会 D149)。
// - <domain>/extensionPoints.ts: 受け口 adminBulkActions の宣言(生成されるドメインの宣言は生成器が持つ。生成のたびに書き直す。
//   別の受け口が要るドメインは generate: false にして手で持つ)
// - <domain>/types/adminBulkAction.ts: 項目の型(BulkActionItem<Row, AdminBulkActionAccess>)
// 一覧(<domain>/extensions/adminBulkActions.ts)は pnpm generate extensions が書く(forge は続けて回す)。
// 一覧の Table(Admin__Domain__List/Table.tsx)が一覧を読み、項目があれば選択の表と一括操作のバーを出す

import path from "node:path";

import { featureRel } from "../../domain/context.mjs";
import { file } from "../output.mjs";

/** 生成するドメインの import の住所(src/features/<x>/ → @/features/<x>) */
const featureImport = (ctx) => `@/features/${featureRel(ctx).replace(/^src\/features\//, "").replace(/^core\//, "")}`;

export function extensionPointsContent(ctx) {
  return `// ${featureRel(ctx)}/extensionPoints.ts
// ${ctx.label}の拡張点の宣言(pnpm generate domain が生成する。生成のたびに書き直すので手で編集しない。
// 別の受け口が要るなら domain.json を generate: false にして手で持つ)。書式: scripts/structure/extensions/README.md

export const extensionPoints = {
  // 管理一覧の一括操作: adminBulkActions/<名前>.tsx の export const bulkAction(lib/crud の作成関数で数行。D149)
  adminBulkActions: {
    dir: "adminBulkActions",
    export: "bulkAction",
    type: { from: "${featureImport(ctx)}/types/adminBulkAction", name: "${ctx.pascal}AdminBulkActionItem" },
    side: "client",
    key: "key",
    overrideOf: ["enabled", "order"],
  },
};
`;
}

export function adminBulkActionTypeContent(ctx) {
  return `// ${featureRel(ctx)}/types/adminBulkAction.ts
// ${ctx.label}の管理一覧の一括操作の項目の型(pnpm generate domain が生成する。手で編集しない)

import type { BulkActionItem } from "@/lib/tableSuite";
import type { ${ctx.pascal} } from "${featureImport(ctx)}/entities";
import type { AdminBulkActionAccess } from "@/features/core/user/types";

/** ${featureRel(ctx)}/adminBulkActions/<名前>.tsx の export const bulkAction。作り方: src/lib/tableSuite/README.md「一括操作の受け口」 */
export type ${ctx.pascal}AdminBulkActionItem = BulkActionItem<${ctx.pascal}, AdminBulkActionAccess>;
`;
}

/** @returns {import("../output.mjs").Output[]} */
export function renderBulkActionFiles(ctx) {
  return [
    file(path.join(ctx.dir, "extensionPoints.ts"), extensionPointsContent(ctx), { label: "受け口の宣言を生成しました" }),
    file(path.join(ctx.dir, "types", "adminBulkAction.ts"), adminBulkActionTypeContent(ctx), { label: "型を生成しました" }),
  ];
}
