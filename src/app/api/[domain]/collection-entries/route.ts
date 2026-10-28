// src/app/api/[domain]/collection-entries/route.ts

import { createDomainRoute } from "src/lib/routeFactory";
import { DomainError } from "@/lib/errors";

type DomainParams = { domain: string };

/** 1 回で読める主の数の上限 */
const MAX_PARENT_IDS = 100;

// GET /api/[domain]/collection-entries?field=<集まりの項目名>&parentIds=<id,id,...>
// 主の集まりをエントリ（従属の行 id 付き）で読む。認可は主の get の規則（従属の汎用 API は閉じたまま）。
// 応答: { [parentId]: { id, value, sort }[] }（論理削除された主は空）。詳細: src/lib/crud/README.md「ドメイン集約」
export const GET = createDomainRoute<any, DomainParams>(
  {
    operation: "GET /api/[domain]/collection-entries",
    crudOp: "get",
    operationType: "read",
    supports: "collectionEntriesForParents",
  },
  async (req, { service }) => {
    const query = req.nextUrl.searchParams;
    const field = query.get("field")?.trim();
    if (!field) throw new DomainError("field を指定してください", { status: 400 });
    const parentIds = [...new Set((query.get("parentIds") ?? "").split(",").map((id) => id.trim()).filter(Boolean))];
    if (parentIds.length === 0) throw new DomainError("parentIds を指定してください", { status: 400 });
    if (parentIds.length > MAX_PARENT_IDS) {
      throw new DomainError(`parentIds は ${MAX_PARENT_IDS} 件までです`, { status: 400 });
    }
    return service.collectionEntriesForParents(field, parentIds);
  },
);
