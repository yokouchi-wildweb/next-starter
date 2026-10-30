// src/wiring/domains.test.mts
// 管理画面の共通部品の組(adminListParts 等)と、関連選択肢の取得本体の回帰テスト(DB は使わない)。
// - access は汎用 API と同じく serviceRegistry の entry から resolveAccessRule で操作ごとに解く
// - key は params / searchParams から cache のキーのプリミティブを取り出す
// - 関連選択肢: 関連先ごとに list の access を取得前に評価し、拒否はその関連だけ空・取得しない・開発環境だけログ 1 行
// 実行: pnpm test:wiring-domains

import assert from "node:assert/strict";
import { test } from "node:test";

import { fetchAdminRelationOptions } from "@/features/core/admin/services/server/screenData/adminRelationOptions";
// `export *` だけの index.ts は tsx の ESM 読み込みで名前を拾えないので、実装ファイルを直接読む
import { resolveAccessRule } from "@/lib/domain/config/apiAccess";
import { serviceRegistry } from "@/registry/serviceRegistry";

import { adminCreateParts, adminEditParts, adminListParts, adminSortParts } from "./domains.ts";

test("共通部品の組: access は serviceRegistry の entry から操作ごとに解く(汎用 API と同じ)", () => {
  const access = serviceRegistry.sample.access;
  assert.deepEqual(adminListParts("sample").access, resolveAccessRule(access, "search", "read"));
  assert.deepEqual(adminEditParts("sample", { fallbackPath: "/admin/samples" }).access, resolveAccessRule(access, "get", "read"));
  assert.deepEqual(adminCreateParts("sample").access, resolveAccessRule(access, "create", "write"));
  assert.deepEqual(adminSortParts("sample").access, resolveAccessRule(access, "searchForSorting", "read"));
  // 宣言の無い write 操作は fail-closed の既定(管理者カテゴリ)に倒れる
  assert.deepEqual(adminCreateParts("sample").access, resolveAccessRule({}, "create", "write"));
});

test("共通部品の組: 登録表に無いドメインは作る時点で throw", () => {
  assert.throws(() => adminListParts("noSuchDomain"), /serviceRegistry に無い/);
});

test("共通部品の組: key は params / searchParams のプリミティブ", async () => {
  const list = adminListParts("sample");
  assert.deepEqual(await list.key!({ searchParams: Promise.resolve({ page: "2", searchQuery: "q" }) }), [2, "q"]);
  assert.deepEqual(await list.key!({ searchParams: Promise.resolve({}) }), [1, undefined]);
  const edit = adminEditParts("sample", { fallbackPath: "/admin/samples" });
  assert.deepEqual(
    await edit.key!({ params: Promise.resolve({ id: "x1" }), searchParams: Promise.resolve({ returnTo: "/admin/samples?page=2" }) }),
    ["x1", "/admin/samples?page=2"],
  );
});

const relationConfig = {
  relations: [
    { domain: "sample_category", relationType: "belongsTo" },
    { domain: "sample_tag", relationType: "belongsToMany", includeRelationTable: true },
  ],
};

test("関連選択肢: 拒否された関連先は取得せず空、許可された関連先だけ読む", async () => {
  const listed: string[] = [];
  const target = (domain: string, rule: "public" | { roles: string[] }) => ({
    access: rule,
    list: async () => {
      listed.push(domain);
      return [{ id: `${domain}-1` }];
    },
  });
  const fallback = await fetchAdminRelationOptions(relationConfig, {
    resolveTarget: (domain) => (domain === "sample_category" ? target(domain, "public") : target(domain, { roles: ["admin"] })),
    allows: (rule) => rule === "public",
  });
  const [byDomain] = Object.values(fallback);
  assert.deepEqual(byDomain, { sample_category: [{ id: "sample_category-1" }], sample_tag: [] });
  assert.deepEqual(listed, ["sample_category"]);
});

test("関連選択肢: 拒否のログは開発環境だけ 1 行(ドメイン名だけ)", async () => {
  const logs: string[] = [];
  const original = console.info;
  const env = process.env as Record<string, string | undefined>;
  const originalEnv = env.NODE_ENV;
  console.info = (message: string) => logs.push(message);
  try {
    const deps = {
      resolveTarget: () => ({ access: "none" as const, list: async () => [] }),
      allows: () => false,
    };
    env.NODE_ENV = "production";
    await fetchAdminRelationOptions({ relations: [relationConfig.relations[0]] }, deps);
    assert.equal(logs.length, 0);
    env.NODE_ENV = "development";
    await fetchAdminRelationOptions({ relations: [relationConfig.relations[0]] }, deps);
    assert.equal(logs.length, 1);
    assert.match(logs[0], /"sample_category"/);
  } finally {
    console.info = original;
    env.NODE_ENV = originalEnv;
  }
});

test("関連選択肢: 全件取得する関連が無ければ {}(取得も評価もしない)", async () => {
  const fallback = await fetchAdminRelationOptions({ relations: [] }, {
    resolveTarget: () => {
      throw new Error("呼ばれない");
    },
    allows: () => {
      throw new Error("呼ばれない");
    },
  });
  assert.deepEqual(fallback, {});
});
