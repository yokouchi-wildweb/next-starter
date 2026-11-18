// scripts/structure/domain/tests/generatedMark.test.mjs
// 毎回上書きの出力(file)に生成物の印が 1 か所で入ること。実行: pnpm test scripts/structure/domain/tests/generatedMark.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { dir, file, GENERATED_MARK, patch, withGeneratedMark, writeOnce } from "../render/output.mjs";

test("file(): 先頭の // <パス> の行の次に印の 1 行(\"use client\" より前)", () => {
  const out = file("/repo/src/features/a/hooks/useA.ts", '// src/features/a/hooks/useA.ts\n\n"use client";\n');
  assert.deepEqual(out.content.split("\n").slice(0, 4), ["// src/features/a/hooks/useA.ts", `// ${GENERATED_MARK}`, "", '"use client";']);
});

test("file(): パスの行が無ければ先頭、.css は /* */、注釈を持てない形式はそのまま", () => {
  assert.ok(file("/r/a.tsx", "export {}\n").content.startsWith(`// ${GENERATED_MARK}\nexport {}`));
  assert.ok(file("/r/a.css", ".x{}\n").content.startsWith(`/* ${GENERATED_MARK} */\n`));
  assert.equal(file("/r/a.json", "{}\n").content, "{}\n");
});

test("印は二重にしない・write-once と dir と patch には入れない", () => {
  const once = withGeneratedMark("/r/a.ts", "// src/a.ts\nx\n");
  assert.equal(withGeneratedMark("/r/a.ts", once), once);
  assert.ok(!writeOnce("/r/s.ts", "// src/s.ts\nx\n").content.includes(GENERATED_MARK));
  assert.equal(dir("/r/d").content, undefined);
  assert.equal(patch("/r/p.ts", () => ({})).content, undefined);
});
