// scripts/operations/data/data.test.ts — pnpm test scripts/operations/data
// pnpm ops data の部品(DB を使わない): JSON Lines の往復(型・配列・jsonb・null・Date)、引数、ファイルの確かめ、止める鍵。
// 実 DB での export → import の往復は roundtrip.db.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";

import { checkIds, checkRecords, DataUsageError, domainArg, idsOfDeleteInput, MAX_DATA_ROWS } from "./lib.args";
import { parseJsonLines, toJsonLine } from "./lib.jsonl";
import { contentHash, dataRunName, dataStopKey } from "./lib.run";

test("JSON Lines の往復: 数値・真偽・null・配列・入れ子の jsonb・Date(入れ子も)がぴったり戻る", () => {
  const record = {
    id: "11111111-1111-4111-8111-111111111111",
    n: 3,
    f: 1.5,
    ok: false,
    none: null,
    tags: ["a", "b"],
    meta: { nested: { x: [1, { y: null }] }, at: new Date("2026-11-08T01:02:03.004Z") },
    at: new Date("2026-01-01T00:00:00.000Z"),
    date: "2026-11-08",
  };
  const line = toJsonLine(record);
  assert.equal(line.includes("\n"), false, "1 行");
  const [back] = parseJsonLines(`${line}\n\n`);
  assert.deepEqual(back, record);
  assert.ok(back.at instanceof Date);
});

test("JSON Lines の誤り: 読めない行・オブジェクトでない行を行番号つきで全部並べる", () => {
  assert.throws(() => parseJsonLines('{"a":1}\nnot json\n[1,2]\n'), (error: Error) => /2 行目: JSON として読めません/.test(error.message) && /3 行目: 1 行 1 件のオブジェクトではありません/.test(error.message));
});

test("引数: ドメインは最初の旗でない語(値を取る旗の値は飛ばす)", () => {
  assert.equal(domainArg(["--file", "x.jsonl", "sample", "--dry-run"], "u"), "sample");
  assert.equal(domainArg(["--env", "production", "user"], "u"), "user");
  assert.throws(() => domainArg(["--dry-run"], "u"), DataUsageError);
});

test("ファイルの確かめ: 空・上限超え・update は id と変える列が要る・id の重なり", () => {
  assert.deepEqual(checkRecords("import", []), ["ファイルに 1 件もありません"]);
  assert.match(checkRecords("import", Array.from({ length: MAX_DATA_ROWS + 1 }, () => ({})))[0], /までです/);
  assert.deepEqual(checkRecords("import", [{ name: "a" }, { id: "x", name: "b" }]), [], "import は id なしでよい");
  assert.match(checkRecords("import", [{ id: "x" }, { id: "x" }]).join(), /重なっています/);
  const update = checkRecords("update", [{ name: "a" }, { id: "y" }]);
  assert.match(update.join("\n"), /1 件目: id がありません/);
  assert.match(update.join("\n"), /2 件目: 変える列がありません/);
  assert.deepEqual(checkIds(["a", "b"]), []);
});

test("delete の id: --ids か --file(1 行 1 id か { id }、# と空行を飛ばす)、両方・無しは止める", () => {
  assert.deepEqual(idsOfDeleteInput(["--ids", "a,b"], () => ""), ["a", "b"]);
  assert.deepEqual(idsOfDeleteInput(["--file", "f"], () => '# c\na\n\n{"id":"b","name":"x"}\n'), ["a", "b"]);
  assert.throws(() => idsOfDeleteInput(["--ids", "a", "--file", "f"], () => ""), /どちらか一方/);
  assert.throws(() => idsOfDeleteInput([], () => ""), /どちらか一方/);
});

test("記録の名前と止める鍵: data:<command>:<domain>(:<中身の sha256>)。中身が違えば別の鍵", () => {
  assert.equal(dataRunName("update", "sample"), "data:update:sample");
  assert.equal(dataStopKey("update", "sample", "x"), `data:update:sample:${contentHash("x")}`);
  assert.notEqual(dataStopKey("update", "sample", "x"), dataStopKey("update", "sample", "y"));
  assert.notEqual(dataStopKey("update", "sample", "x"), dataStopKey("import", "sample", "x"));
});
