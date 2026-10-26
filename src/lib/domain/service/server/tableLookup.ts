// src/lib/domain/service/server/tableLookup.ts
// 登録表の table / idColumn（domainEntry.ts に書いた表の物理名と主キー列名）で、表 ↔ ドメインを引く汎用関数。
// サービスを読み込まない同期関数。登録表は引数で受ける（結んだ版は src/wiring/domains.ts）。
// 登録表の table は各サービスの getTableName() と一致し、1 つの表は 1 つのキーだけ（registry:check と test:service-registry が守る）。

import "server-only";

import type { DomainRegistry } from "../../types";

/** ドメインの表（物理名）と主キー列（物理名。論理名は常に lib/crud の CRUD_ID_FIELD = "id"） */
export type DomainTable = { table: string; idColumn: string };

const tableIndexes = new WeakMap<DomainRegistry, ReadonlyMap<string, string>>();

/** 表名 → キーの索引（登録表ごとに 1 回だけ作る）。同じ表が 2 つのキーにあれば throw（黙って片方を返さない） */
function tableIndexOf(registry: DomainRegistry): ReadonlyMap<string, string> {
  const cached = tableIndexes.get(registry);
  if (cached) return cached;
  const index = new Map<string, string>();
  for (const [key, entry] of Object.entries(registry)) {
    if (entry.table === null) continue;
    const owner = index.get(entry.table);
    if (owner !== undefined) {
      throw new Error(`表 "${entry.table}" が登録表の 2 つのキー（"${owner}" と "${key}"）にある。1 つの表は 1 つのドメインだけに登録する（pnpm registry:check）`);
    }
    index.set(entry.table, key);
  }
  tableIndexes.set(registry, index);
  return index;
}

/**
 * 表の物理名 → 登録表のキー（ドメイン名）。
 * 登録の無い表（中間表・履歴・カウンター・cron の記録など）は null。表を持たない Firestore 版のドメインは引けない
 */
export function findDomainByTable(registry: DomainRegistry, tableName: string): string | null {
  return tableIndexOf(registry).get(tableName) ?? null;
}

/** 登録表のキー（ドメイン名）→ 表と主キー列。未登録と、表を持たない Firestore 版は null */
export function getDomainTable(registry: DomainRegistry, key: string): DomainTable | null {
  if (!Object.prototype.hasOwnProperty.call(registry, key)) return null;
  const { table, idColumn } = registry[key];
  return table === null || idColumn === null ? null : { table, idColumn };
}
