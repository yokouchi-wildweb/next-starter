// 生成カテゴリ components の一部: 管理一覧の一括操作の項目の型(棚の評議会 D149)。
// - <domain>/types/adminBulkAction.ts: 項目の型(core/admin の AdminBulkActionItemOf<Row>。domain? = 効く一覧のドメイン、省略 = 差したドメイン)
// 点 adminBulkActions は core/admin の 1 点(段 3 注文 24 Q2)なので、生成するドメインは宣言を持たない。項目は <domain>/plugs/adminBulkActions/<名前>.tsx。
// 一覧の Table(Admin__Domain__List/Table.tsx)が core/admin の useDomainAdminBulkActions で自分の項目を読み、項目があれば選択の表と一括操作のバーを出す

import path from "node:path";

import { domainRel } from "../../domain/context.mjs";
import { file } from "../output.mjs";

/** 生成するドメインの import の住所(src/domains/<x>/ → @/domains/<x>) */
const domainImport = (ctx) => `@/domains/${domainRel(ctx).replace(/^src\/domains\//, "").replace(/^core\//, "")}`;

export function adminBulkActionTypeContent(ctx) {
  return `// ${domainRel(ctx)}/types/adminBulkAction.ts
// ${ctx.label}の管理一覧の一括操作の項目の型(pnpm generate domain が生成する。手で編集しない)

import type { AdminBulkActionItemOf } from "@/domains/core/admin/types/adminBulkAction";
import type { ${ctx.pascal} } from "${domainImport(ctx)}/entities";

/** ${domainRel(ctx)}/plugs/adminBulkActions/<名前>.tsx の export const bulkAction(ほかのドメインからは domain: "${path.basename(domainRel(ctx))}" で)。作り方: src/lib/tableSuite/README.md「一括操作の受け口」 */
export type ${ctx.pascal}AdminBulkActionItem = AdminBulkActionItemOf<${ctx.pascal}>;
`;
}

/** @returns {import("../output.mjs").Output[]} */
export function renderBulkActionFiles(ctx) {
  return [
    file(path.join(ctx.dir, "types", "adminBulkAction.ts"), adminBulkActionTypeContent(ctx), { label: "型を生成しました" }),
  ];
}
