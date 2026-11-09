// scripts/runner/seed/seed.test.ts — pnpm test scripts/runner/seed
// シードのランナー: 走査(scan.ts)・閉じた機能の判定・サービスで入れる(insert.ts、作り物のサービス)・表が無いエラー・本物の木のシード。DB には触らない。
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { rules } from "@/featureGate/node";

import { defineSeed, planSeeds, ref, type SeedEntry } from "../../../src/lib/seed";
import { isUndefinedTableError } from "./gate";
import { insertSeeds, type SeedService } from "./insert";
import { closedByOf, listSeedFiles, loadSeedEntries } from "./scan";

const ROOT = path.resolve(import.meta.dirname, "../../..");

test("走査: core と業務のドメインの seed.ts をドメイン名で集める(名前順)", () => {
  const root = mkdtempSync(path.join(tmpdir(), "seed-scan-"));
  try {
    for (const rel of ["src/features/core/user/seed.ts", "src/features/shop/seed.ts", "src/features/shop/other.ts", "src/features/empty/README.md"]) {
      mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      writeFileSync(path.join(root, rel), "\n");
    }
    assert.deepEqual(listSeedFiles(root), [
      { domain: "shop", folder: "shop", file: "src/features/shop/seed.ts" },
      { domain: "user", folder: "core/user", file: "src/features/core/user/seed.ts" },
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("閉じた機能: そのフォルダを domains に持つ閉じた規則の名前、開いていれば null", () => {
  const closedBy = closedByOf([
    { name: "shopRule", domains: ["shop"], enabled: () => false },
    { name: "walletRule", domains: ["core/wallet"], enabled: () => true },
  ]);
  assert.equal(closedBy("shop"), "shopRule");
  assert.equal(closedBy("core/wallet"), null);
  assert.equal(closedBy("core/user"), null);
});

test("閉じたドメイン: 2 つの規則が持つドメインは片方が開なら開、両方閉なら一覧の順で最初の規則の名前", () => {
  const rule = (name: string, open: boolean) => ({ name, domains: ["core/userTag"], enabled: () => open });
  assert.equal(closedByOf([rule("users", false), rule("demoUsers", true)])("core/userTag"), null);
  assert.equal(closedByOf([rule("users", false), rule("demoUsers", false)])("core/userTag"), "users");
});

const entry = (domain: string, seed: ReturnType<typeof defineSeed>, closedBy: string | null = null): SeedEntry => ({ domain, folder: domain, file: `src/features/${domain}/seed.ts`, seed, closedBy });

/** 作り物のサービス: 入れた行を覚え、search は where の and/eq だけを見る */
function fakeServices(opts: { seedCreateFor?: string[]; noService?: string[] } = {}) {
  const rows = new Map<string, Record<string, unknown>[]>();
  const calls: string[] = [];
  const serviceOf = async (table: string): Promise<SeedService | null> => {
    if (opts.noService?.includes(table)) return null;
    const list = rows.get(table) ?? [];
    rows.set(table, list);
    const insert = (how: string) => async (data: Record<string, unknown>) => {
      calls.push(`${how} ${table}`);
      const row = { ...data, id: `${table}-${list.length + 1}` };
      list.push(row);
      return row;
    };
    return {
      create: insert("create"),
      ...(opts.seedCreateFor?.includes(table) ? { seedCreate: insert("seedCreate") } : {}),
      search: async ({ where }) => {
        const conds = (where as { and: { field: string; value: unknown }[] }).and;
        return { results: list.filter((r) => conds.every((c) => r[c.field] === c.value)).slice(0, 1) as { id: unknown }[] };
      },
    };
  };
  return { rows, calls, serviceOf };
}

test("入れる: ref を入れた行の id に、seedCreate を先に、$unique の行は 2 回目に使い回す(行が増えない)", async () => {
  const entries = [
    entry("tag", defineSeed({ tables: { tags: [{ $key: "a", $unique: ["name"], name: "A" }] } })),
    entry("user", defineSeed({ tables: { users: [{ $key: "demo", $unique: ["uid"], uid: "u1" }] } })),
    entry("item", defineSeed({ after: ["tag"], tables: { items: [{ $key: "x", $unique: ["name"], name: "X", tag_id: ref("tag", "a"), tag_ids: [ref("tag", "a")] }] } })),
  ];
  const fake = fakeServices({ seedCreateFor: ["users"] });
  const plan = planSeeds(entries);
  assert.deepEqual(plan.problems, []);
  const first = await insertSeeds(plan.order, fake.serviceOf);
  assert.deepEqual(first.map((r) => r.action), ["created", "created", "created"]);
  assert.deepEqual(fake.rows.get("items"), [{ name: "X", tag_id: "tags-1", tag_ids: ["tags-1"], id: "items-1" }]);
  assert.ok(fake.calls.includes("seedCreate users") && !fake.calls.includes("create users"));
  const second = await insertSeeds(plan.order, fake.serviceOf);
  assert.deepEqual(second.map((r) => r.action), ["found", "found", "found"]);
  assert.deepEqual([...fake.rows.values()].map((list) => list.length), [1, 1, 1]);
});

test("入れる: $unique は searchWithDeleted を先に使う(論理削除済みの行も一意の制約に掛かる)", async () => {
  const calls: string[] = [];
  const service: SeedService = {
    create: async () => ({ id: "new" }),
    search: async () => (calls.push("search"), { results: [] }),
    searchWithDeleted: async () => (calls.push("searchWithDeleted"), { results: [{ id: "deleted-1" }] }),
  };
  const report = await insertSeeds([entry("user", defineSeed({ tables: { users: [{ $key: "demo", $unique: ["uid"], uid: "u1" }] } }))], async () => service);
  assert.deepEqual([calls, report[0].action], [["searchWithDeleted"], "found"]);
});

test("入れる: $unique の無い行は毎回入れる、サービスの無い表は止める", async () => {
  const fake = fakeServices({ noService: ["logs"] });
  const plain = [entry("tag", defineSeed({ tables: { tags: [{ $key: "a", name: "A" }] } }))];
  await insertSeeds(plain, fake.serviceOf);
  await insertSeeds(plain, fake.serviceOf);
  assert.equal(fake.rows.get("tags")?.length, 2);
  await assert.rejects(insertSeeds([entry("log", defineSeed({ tables: { logs: [{ $key: "a" }] } }))], fake.serviceOf), /表 logs を書くドメインのサービス/);
});

test("isUndefinedTableError: 42P01 を cause までたどる", () => {
  assert.equal(isUndefinedTableError({ code: "42P01" }), true);
  assert.equal(isUndefinedTableError(Object.assign(new Error("Failed query"), { cause: { code: "42P01" } })), true);
  assert.equal(isUndefinedTableError({ code: "23505" }), false);
  assert.equal(isUndefinedTableError(undefined), false);
});

test("本物の木: 上流の 4 つのシードが読み込め、置き方の誤りが無く、全部の行に $unique がある", async () => {
  const entries = await loadSeedEntries(ROOT, listSeedFiles(ROOT), closedByOf(rules));
  const upstream = entries.filter((e) => ["user", "sample", "sampleTag", "sampleCategory"].includes(e.domain));
  assert.equal(upstream.length, 4);
  const plan = planSeeds(entries.map((e) => ({ ...e, closedBy: null })));
  assert.deepEqual(plan.problems, []);
  for (const e of upstream) for (const rows of Object.values(e.seed.tables)) for (const row of rows) assert.ok(row.$unique && row.$unique.length > 0, `${e.file} ${row.$key}`);
  const sample = plan.order.findIndex((e) => e.domain === "sample");
  assert.ok(sample > plan.order.findIndex((e) => e.domain === "sampleTag") && sample > plan.order.findIndex((e) => e.domain === "sampleCategory"));
});
