// src/featureGate/checks/reachability.test.mjs
// 門番の到達の検査(D7): 入口 index.ts(server・proxy)と client.ts から値の import をたどり、
// データの層と Node 専用の物に届いたら落とす。門番は proxy(Edge)と client の束に載るので、規則と config 以外を引き込まない。
// - 落とす先: src/features/**/services/**・src/lib/drizzle/**・drizzle-orm / postgres・server-only・node:*
// - たどる辺: 静的 import / export … from / 動的 import()。型だけの import(import type・export type・名前が全部 type)は数えない
// - 解決: eslint-rules/resolve-import.mjs(tsconfig の paths・相対)+ 拡張子と index の補完。パッケージは葉(中に入らない)
// 前例: src/wiring/wiring.test.mjs(テキストで import を読む)。node.ts は道具の入口なので対象外(drizzle を読んでよい)
// 実行: pnpm test src/featureGate/checks/reachability.test.mjs(plain node)

import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { test } from "node:test";

import { resolveImport } from "../../../eslint-rules/resolve-import.mjs";
import { valueImportSources } from "./importSources.mjs";

export { valueImportSources };

const ROOT = resolve(import.meta.dirname, "../../..");
const ENTRIES = ["src/featureGate/index.ts", "src/featureGate/client.ts"];

const toPosix = (p) => p.split(sep).join("/");
/** 落とす先か。理由か null */
export function forbiddenTarget(source, resolvedRel) {
  if (source === "server-only") return "server-only";
  if (source.startsWith("node:")) return "Node 組み込み";
  if (source === "postgres" || source === "drizzle-orm" || source.startsWith("drizzle-orm/")) return "DB のパッケージ";
  if (!resolvedRel) return null;
  if (/^src\/features\/.+\/services(\/|$)/.test(resolvedRel)) return "features の services";
  if (resolvedRel === "src/lib/drizzle" || resolvedRel.startsWith("src/lib/drizzle/") || /^src\/lib\/drizzle\.(ts|mts|mjs)$/.test(resolvedRel)) return "src/lib/drizzle";
  return null;
}

const CLIENT_ENTRY = "src/featureGate/client.ts";

/** client の入口だけの落とす先(client は規則を評価せず server が渡した値だけを読む: D5)。理由か null */
export function forbiddenForClient(resolvedRel) {
  if (!resolvedRel) return null;
  const bare = resolvedRel.replace(/\.(ts|tsx|mts|mjs|js)$/, "");
  if (bare.startsWith("src/featureGate/rules/")) return "門番の規則(client は規則を評価しない)";
  if (bare === "src/featureGate/extensions/rules") return "門番の規則の一覧(client は規則を評価しない)";
  if (bare === "src/featureGate/evaluate" || bare === "src/featureGate/clientState") return "門番の評価(client は規則を評価しない)";
  if (bare === "src/config" || bare.startsWith("src/config/")) return "config(client は規則の値を読まない)";
  return null;
}

const completeFile = (root, rel) => {
  const base = join(root, rel);
  const candidates = [base, ...[".ts", ".tsx", ".mts", ".mjs", ".js"].map((e) => base + e), ...["index.ts", "index.tsx", "index.mjs"].map((f) => join(base, f))];
  return candidates.find((c) => existsSync(c) && statSync(c).isFile()) ?? null;
};

/**
 * 入口から値の import をたどり、落とす先に届いた鎖を返す
 * @param {string} root リポジトリ直下
 * @param {string[]} entries 入口(root 相対)
 * @returns {string[]} problems(入口 → … → 先: 理由)
 */
export function findForbiddenReach(root, entries) {
  const problems = [];
  for (const entry of entries) {
    const seen = new Set();
    const queue = [{ file: join(root, entry), chain: [entry] }];
    while (queue.length > 0) {
      const { file, chain } = queue.shift();
      if (seen.has(file)) continue;
      seen.add(file);
      for (const source of valueImportSources(readFileSync(file, "utf8"))) {
        const resolvedRel = resolveImport(source, file, root);
        const reason = forbiddenTarget(source, resolvedRel) ?? (entry === CLIENT_ENTRY ? forbiddenForClient(resolvedRel) : null);
        if (reason) {
          problems.push(`${[...chain, resolvedRel ?? source].join(" → ")}: ${reason}`);
          continue;
        }
        if (!resolvedRel) continue;
        const next = completeFile(root, resolvedRel);
        if (next) queue.push({ file: next, chain: [...chain, toPosix(relative(root, next))] });
      }
    }
  }
  return problems;
}

