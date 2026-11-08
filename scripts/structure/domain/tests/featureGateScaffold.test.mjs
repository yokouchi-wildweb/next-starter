// pnpm generate domain の featureGate: domain.json の closable: true のときだけ、閉じられる形のひな形(規則・入切の値の config.ts・空の上書き)を書き捨てで書く(L1.18)。
// 既定値は Tier1 = false・fork = true、既存は上書きしない、closable の検査(boolean・Neon だけ)。
// 実行: pnpm test scripts/structure/domain/tests/featureGateScaffold.test.mjs
import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { Linter } from "eslint";
import { createRequire } from "node:module";

import configOverridesPlugin, { clearConfigOverridesCache } from "../../../../eslint-rules/config-overrides.mjs";
import gateRuleOwnerPlugin, { clearGateRuleOwnerCache } from "../../../../eslint-rules/gate-rule-owner.mjs";
import { checkOverridePairs } from "../../config-overrides/pairing.mjs";
import { closableIssues } from "../checks/closable.mjs";
import { TOP_LEVEL_KEYS } from "../spec/domainJson.mjs";
import { renderFeatureGate } from "../render/featureGate/index.mjs";
import { GENERATE_CATEGORIES, COLLECTION_CHILD_CATEGORIES, generateTargets } from "../spec/categories.mjs";
import { applyAndCapture, contextFor, makeProject, removeAll } from "./helpers.mjs";

const cleanup = [];
after(() => removeAll(cleanup));

const base = { domainConfigVersion: "1.3", singular: "shop_item", plural: "shop_items", label: "商品", dbEngine: "Neon", idType: "uuid", fields: [] };

function project(config, { tier1 = false } = {}) {
  const root = makeProject({ configs: { shopItem: config }, cleanup });
  if (tier1) {
    fs.mkdirSync(path.join(root, ".claude/rules"), { recursive: true });
    fs.writeFileSync(path.join(root, ".claude/rules/project.md"), "fork_id: next-starter\n");
    fs.mkdirSync(path.join(root, "src/lib"), { recursive: true });
    fs.writeFileSync(path.join(root, "src/lib/CATALOG.md"), "# src/lib 目録\n\n## next-starter\n");
  }
  return root;
}
const run = (root) => {
  const { workspace, ctx } = contextFor(root, "shopItem");
  return applyAndCapture(renderFeatureGate(ctx, workspace));
};
const rulePath = (root) => path.join(root, "src/featureGate/rules/shopItem.ts");
const configPath = (root) => path.join(root, "src/features/shopItem/config.ts");
const overridePath = (root) => path.join(root, "src/config/features/shopItem.config.ts");

test("closable が無い・false なら何も書かない", () => {
  for (const config of [base, { ...base, closable: false }]) {
    const root = project(config);
    run(root);
    assert.ok(!fs.existsSync(rulePath(root)));
    assert.ok(!fs.existsSync(configPath(root)));
    assert.ok(!fs.existsSync(overridePath(root)));
  }
});

