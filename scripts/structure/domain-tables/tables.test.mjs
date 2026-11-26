// 照らしの検査(段 ship の check): entity.json を持つ Neon の登録ごとに、宣言から生成器で組んだ表と今の表を読み込んで値で比べる。
// 違いは「宣言か表のどちらが正しいか」を決めて片方を直す(README.md)。実行: pnpm check domain-tables
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

import { diffTableFacts, tableFactsOf } from "./facts.mjs";
import { actualTable, expectedTable, makeTempDir, missingDbObjects, registrationsToMatch } from "./tables.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const tempDir = makeTempDir();
after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

const registrations = registrationsToMatch(repoRoot);

if (registrations.length === 0) {
  test("照らす登録なし(entity.json を持つ Neon の登録が無い)", () => {});
}

for (const registration of registrations) {
  test(`${registration.dir}: 宣言と今の表 ${registration.table} が同じ`, async () => {
    assert.deepEqual(registration.problems, [], "entity.json の問題を先に直す");
    const actual = await actualTable(repoRoot, registration.table);
    assert.ok(actual, `今の表 "${registration.table}" がどのドメインの定義にも無い(table・plural を確かめる)`);
    const expected = await expectedTable(repoRoot, registration, tempDir);
    assert.deepEqual([...diffTableFacts(tableFactsOf(expected), tableFactsOf(actual)), ...missingDbObjects(repoRoot, registration)], []);
  });
}
