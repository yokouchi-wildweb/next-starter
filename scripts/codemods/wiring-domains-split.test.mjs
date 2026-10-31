// scripts/codemods/wiring-domains-split.test.mjs
// 実行: pnpm test:codemods

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { run, transformSource } from "./wiring-domains-split.mjs";

test("名前ごとに振り分ける(混在は 2 行、型も)", () => {
  const { text, skipped } = transformSource(`import { getService, adminListParts, type AdminEditScreenProps, type DomainX as Y } from "@/wiring/domains";\n`);
  assert.equal(
    text,
    `import { getService, type DomainX as Y } from "@/wiring/domainRegistry";\nimport { adminListParts, type AdminEditScreenProps } from "@/wiring/adminScreenParts";\n`,
  );
  assert.deepEqual(skipped, []);
});

test("import type・複数行・export from", () => {
  const { text } = transformSource(`import type {\n  AdminListScreenProps,\n} from "@/wiring/domains";\nexport { getService } from "@/wiring/domains";\n`);
  assert.equal(text, `import type { AdminListScreenProps } from "@/wiring/adminScreenParts";\nexport { getService } from "@/wiring/domainRegistry";\n`);
});

test("動的 import は分割代入の名前で決める", () => {
  const { text } = transformSource(`const { lookupDomainService } = await import("@/wiring/domains");\n`);
  assert.equal(text, `const { lookupDomainService } = await import("@/wiring/domainRegistry");\n`);
});

test("読めない形は書き換えず一覧へ", () => {
  const source = `import * as domains from "@/wiring/domains";\nconst { getService, adminListParts } = await import("@/wiring/domains");\nconst m = import("@/wiring/domains");\n`;
  const { text, skipped } = transformSource(source);
  assert.equal(text, source);
  assert.equal(skipped.length, 3);
});

test("run: 呼び出したリポの src、何度走らせても同じ", () => {
  const root = mkdtempSync(join(tmpdir(), "codemod-"));
  try {
    const path = join(root, "src/app/a/_screen/loader.ts");
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `import { adminSortParts } from "@/wiring/domains";\n`);
    assert.deepEqual(run(root).changed, ["src/app/a/_screen/loader.ts"]);
    assert.equal(readFileSync(path, "utf8"), `import { adminSortParts } from "@/wiring/adminScreenParts";\n`);
    assert.deepEqual(run(root), { changed: [], skipped: [] });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
