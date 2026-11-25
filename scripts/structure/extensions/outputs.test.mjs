// 生成器 extensions の書く物と、出力の宣言(./phase.json の outputs)が同じかの検査(domain の tests/outputs.test.mjs と同じ形)。
// 宣言は受け口の一覧 intake.txt の generated の行の元(D309): 漏れると、fork が項目を差して生成し直したファイルが
// 所有の検査で受け口の外の違反になる(src/wiring/startup.ts の漏れ、受信箱 20261125-095708)。
// 宣言は上流の物なので Tier1 だけで見る: fork が自分の lib に wire を書けば src/wiring/<lib>.ts が増える(fork の物で、宣言は要らない)
// 実行: pnpm test scripts/structure/extensions/outputs.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { isTier1Repo, matchIntake } from "../../../src/lib/forkOwnership/node.mjs";
import { planExtensions } from "./extensions.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
const tier1Only = { skip: isTier1Repo(repoRoot) ? false : "出力の宣言は上流の物(fork の wire が足すファイルは宣言に無くてよい、Tier1 だけ)" };

/** @type {{ glob: string, kind: string }[]} */
const outputs = JSON.parse(readFileSync(join(here, "phase.json"), "utf8")).outputs;
const rulesOf = (/** @type {{ glob: string }[]} */ entries) => entries.map((entry) => ({ kind: "generated", glob: entry.glob, exclude: false }));

test("生成器の書く物は、どれも出力の宣言の every-run の行に当たる", tier1Only, () => {
  const written = Object.keys(planExtensions(repoRoot).outputs);
  assert.ok(written.length > 0, "書く物が 1 つも無い");
  const everyRun = rulesOf(outputs.filter((entry) => entry.kind === "every-run"));
  assert.deepEqual(
    written.filter((path) => matchIntake(everyRun, path) === null).sort(),
    [],
    "phase.json の outputs に行を足す(受け口の一覧の generated の行はそこから生成される)",
  );
});

test("出力の宣言のどの行も、生成器の書く物のどれかに当たる(書かなくなった行を残さない)", tier1Only, () => {
  const written = Object.keys(planExtensions(repoRoot).outputs);
  const unused = outputs.filter((entry) => !written.some((path) => matchIntake(rulesOf([entry]), path) !== null));
  assert.deepEqual(unused.map((entry) => entry.glob), []);
});