test("実リポ: 門番の入口(index.ts・client.ts)はデータの層・Node 専用の物に届かない。client.ts は規則・評価・config にも届かない", () => {
  for (const entry of ENTRIES) assert.ok(existsSync(join(ROOT, entry)), `${entry} が無い`);
  const problems = findForbiddenReach(ROOT, ENTRIES);
  assert.deepEqual(problems, [], `門番の入口から届いてはいけない先:\n${problems.join("\n")}`);
});

/** 一時リポ: tsconfig の @/* と、入口 → 規則 → (渡した中身) */
function fixture(ruleBody, extra = {}) {
  const root = mkdtempSync(join(tmpdir(), "gate-reach-"));
  writeFileSync(join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@/*": ["./src/*"] } } }));
  const files = {
    "src/featureGate/index.ts": 'import { rules } from "./extensions/rules";\nexport const gate = { rules };\n',
    "src/featureGate/client.ts": "export const clientTools = {};\n",
    "src/featureGate/extensions/rules.ts": 'import type { X } from "@/featureGate/types";\nimport { rule as rules_a } from "@/featureGate/rules/a";\nexport const rules = [rules_a];\n',
    "src/featureGate/rules/a.ts": ruleBody,
    "src/config/app.ts": "export const FLAG = true;\n",
    "src/features/core/wallet/services/server/walletService.ts": "export const walletService = {};\n",
    "src/features/core/wallet/entities/model.ts": "export type Wallet = {};\n",
    "src/lib/drizzle/index.ts": "export const db = {};\n",
    ...extra,
  };
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

test("fixture: 規則が config だけを読むなら通り、型だけの import は数えない", () => {
  const ok = fixture('import { FLAG } from "@/config/app";\nimport type { Wallet } from "@/features/core/wallet/entities/model";\nimport { type W } from "@/features/core/wallet/services/server/walletService";\nexport const rule = { enabled: () => FLAG };\n');
  assert.deepEqual(findForbiddenReach(ok, ENTRIES), []);
});

test("fixture: services・drizzle・server-only・node: のどれに届いても落ちる(鎖を示す)", () => {
  const cases = {
    services: ['import { walletService } from "@/features/core/wallet/services/server/walletService";\n', /features の services/],
    drizzle: ['import { db } from "../../lib/drizzle";\n', /src\/lib\/drizzle/],
    serverOnly: ['import "server-only";\n', /server-only/],
    node: ['const fs = await import("node:fs");\n', /Node 組み込み/],
  };
  for (const [name, [body, reason]] of Object.entries(cases)) {
    const problems = findForbiddenReach(fixture(`${body}export const rule = {};\n`), ENTRIES);
    assert.equal(problems.length, 1, `${name}: ${problems.join("\n")}`);
    assert.match(problems[0], /^src\/featureGate\/index\.ts → src\/featureGate\/extensions\/rules\.ts → src\/featureGate\/rules\/a\.ts → /);
    assert.match(problems[0], reason);
  }
  // client.ts からの鎖も見る
  const viaClient = fixture("export const rule = {};\n", { "src/featureGate/client.ts": 'export { x } from "./tools/client/x";\n', "src/featureGate/tools/client/x.ts": 'import "server-only";\nexport const x = 1;\n' });
  assert.match(findForbiddenReach(viaClient, ENTRIES)[0] ?? "", /^src\/featureGate\/client\.ts → src\/featureGate\/tools\/client\/x\.ts → server-only: server-only/);
});

test("fixture: client.ts から規則・評価・config に届くと落ちる(index.ts からは通る)", () => {
  const cases = {
    rules: ['export { rules } from "./extensions/rules";\n', /門番の規則の一覧/],
    evaluate: ['export { isFeatureEnabled } from "./evaluate";\n', /門番の評価/],
    config: ['import { FLAG } from "@/config/app";\nexport const x = FLAG;\n', /config/],
  };
  for (const [name, [body, reason]] of Object.entries(cases)) {
    const root = fixture("export const rule = {};\n", { "src/featureGate/client.ts": body, "src/featureGate/evaluate.ts": "export const isFeatureEnabled = () => true;\n" });
    const problems = findForbiddenReach(root, ENTRIES);
    assert.equal(problems.length, 1, `${name}: ${problems.join("\n")}`);
    assert.match(problems[0], /^src\/featureGate\/client\.ts → /);
    assert.match(problems[0], reason);
  }
});