test("closable: true(fork)なら規則と入切の値(既定 true)を書く。汎用 API の住所は書かない", () => {
  const root = project({ ...base, closable: true });
  run(root);
  const rule = fs.readFileSync(rulePath(root), "utf8");
  assert.match(rule, /import \{ SHOP_ITEM_CONFIG \} from "@\/features\/shopItem\/config";/);
  assert.match(rule, /pathPatterns: \[\n    "\/admin\/shop-items",\n  \],/);
  assert.match(rule, /features: \[\n    "shopItem",\n  \],/);
  assert.match(rule, /enabled: \(\) => SHOP_ITEM_CONFIG\.enabled,/);
  assert.doesNotMatch(rule, /"\/api\//);
  const config = fs.readFileSync(configPath(root), "utf8");
  assert.match(config, /import override from "@\/config\/features\/shopItem\.config";/);
  assert.match(config, /import \{ defineConfig, type OverrideOf \} from "@\/lib\/defineConfig";/);
  assert.match(config, /const defaults: ShopItemConfig = \{\n  enabled: true,\n\};/);
  assert.match(config, /export type ShopItemOverride<E extends object = Record<never, never>> = OverrideOf<typeof shopItemConfigDef, E>;/);
  assert.match(config, /export const SHOP_ITEM_CONFIG: ShopItemConfig = shopItemConfigDef\.compose\(override\);/);
  const override = fs.readFileSync(overridePath(root), "utf8");
  assert.match(override, /import type \{ ShopItemOverride \} from "@\/features\/shopItem\/config";/);
  assert.match(override, /export default \{\} satisfies ShopItemOverride;/);
});

test("書いた 2 本は上書きの 1 対 1・上書きの lint・規則の lint を通る", () => {
  const root = project({ ...base, closable: true });
  run(root);
  fs.writeFileSync(path.join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@/*": ["./src/*"] } } }));
  const pairs = checkOverridePairs(root);
  assert.deepEqual([...pairs.mapProblems, ...pairs.problems], []);
  assert.equal(pairs.pairs, 1);
  clearConfigOverridesCache();
  clearGateRuleOwnerCache();
  const tsParser = createRequire(import.meta.resolve("eslint-config-next"))("@typescript-eslint/parser");
  const lint = (file, plugins, rules) =>
    new Linter({ configType: "flat", cwd: root }).verify(
      fs.readFileSync(path.join(root, file), "utf8"),
      [{ files: ["**/*.ts"], languageOptions: { parser: tsParser, ecmaVersion: "latest", sourceType: "module" }, plugins, rules }],
      path.join(root, file),
    );
  const opt = [{ root }];
  assert.deepEqual(lint("src/config/features/shopItem.config.ts", { "config-overrides": configOverridesPlugin }, { "config-overrides/literal-only": ["error", ...opt] }), []);
  assert.deepEqual(lint("src/features/shopItem/config.ts", { "config-overrides": configOverridesPlugin }, { "config-overrides/owner-reads-only": ["error", ...opt] }), []);
  assert.deepEqual(lint("src/featureGate/rules/shopItem.ts", { "gate-rule-owner": gateRuleOwnerPlugin }, { "gate-rule-owner/one-district-config": ["error", ...opt] }), []);
});

test("Tier1 では入切の既定が false(上流の新しい機能は opt-in)", () => {
  const root = project({ ...base, closable: true }, { tier1: true });
  run(root);
  assert.match(fs.readFileSync(configPath(root), "utf8"), /enabled: false,/);
});

test("既にある規則・config.ts は上書きしない(書き捨て)", () => {
  const root = project({ ...base, closable: true });
  fs.mkdirSync(path.dirname(rulePath(root)), { recursive: true });
  fs.writeFileSync(rulePath(root), "// 手で直した規則\n");
  fs.writeFileSync(configPath(root), "export const OTHER = 1;\n");
  fs.mkdirSync(path.dirname(overridePath(root)), { recursive: true });
  fs.writeFileSync(overridePath(root), "export default { enabled: false };\n");
  const result = run(root);
  assert.equal(fs.readFileSync(rulePath(root), "utf8"), "// 手で直した規則\n");
  assert.equal(fs.readFileSync(configPath(root), "utf8"), "export const OTHER = 1;\n");
  assert.equal(fs.readFileSync(overridePath(root), "utf8"), "export default { enabled: false };\n");
  assert.match(result.stdout, /SHOP_ITEM_CONFIG\.enabled が無ければ手で足す/);
});

test("closable の検査: boolean だけ、Neon だけ。語彙とカテゴリに入る(集まりの従属には入らない)", () => {
  assert.deepEqual(closableIssues(base), []);
  assert.deepEqual(closableIssues({ ...base, closable: true }), []);
  assert.match(closableIssues({ ...base, closable: "yes" })[0], /true か false/);
  assert.match(closableIssues({ ...base, closable: true, dbEngine: "Firestore" })[0], /Neon のドメインだけ/);
  assert.deepEqual(closableIssues({ ...base, closable: false, dbEngine: "Firestore" }), []);
  assert.ok(TOP_LEVEL_KEYS.has("closable"));
  assert.ok(GENERATE_CATEGORIES.includes("featureGate"));
  assert.ok(!COLLECTION_CHILD_CATEGORIES.includes("featureGate"));
  assert.equal(generateTargets(base).featureGate, true);
  assert.equal(generateTargets({ ...base, generate: false }).featureGate, false);
});
