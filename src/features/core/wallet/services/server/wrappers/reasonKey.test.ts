// src/features/core/wallet/services/server/wrappers/reasonKey.test.ts
//
// 付与の種類(reason key)の検査(DB なし)。
// - 区分の導出: reasonKey があれば登録の category、食い違い・未登録は DomainError 500(書き手の誤り)
// - reasonKey なしは今まで通り(reasonCategory ?? other)、requiresKey の区分は警告だけ(止めない)
// - 管理者の調整: 省略 = 固定キー admin_adjustment、他の区分は種類なし、未登録の key は 400
// - 上流のコードの静的な検査: requiresKey の区分(bonus)を書く上流のファイルは reasonKey を渡す
// - 上流の種類の項目: coupon_attribution_reward(bonus)・admin_adjustment(admin_adjustment)
// 実行: pnpm test:wallet-reason-key
// (package.json に type: module が無いので tsx は CJS として読む → before() で import)
import { before, test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { DomainError } from "@/lib/errors/domainError";

import type * as ReasonKeyModule from "./reasonKey";

let m: typeof ReasonKeyModule;
let reasonKeys: Readonly<Record<string, { key: string; category: string }>>;
before(async () => {
  m = await import("./reasonKey");
  ({ reasonKeys } = await import("@/features/core/walletHistory/extensions/reasonKeys"));
});

const items = {
  rank_bonus: { key: "rank_bonus", label: "ランクボーナス", category: "bonus" as const },
};
const categories = {
  bonus: { label: "ボーナス", sourceTypes: ["system" as const], sortOrder: 30, requiresKey: true },
  other: { label: "その他", sourceTypes: ["system" as const], sortOrder: 99 },
};
const deps = (warnings: string[]) => ({
  lookup: (key: string) => (items as Record<string, (typeof items)["rank_bonus"]>)[key],
  categories,
  warn: (message: string) => warnings.push(message),
});

test("reasonKey があれば区分は登録の category", () => {
  const warnings: string[] = [];
  assert.deepEqual(m.resolveWalletReason({ reasonKey: "rank_bonus" }, deps(warnings)), {
    reasonCategory: "bonus",
    reasonKey: "rank_bonus",
  });
  assert.deepEqual(m.resolveWalletReason({ reasonKey: "rank_bonus", reasonCategory: "bonus" }, deps(warnings)), {
    reasonCategory: "bonus",
    reasonKey: "rank_bonus",
  });
  assert.equal(warnings.length, 0);
});

test("食い違い・未登録の key は DomainError 500(書き手の誤り)", () => {
  const check = (code: string) => (error: unknown) =>
    error instanceof DomainError && error.status === 500 && error.code === code;
  assert.throws(() => m.resolveWalletReason({ reasonKey: "rank_bonus", reasonCategory: "other" }, deps([])), check("wallet_reason_key_mismatch"));
  assert.throws(() => m.resolveWalletReason({ reasonKey: "nope" }, deps([])), check("wallet_reason_key_unknown"));
});

test("reasonKey なしは今まで通り。requiresKey の区分は警告だけ", () => {
  const warnings: string[] = [];
  assert.deepEqual(m.resolveWalletReason({}, deps(warnings)), { reasonCategory: "other", reasonKey: null });
  assert.equal(warnings.length, 0);
  assert.deepEqual(m.resolveWalletReason({ reasonCategory: "bonus" }, deps(warnings)), { reasonCategory: "bonus", reasonKey: null });
  assert.equal(warnings.length, 1);
  assert.match(warnings[0]!, /reasonKey/);
});

test("管理者の調整: 省略 = 固定キー、他の区分は種類なし、未登録の key は 400", () => {
  assert.deepEqual(m.resolveAdminAdjustReason({}), { reasonKey: "admin_adjustment" });
  assert.deepEqual(m.resolveAdminAdjustReason({ reasonCategory: "admin_adjustment" }), { reasonKey: "admin_adjustment" });
  assert.deepEqual(m.resolveAdminAdjustReason({ reasonCategory: "refund" }), { reasonCategory: "refund" });
  assert.deepEqual(m.resolveAdminAdjustReason({ reasonKey: "coupon_attribution_reward" }), { reasonKey: "coupon_attribution_reward" });
  assert.throws(
    () => m.resolveAdminAdjustReason({ reasonKey: "nope" }),
    (error: unknown) => error instanceof DomainError && error.status === 400,
  );
  assert.throws(
    () => m.resolveAdminAdjustReason({ reasonKey: "coupon_attribution_reward", reasonCategory: "refund" }),
    (error: unknown) => error instanceof DomainError && error.status === 400,
  );
});

test("上流の種類の項目", () => {
  assert.equal(reasonKeys.coupon_attribution_reward?.category, "bonus");
  assert.equal(reasonKeys.admin_adjustment?.category, "admin_adjustment");
});

// 上流のコードの静的な検査: requiresKey の区分の書き込みを持つファイルは reasonKey を渡す(fork は警告で移る)
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === "node_modules" || name === "extensions") continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

test("上流のコード: requiresKey の区分(bonus)を書くファイルは reasonKey を渡す", async () => {
  const { REASON_CATEGORY_CONFIG } = await import("@/config/app/wallet-reason-category.config");
  const required = Object.entries(REASON_CATEGORY_CONFIG)
    .filter(([, c]) => (c as { requiresKey?: boolean }).requiresKey)
    .map(([key]) => key);
  assert.ok(required.includes("bonus"));
  const pattern = new RegExp(`reasonCategory\\s*:\\s*[^,\\n]*"(${required.join("|")})"`);
  const offenders = walk("src")
    .filter((file) => !file.startsWith(path.join("src", "config")))
    .filter((file) => {
      const text = readFileSync(file, "utf8");
      return pattern.test(text) && !/reasonKey\s*:/.test(text);
    });
  assert.deepEqual(offenders, []);
});
