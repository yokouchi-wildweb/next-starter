// .notices/20261123-192409-cc-cache-standard.search-limit.mjs のテスト(区切り cc-cache-standard の notice の codemod)
import assert from "node:assert/strict";
import { test } from "node:test";

import { TARGET, rewrite } from "./20261123-192409-cc-cache-standard.search-limit.mjs";

test("rewrite: 引数なし・一行・複数行の object literal に limit: 100、limit のある物はそのまま", () => {
  const src = [
    "const a = await walletService.search();",
    'const b = await base.search({ where: { field: "x", op: "eq", value: 1 } });',
    "const c = await base.searchWithDeleted({",
    '  where: { field: "id", op: "in", value: ids },',
    "});",
    "const d = await base.search({ where, limit: 1 });",
    "const e = await base.searchForSorting({});",
    "",
  ].join("\n");
  const r = rewrite(src);
  assert.deepEqual(r.changed, [1, 2, 3, 7]);
  assert.deepEqual(r.stopped, []);
  assert.equal(
    r.text,
    [
      "const a = await walletService.search({ limit: 100 });",
      'const b = await base.search({ where: { field: "x", op: "eq", value: 1 }, limit: 100 });',
      "const c = await base.searchWithDeleted({",
      '  where: { field: "id", op: "in", value: ids },',
      "  limit: 100,",
      "});",
      "const d = await base.search({ where, limit: 1 });",
      "const e = await base.searchForSorting({ limit: 100 });",
      "",
    ].join("\n"),
  );
  assert.deepEqual(rewrite(r.text).changed, [], "2 回目は変更 0");
});

test("rewrite: 受け流し・展開は止める、client・文字列の search・コメントは触らない", () => {
  const src = [
    "const a = await base.search(params);",
    "const b = await base.search({ ...rest, where });",
    "const c = await userClient.search({ page });",
    "const d = href.search(/[?#]/);",
    "// base.search() の例",
    "",
  ].join("\n");
  const r = rewrite(src);
  assert.deepEqual(r.changed, []);
  assert.deepEqual(r.stopped.map((s) => s.line), [1, 2]);
  assert.equal(r.text, src);
});

test("rewrite: use client のファイルは触らない", () => {
  const src = '"use client";\nconst a = await base.search();\n';
  assert.equal(rewrite(src).text, src);
});

test("TARGET: src の ts・tsx・mts", () => {
  assert.ok(TARGET.test("src/app/a/_screen/loader.ts"));
  assert.ok(!TARGET.test("scripts/a.ts"));
});
