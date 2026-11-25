// 生成物の印(1 行目の「生成物・編集不可: pnpm generate <target> …」)を持つファイルは、どれかの生成器の出力の宣言
// (scripts/structure/*/phase.json・scripts/workflow/*/phase.json の outputs)に当たる、の検査(全部の生成器)。
// 宣言は受け口の一覧 intake.txt の generated の行の元(D309): 宣言に無い生成物は、fork が生成し直すと所有の検査の違反になる。
// 宣言は上流の物なので Tier1 だけで見る(fork の lib・ドメインが足す生成物は fork の物で、宣言は要らない)
// 実行: pnpm test scripts/runner/phases/generatedMarks.test.mjs
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { isTier1Repo, matchIntake } from "../../../src/lib/forkOwnership/node.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const tier1Only = { skip: isTier1Repo(repoRoot) ? false : "出力の宣言は上流の物(fork が足す生成物は宣言に無くてよい、Tier1 だけ)" };

/** 生成物の印: 1 行目の注釈の頭が「生成物・編集不可」(印の説明を書いた注釈 = このファイルの 1 行目は当てない) */
const GENERATED_MARK = /^\s*(?:\/\/|#|\/\*|<!--|\{\/\*)?\s*生成物・編集不可/;

/** 全部の生成器の outputs の glob */
function declaredGlobs() {
  const globs = [];
  for (const kind of ["structure", "workflow"]) {
    const base = join(repoRoot, "scripts", kind);
    for (const name of readdirSync(base)) {
      const file = join(base, name, "phase.json");
      if (!existsSync(file)) continue;
      for (const entry of JSON.parse(readFileSync(file, "utf8")).outputs ?? []) globs.push(entry.glob);
    }
  }
  return globs;
}

test("生成物の印を持つファイルは、どれも生成器の出力の宣言に当たる", tier1Only, () => {
  const rules = declaredGlobs().map((glob) => ({ kind: "generated", glob, exclude: false }));
  const files = execFileSync("git", ["ls-files", "-z"], { cwd: repoRoot, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).split("\0").filter(Boolean);
  const marked = files.filter((path) => {
    const abs = join(repoRoot, path);
    if (!existsSync(abs) || !statSync(abs).isFile()) return false; // 消したファイル・サブモジュールの入口は読まない
    const first = readFileSync(abs, "utf8").slice(0, 400).split("\n", 1)[0] ?? "";
    return GENERATED_MARK.test(first);
  });
  assert.ok(marked.length > 0, "生成物の印のファイルが 1 つも無い(印の形が変わった?)");
  assert.deepEqual(
    marked.filter((path) => matchIntake(rules, path) === null).sort(),
    [],
    "その生成器の phase.json の outputs に行を足す(受け口の一覧の generated の行はそこから生成される)",
  );
});
