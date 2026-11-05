// scripts/codemods/feature-gate-s3.test.mjs
// gate-s3 の fork の移行: 開いた規則の違反 → required/ を書く、閉じた規則の違反は書かず一覧、既存は触らない、違反なし → 何もしない。
// cron の route.ts の import の付け替え(付け替え・混ざった import・既に済み・createCronRoute は止める)。
// 実行: pnpm test:codemods(一時フォルダの fixture)

import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { applyS3, planRequired, requiredContent, rewriteCronRouteImport } from "./feature-gate-s3.mjs";

const rules = [
  { name: "wallet", enabled: () => true },
  { name: "coupon", enabled: () => false },
  { name: "payment", enabled: () => true },
];
const v = (file, folder, rule) => ({ file, folder, rule });

test("planRequired: 開いた規則の違反は required/ を書く、閉じた規則の違反は書かず一覧、既存は触らない", () => {
  const plan = planRequired(
    [v("src/a.ts", "core/wallet", "wallet"), v("src/b.ts", "core/wallet", "wallet"), v("src/c.ts", "core/coupon", "coupon"), v("src/d.ts", "core/purchaseRequest", "payment")],
    rules,
    ["payment"],
  );
  assert.deepEqual(plan.write, [{ name: "wallet", count: 2, path: "src/featureGate/required/wallet.ts" }]);
  assert.deepEqual(plan.closed, [v("src/c.ts", "core/coupon", "coupon")]);
  assert.deepEqual(plan.kept, ["payment"]);
  assert.deepEqual(planRequired([], rules, []), { write: [], closed: [], kept: [] });
});

test("requiredContent: 型付きの export const required と見直しの印", () => {
  const text = requiredContent("wallet", 3);
  assert.match(text, /import type \{ RequiredFeature \} from "@\/featureGate";/);
  assert.match(text, /export const required: RequiredFeature = \{\n  reason: "codemod feature-gate-s3 が書いた\(依存 3 件、要見直し\)",\n\};/);
});

test("rewriteCronRouteImport: createCronTaskRoute を @/wiring/cronRoute へ、他の名前は残す、2 度目は何もしない", () => {
  const only = 'import { createCronTaskRoute } from "@/lib/cron";\n\nimport { cronTask } from "./task";\n\nexport const GET = createCronTaskRoute(cronTask);\n';
  const once = rewriteCronRouteImport(only);
  assert.equal(once.text, only.replace('"@/lib/cron"', '"@/wiring/cronRoute"'));
  assert.equal(rewriteCronRouteImport(once.text).changed, false);

  const mixed = rewriteCronRouteImport('import { createCronTaskRoute, verifyCronRequest } from "@/lib/cron";\n');
  assert.equal(mixed.text, 'import { verifyCronRequest } from "@/lib/cron";\nimport { createCronTaskRoute } from "@/wiring/cronRoute";\n');

  const merged = rewriteCronRouteImport('import { createCronTaskRoute } from "@/lib/cron";\nimport { other } from "@/wiring/cronRoute";\n');
  assert.equal(merged.text, 'import { other, createCronTaskRoute } from "@/wiring/cronRoute";\n');

  const typeOnly = rewriteCronRouteImport('import { type CronTaskDefinition, createCronTaskRoute } from "@/lib/cron";\n');
  assert.equal(typeOnly.text, 'import { type CronTaskDefinition } from "@/lib/cron";\nimport { createCronTaskRoute } from "@/wiring/cronRoute";\n');

  const manual = rewriteCronRouteImport('import { createCronRoute } from "@/lib/cron";\n');
  assert.deepEqual(manual, { text: 'import { createCronRoute } from "@/lib/cron";\n', changed: false, manual: ["createCronRoute"] });
});

test("applyS3: 書く・既にあるファイルは上書きしない", () => {
  const root = mkdtempSync(join(tmpdir(), "gate-s3-"));
  const plan = { required: { write: [{ name: "wallet", count: 1, path: "src/featureGate/required/wallet.ts" }], closed: [], kept: [] }, cron: [], manual: [] };
  applyS3(root, plan);
  const path = join(root, "src/featureGate/required/wallet.ts");
  assert.ok(existsSync(path));
  const first = readFileSync(path, "utf8");
  applyS3(root, { ...plan, required: { ...plan.required, write: [{ name: "wallet", count: 9, path: "src/featureGate/required/wallet.ts" }] } });
  assert.equal(readFileSync(path, "utf8"), first);
});
