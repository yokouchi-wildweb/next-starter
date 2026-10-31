// scripts/codemods/crud-entry-split.test.mjs
// 実行: pnpm test:codemods

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { run, transformSource } from "./crud-entry-split.mjs";

test("ボタンだけ @/lib/crud/components へ、混在は 2 行、非 UI は触らない", () => {
  assert.equal(transformSource(`import { EditButton, type DeleteButtonProps } from "@/lib/crud";\n`).text, `import { EditButton, type DeleteButtonProps } from "@/lib/crud/components";\n`);
  assert.equal(transformSource(`import { createApiClient, EditButton } from "@/lib/crud";\n`).text, `import { createApiClient } from "@/lib/crud";\nimport { EditButton } from "@/lib/crud/components";\n`);
  const plain = `import {\n  type FieldPresenter,\n  formatDateValue,\n} from "@/lib/crud";\n`;
  assert.equal(transformSource(plain).text, plain);
});

test("読めない形は一覧へ", () => {
  const source = `import * as crud from "@/lib/crud";\n`;
  const { text, skipped } = transformSource(source);
  assert.equal(text, source);
  assert.equal(skipped.length, 1);
});

test("run: 何度走らせても同じ", () => {
  const root = mkdtempSync(join(tmpdir(), "codemod-"));
  try {
    const path = join(root, "src/a/b.tsx");
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `import { CreateButton } from "@/lib/crud";\n`);
    assert.deepEqual(run(root).changed, ["src/a/b.tsx"]);
    assert.equal(readFileSync(path, "utf8"), `import { CreateButton } from "@/lib/crud/components";\n`);
    assert.deepEqual(run(root), { changed: [], skipped: [] });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
