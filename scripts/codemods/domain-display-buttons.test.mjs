// scripts/codemods/domain-display-buttons.test.mjs
// 実行: pnpm test:codemods

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { findDisplays, run, transformSource } from "./domain-display-buttons.mjs";

const displays = new Map([
  ["sample", "@/features/sample/entities/display"],
  ["userTag", "@/features/core/userTag/entities/display"],
]);

test("リテラルの domain を写しへ、import を最後の import の後へ", () => {
  const { text, skipped } = transformSource(
    `import { DeleteButton } from "@/lib/crud";\n\nexport const A = () => <DeleteButton domain="sample" id={d.id} />;\n`,
    displays,
  );
  assert.equal(
    text,
    `import { DeleteButton } from "@/lib/crud";\nimport { domainDisplay as sampleDisplay } from "@/features/sample/entities/display";\n\nexport const A = () => <DeleteButton domain={sampleDisplay} id={d.id} />;\n`,
  );
  assert.deepEqual(skipped, []);
});

test("複数行の属性・関数の属性の後ろ・snake_case", () => {
  const { text } = transformSource(
    `import { X } from "x";\nconst A = () => (\n  <EditButton\n    onSuccess={() => { go({ a: 1 }); }}\n    domain="user_tag"\n    id="1"\n  />\n);\n`,
    displays,
  );
  assert.match(text, /domain=\{userTagDisplay\}/);
  assert.match(text, /import \{ domainDisplay as userTagDisplay \} from "@\/features\/core\/userTag\/entities\/display";/);
});

test("何度走らせても同じ", () => {
  const once = transformSource(`import { X } from "x";\nconst A = () => <DeleteButton domain="sample" id="1" />;\n`, displays).text;
  const twice = transformSource(once, displays);
  assert.equal(twice.text, once);
  assert.deepEqual(twice.skipped, []);
});

test("動的な domain と写しの無いドメインは書き換えず一覧へ", () => {
  const source = `const A = ({ d }) => <><DeleteButton domain={d} id="1" /><EditButton domain="nope" id="1" /></>;\n`;
  const { text, skipped } = transformSource(source, displays);
  assert.equal(text, source);
  assert.deepEqual(skipped, [`<DeleteButton domain={d}>`, `<EditButton domain="nope">(写しが無い)`]);
});

test("ボタン以外の domain と href だけのボタンは触らない", () => {
  const source = `const A = () => <><Other domain="sample" /><CreateButton href="/x" /></>;\n`;
  const { text, skipped } = transformSource(source, displays);
  assert.equal(text, source);
  assert.deepEqual(skipped, []);
});

test("run: 呼び出したリポの src、ボタン本体と _template は対象外", () => {
  const root = mkdtempSync(join(tmpdir(), "codemod-"));
  try {
    const put = (path, text) => {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), text);
    };
    put("src/features/sample/entities/display.ts", "export const domainDisplay = {};\n");
    const call = `const A = () => <DeleteButton domain="sample" id="1" />;\n`;
    put("src/app/a.tsx", call);
    put("src/features/_template/b.tsx", call);
    put("src/lib/crud/components/Buttons/c.tsx", call);
    assert.deepEqual([...findDisplays(root)], [["sample", "@/features/sample/entities/display"]]);
    const { changed } = run(root);
    assert.deepEqual(changed, ["src/app/a.tsx"]);
    assert.equal(readFileSync(join(root, "src/features/_template/b.tsx"), "utf8"), call);
    assert.deepEqual(run(root).changed, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
