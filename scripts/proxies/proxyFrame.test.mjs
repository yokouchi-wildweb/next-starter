// scripts/proxies/proxyFrame.test.mjs
// proxy の枠(src/proxies/<名前>[.<fork ID>].ts の走査と生成一覧)の回帰テスト。一時ディレクトリに置いたファイルで動かす。
// - 項目 = export const handler / decorator を 1 つ持つ直下の .ts、骨組み・枠・テスト・サブフォルダ・.mjs は見ない
// - 並びはファイル名の順、上流(印なし)と fork(宣言済みの fork ID)が同じ枠に入る
// - 失敗: 宣言に無い fork ID / 両方 / どちらも無い / 名前の形 / 一覧のずれ
// - 実リポの一覧が項目と一致する(pnpm proxy:check と同じ)
// 実行: pnpm test:proxy-frame

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { readDeclaredForkIds } from "../../src/lib/forkOwnership/forkIds.mjs";

import {
  DECORATORS_FILE,
  HANDLERS_FILE,
  SKELETON_FILES,
  discoverProxyItems,
  renderProxyLists,
  staleProxyLists,
} from "./extensions.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** 骨組み + 渡したファイルを置いた一時リポ */
function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), "proxy-frame-"));
  const dir = join(root, "src/proxies");
  mkdirSync(join(dir, "extensions"), { recursive: true });
  for (const name of [...SKELETON_FILES, "index.ts", "types.ts"]) writeFileSync(join(dir, name), "export const somethingProxy = () => {};\n");
  writeFileSync(join(dir, "pathPattern.mjs"), "export const x = 1;\n");
  writeFileSync(join(dir, "proxy.test.mts"), "export const handler = 1;\n");
  writeFileSync(join(dir, "extensions/other.ts"), "export const handler = 1;\n");
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  return root;
}

const H = "export const handler: ProxyHandler = async (request, ctx) => {};\n";
const D = "export const decorator: ProxyResponseDecorator = (request, response, ctx) => {};\n";

test("走査: 直下の .ts の handler / decorator だけをファイル名順に集め、骨組み・枠・テスト・サブフォルダ・.mjs は見ない", () => {
  const root = fixture({ "zeta.acme.ts": H, "alpha.ts": H, "beta.parent.ts": D, "gamma.acme.ts": D });
  const { items, problems } = discoverProxyItems(root, ["acme", "parent"]);
  assert.deepEqual(problems, []);
  assert.deepEqual(
    items.map((i) => `${i.kind}:${i.file}:${i.forkId}`),
    ["handler:alpha.ts:null", "decorator:beta.parent.ts:parent", "decorator:gamma.acme.ts:acme", "handler:zeta.acme.ts:acme"],
  );

  const lists = renderProxyLists(items);
  assert.match(lists[HANDLERS_FILE], /import \{ handler as alpha \} from "\.\.\/alpha";\nimport \{ handler as zeta_acme \} from "\.\.\/zeta\.acme";/);
  assert.match(lists[HANDLERS_FILE], /export const extensionHandlers: ProxyHandler\[\] = \[\n  alpha,\n  zeta_acme,\n\];/);
  assert.match(lists[DECORATORS_FILE], /export const extensionDecorators: ProxyResponseDecorator\[\] = \[\n  beta_parent,\n  gamma_acme,\n\];/);
});

test("失敗: 宣言に無い fork ID・両方・どちらも無い・名前の形", () => {
  const root = fixture({
    "a.other.ts": H,
    "both.ts": H + D,
    "helper.ts": "export function helper() {}\n",
    "x.a.b.ts": H,
    "ok.acme.ts": H,
  });
  const { items, problems } = discoverProxyItems(root, ["acme"]);
  assert.deepEqual(items.map((i) => i.file), ["ok.acme.ts"]);
  assert.equal(problems.length, 4, problems.join("\n"));
  assert.ok(problems.some((p) => p.includes("a.other.ts") && p.includes("宣言されていない")));
  assert.ok(problems.some((p) => p.includes("both.ts") && p.includes("両方")));
  assert.ok(problems.some((p) => p.includes("helper.ts") && p.includes("無い")));
  assert.ok(problems.some((p) => p.includes("x.a.b.ts") && p.includes("名前の形")));
});

test("check: 一覧が無い・古いとずれ、作り直すと一致", () => {
  const root = fixture({ "alpha.ts": H });
  const { items } = discoverProxyItems(root, []);
  const expected = renderProxyLists(items);
  assert.deepEqual(staleProxyLists(root, expected).sort(), [DECORATORS_FILE, HANDLERS_FILE].sort());
  for (const [path, content] of Object.entries(expected)) writeFileSync(join(root, path), content);
  assert.deepEqual(staleProxyLists(root, expected), []);
  writeFileSync(join(root, HANDLERS_FILE), expected[HANDLERS_FILE].replace("alpha,", ""));
  assert.deepEqual(staleProxyLists(root, expected), [HANDLERS_FILE]);
});

test("実リポ: 走査の問題が無く、生成一覧が項目と一致する(ずれたら pnpm proxy:generate)", () => {
  const { all: forkIds, errors } = readDeclaredForkIds(repoRoot);
  assert.deepEqual(errors, []);
  const { items, problems } = discoverProxyItems(repoRoot, forkIds);
  assert.deepEqual(problems, [], problems.join("\n"));
  assert.deepEqual(staleProxyLists(repoRoot, renderProxyLists(items)), []);
});
