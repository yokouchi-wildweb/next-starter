// 出力の種類のデータ(../outputs.json)と生成器の実際の書き込みが同じかの検査(種類の唯一の元はデータ。pnpm workflow ownership who が読む)。
// このリポの全ドメイン(generate: false を除く。sample 系が全カテゴリ・関係・並べ替え・画像の集まりを持つ)を、全カテゴリを on にして組み立て(何も書かない)、
// file の Output は every-run の 1 行に、writeOnce は write-once の 1 行に当たり、データのどの行もどれかの出力に当たることを見る。
// 実行: pnpm test scripts/structure/domain/tests/outputs.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { DOMAIN_OUTPUTS_FILE, matchDomainOutput, parseDomainOutputs } from "../../../../src/lib/districtMap/domainOutputs.mjs";
import { createWorkspace } from "../domain/workspace.mjs";
import { loadDomainForGenerate } from "../pipeline/generate.mjs";
import { collectionChildrenOf, resolvePairs } from "../pipeline/pairs.mjs";
import { planDomain } from "../pipeline/plan.mjs";
import { ALL_GENERATE_OPTIONS, isHandManaged } from "../spec/categories.mjs";
import { repoRoot } from "./helpers.mjs";

const SILENT = { log() {}, warn() {} };
const KIND_OF = { file: "every-run", writeOnce: "write-once" };
const { outputs, problems } = parseDomainOutputs(fs.readFileSync(path.join(repoRoot, DOMAIN_OUTPUTS_FILE), "utf8"));

/** そのリポの全ドメインの書く物(種類つき、リポジトリ直下からの相対)と、ドメインの { dir, plural } */
function plannedWrites(root) {
  const workspace = createWorkspace(root);
  const pairs = resolvePairs(workspace);
  const writes = [];
  for (const name of workspace.listDomains()) {
    const ctx = loadDomainForGenerate(workspace, name, SILENT);
    if (isHandManaged(ctx.config)) continue;
    ctx.collectionChildren = collectionChildrenOf(workspace, pairs, name);
    const domain = { dir: ctx.rel, plural: ctx.config?.plural };
    for (const out of planDomain(ctx, workspace, ALL_GENERATE_OPTIONS)) {
      if (!KIND_OF[out.kind]) continue;
      writes.push({ path: path.relative(root, out.path).split(path.sep).join("/"), kind: KIND_OF[out.kind], domain });
    }
  }
  return writes;
}

test("outputs.json の書式", () => {
  assert.deepEqual(problems, []);
  assert.ok(outputs.length > 0);
});

test("生成器の書く物は、どれもデータの同じ種類の行に当たる(種類の元はデータ)", () => {
  const writes = plannedWrites(repoRoot);
  assert.ok(writes.length > 0, "書く物が 1 つも無い(全ドメインが generate: false?)");
  const wrong = writes.flatMap((write) => {
    const hit = matchDomainOutput(write.path, outputs, [write.domain]);
    if (!hit) return [`${write.path}(${write.kind}): データに無い。${DOMAIN_OUTPUTS_FILE} に行を足す`];
    return hit.entry.kind === write.kind ? [] : [`${write.path}: 生成器は ${write.kind}、データは ${hit.entry.kind}(${hit.entry.glob})`];
  });
  assert.deepEqual(wrong, []);
});

test("データのどの行も、生成器の書く物のどれかに当たる(書かなくなった行を残さない)", () => {
  const writes = plannedWrites(repoRoot);
  const unused = outputs.filter((entry) => !writes.some((write) => matchDomainOutput(write.path, [entry], [write.domain])));
  assert.deepEqual(unused.map((entry) => entry.glob), []);
});
