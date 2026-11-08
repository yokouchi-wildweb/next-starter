// scripts/runner/seed/insert.ts
// 計画(src/lib/seed の planSeeds)どおりにシードの行を入れる。表 → ドメインのサービスは引数で受ける(本物は serviceRegistry、テストは作り物)。
// - 入れるのはドメインのサービス: seedCreate があればそれ(例 user = デモの利用者だけを作る入口)、無ければ create。サービスの無い表は止める
// - $unique の行は先にその列で探し(searchWithDeleted があればそれ = 論理削除済みも探す。一意の制約は削除済みの行にも掛かるため。無ければ search)、
//   あれば入れずにその行を使う(何度打っても同じ)
// - ref は先に入れた(または見つけた)行の id に置き換える
// 利用者: scripts/runner/seed/run.ts・テスト

import { resolveRow, type SeedEntry } from "../../../src/lib/seed";

export type SeedService = {
  create?: (data: Record<string, unknown>) => Promise<{ id: unknown }>;
  seedCreate?: (data: Record<string, unknown>) => Promise<{ id: unknown }>;
  search?: (params: { where: unknown; limit: number }) => Promise<{ results: { id: unknown }[] }>;
  searchWithDeleted?: (params: { where: unknown; limit: number }) => Promise<{ results: { id: unknown }[] }>;
};

/** 表の名前 → そのドメインのサービス(無ければ null) */
export type ServiceOfTable = (table: string) => Promise<SeedService | null>;

export type InsertReport = { domain: string; table: string; key: string; action: "created" | "found" }[];

export async function insertSeeds(order: readonly SeedEntry[], serviceOf: ServiceOfTable, log: (line: string) => void = () => {}): Promise<InsertReport> {
  const ids = new Map<string, unknown>();
  const report: InsertReport = [];
  for (const entry of order) {
    log(`▶ ${entry.domain}(${entry.file})`);
    for (const [table, rows] of Object.entries(entry.seed.tables)) {
      const service = await serviceOf(table);
      const write = service?.seedCreate ?? service?.create;
      if (!service || !write) throw new Error(`${entry.file}: 表 ${table} を書くドメインのサービス(create)がありません(サービスの無いドメインはシードできない)`);
      for (const row of rows) {
        const values = resolveRow(row, ids);
        let id: unknown;
        let action: "created" | "found" = "created";
        if (row.$unique && row.$unique.length > 0) {
          const find = service.searchWithDeleted ?? service.search;
          if (!find) throw new Error(`${entry.file}: 表 ${table} のサービスに search が無いので $unique で探せません`);
          const where = { and: row.$unique.map((field) => ({ field, op: "eq", value: values[field] })) };
          const found = (await find.call(service, { where, limit: 1 })).results[0];
          if (found) {
            id = found.id;
            action = "found";
          }
        }
        if (id === undefined) id = (await write.call(service, values)).id;
        ids.set(`${entry.domain}:${row.$key}`, id);
        report.push({ domain: entry.domain, table, key: row.$key, action });
        log(`    ${action === "found" ? "= 既にある" : "✓ 入れた"} ${table} ${row.$key}`);
      }
    }
  }
  return report;
}
