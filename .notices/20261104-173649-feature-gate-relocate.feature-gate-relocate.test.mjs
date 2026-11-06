// .notices/20261104-173649-feature-gate-relocate.feature-gate-relocate.test.mjs
// 実行: pnpm test .notices(一時フォルダの fixture。git は使わない)

import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";

import { itemsOf, planExtensions } from "../scripts/structure/extensions/extensions.mjs";

import { applyRelocate, convertAlwaysOn, planRelocate, rewriteCodeImports, rewriteRuleImport } from "./20261104-173649-feature-gate-relocate.feature-gate-relocate.mjs";

const repoRoot = resolve(import.meta.dirname, "..");
const RULE = (flag) => `// fork の規則\nimport { F } from "@/config/app/f.config";\n\nimport type { FeatureGateRule } from "../types";\n\nexport const rule: FeatureGateRule = {\n  pathPatterns: ["/${flag}"],\n  enabled: () => F.${flag},\n};\n`;
const EXCEPTION = '// fork の結線\nexport const exception = { file: "src/wiring/mine.ts", reason: "route でだけ走る" };\n';

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), "feature-gate-relocate-"));
  const all = {
    ".claude/rules/project.md": "fork_id: acme\n",
    ".notices/applied/parent.md": "",
    "src/featureGate/extensionPoints.ts": readFileSync(join(repoRoot, "src/featureGate/extensionPoints.ts"), "utf8"),
    // 上流の規則(取り込みで移っている)
    "src/featureGate/rules/wallet.ts": 'import type { FeatureGateRule } from "@/featureGate";\nexport const rule: FeatureGateRule = { pathPatterns: ["/wallet"], enabled: () => true };\n',
    ...files,
  };
  for (const [path, text] of Object.entries(all)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

test("書き換えの部品: 規則の型の import・例外の型・コードの import 2 種", () => {
  assert.match(rewriteRuleImport(RULE("x")), /import type \{ FeatureGateRule \} from "@\/featureGate";/);
  assert.match(rewriteRuleImport('import type { FeatureGateRule } from "@/proxies/types";\n'), /"@\/featureGate"/);
  assert.equal(rewriteRuleImport('import type { FeatureGateRule } from "@/featureGate";\n'), null);
  const converted = convertAlwaysOn(EXCEPTION);
  assert.match(converted.text, /^\/\/ fork の結線\n\nimport type \{ AlwaysOnException \} from "@\/featureGate";\n\nexport const exception: AlwaysOnException = \{/);
  assert.match(convertAlwaysOn('export const registry = { file: "a", reason: "r" };\n').text, /export const registry: AlwaysOnException =/);
  assert.ok(convertAlwaysOn("export const x = 1;\n").problem);
  const code = rewriteCodeImports('import { matchesPath } from "@/proxies/pathPattern.mjs";\nimport { featureGateRules } from "@/proxies/extensions/featureGateRules";\n');
  assert.equal(code.text, 'import { matchesPath } from "@/lib/pathPattern/index.mjs";\nimport { rules as featureGateRules } from "@/featureGate/node";\n');
  const relative = rewriteCodeImports('import { featureGateRules as list } from "../../src/proxies/extensions/featureGateRules.ts";\nimport { x } from "../proxies/pathPattern.mjs";\n');
  assert.equal(relative.text, 'import { rules as list } from "../../src/featureGate/node.ts";\nimport { x } from "../lib/pathPattern/index.mjs";\n');
  assert.ok(rewriteCodeImports('import * as g from "@/proxies/extensions/featureGateRules";\n').problem, "名前空間の形は止める");
  const literal = 'const doc = "src/proxies/pathPattern.mjs と @/proxies/extensions/featureGateRules は移った";\n';
  assert.deepEqual(rewriteCodeImports(literal), { text: literal, changed: false, problem: undefined }, "import でない字面は見ない");
  assert.match(rewriteCodeImports('const m = await import("@/proxies/pathPattern.mjs");\n').text, /import\("@\/lib\/pathPattern\/index\.mjs"\)/);
});

test("dry-run は計画だけ、--apply で移して書き換え、移した後の生成一覧に fork の規則が入る", () => {
  const root = fixture({
    "src/proxies/featureGateRules/acmeShop.ts": RULE("shop"),
    "src/proxies/featureGateRules/acmeBox/index.ts": RULE("box"),
    "src/featureGate/rules/acmeMerged.ts": RULE("merged"), // git の取り込みが先に移した(旧い import のまま)
    "scripts/proxies/alwaysOnExceptions/mineWiring.mjs": EXCEPTION,
    "src/app/mine/loader.ts": 'import { featureGateRules } from "@/proxies/extensions/featureGateRules";\nexport const x = featureGateRules;\n',
    "scripts/mine/report.mjs": 'import { matchesPath } from "../../src/proxies/pathPattern.mjs";\nexport const y = matchesPath;\n',
  });
  const plan = planRelocate(root);
  assert.deepEqual(plan.stops, []);
  assert.deepEqual(plan.moves.map((m) => `${m.from} → ${m.to}`), [
    "src/proxies/featureGateRules/acmeBox → src/featureGate/rules/acmeBox",
    "src/proxies/featureGateRules/acmeShop.ts → src/featureGate/rules/acmeShop.ts",
    "scripts/proxies/alwaysOnExceptions/mineWiring.mjs → src/featureGate/alwaysOnExceptions/mineWiring.ts",
  ]);
  assert.deepEqual(plan.edits.map((e) => `${e.path}:${e.kind}`).sort(), [
    "scripts/mine/report.mjs:code-import",
    "src/app/mine/loader.ts:code-import",
    "src/featureGate/rules/acmeMerged.ts:rule-import",
    "src/proxies/featureGateRules/acmeBox/index.ts:rule-import",
    "src/proxies/featureGateRules/acmeShop.ts:rule-import",
  ]);
  assert.equal(plan.notes.length, 1, "アプリ側で一覧を読む所は手で gate へ");
  assert.ok(existsSync(join(root, "src/proxies/featureGateRules/acmeShop.ts")), "dry-run は書かない");

  applyRelocate(root, plan);
  assert.ok(!existsSync(join(root, "src/proxies/featureGateRules")), "空になった旧い置き場は消す");
  assert.ok(!existsSync(join(root, "scripts/proxies/alwaysOnExceptions")));
  for (const path of ["src/featureGate/rules/acmeShop.ts", "src/featureGate/rules/acmeBox/index.ts", "src/featureGate/rules/acmeMerged.ts"]) {
    assert.match(readFileSync(join(root, path), "utf8"), /import type \{ FeatureGateRule \} from "@\/featureGate";/, path);
  }
  assert.match(readFileSync(join(root, "src/featureGate/alwaysOnExceptions/mineWiring.ts"), "utf8"), /export const exception: AlwaysOnException =/);
  assert.match(readFileSync(join(root, "scripts/mine/report.mjs"), "utf8"), /"\.\.\/\.\.\/src\/lib\/pathPattern\/index\.mjs"/);
  assert.match(readFileSync(join(root, "src/app/mine/loader.ts"), "utf8"), /import \{ rules as featureGateRules \} from "@\/featureGate\/node";/);
  assert.deepEqual(planRelocate(root), { moves: [], edits: [], stops: [], notes: [] }, "2 回目は何もしない");

  const generated = planExtensions(root);
  assert.deepEqual(itemsOf(generated, "src/featureGate", "rules").map((i) => i.name), ["acmeBox", "acmeMerged", "acmeShop", "wallet"]);
  assert.deepEqual(itemsOf(generated, "src/featureGate", "alwaysOnExceptions").map((i) => i.name), ["mineWiring"]);
});

test("止める: 印付き・上流と同名・例外の名前がハイフン・例外の形・旧い 1 ファイルの例外表", () => {
  const root = fixture({
    "src/proxies/featureGateRules/shop.acme.ts": RULE("shop"),
    "src/proxies/featureGateRules/wallet.ts": RULE("wallet"),
    "scripts/proxies/alwaysOnExceptions/mine-wiring.mjs": EXCEPTION,
    "scripts/proxies/alwaysOnExceptions/empty.mjs": "export const x = 1;\n",
    "scripts/proxies/alwaysOnExceptions.acme.mjs": "export const exceptions = {};\n",
  });
  const plan = planRelocate(root);
  assert.deepEqual(plan.moves, []);
  const reasons = Object.fromEntries(plan.stops.map((s) => [s.path, s]));
  assert.match(reasons["src/proxies/featureGateRules/shop.acme.ts"].reason, /印が残っている.*20261103-095341/);
  assert.match(reasons["src/proxies/featureGateRules/wallet.ts"].reason, /同じ名前の規則/);
  assert.equal(reasons["src/proxies/featureGateRules/wallet.ts"].suggest, "src/proxies/featureGateRules/walletFork.ts");
  assert.match(reasons["scripts/proxies/alwaysOnExceptions/mine-wiring.mjs"].reason, /英数字だけ/);
  assert.equal(reasons["scripts/proxies/alwaysOnExceptions/mine-wiring.mjs"].suggest, "scripts/proxies/alwaysOnExceptions/mineWiring.mjs");
  assert.match(reasons["scripts/proxies/alwaysOnExceptions/empty.mjs"].reason, /どちらか 1 つ/);
  assert.match(reasons["scripts/proxies/alwaysOnExceptions.acme.mjs"].reason, /旧い 1 ファイルの例外表/);
  assert.equal(plan.stops.length, 5);
});
