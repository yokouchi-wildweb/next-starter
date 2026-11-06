// .notices/20261101-121000-domain-display-client.domain-json-client-display.test.mjs
// 実行: pnpm test .notices

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { run, transformSource } from "./20261101-121000-domain-display-client.domain-json-client-display.mjs";

const displayOf = (specifier) => (specifier.includes("/none/") ? null : specifier.replace("domain.json", "entities/display"));

test("Header の形: normalize と import を消し、名前を差し替える", () => {
  const source = `"use client";
import { normalizeDomainJsonConfig } from "@/lib/domain/definition/normalizeDomainJsonConfig";
import rawConfig from "@/features/foo/domain.json";

const config = normalizeDomainJsonConfig(rawConfig);
import { domainDisplay as fooDisplay } from "@/features/foo/entities/display";
const hasSearch = Array.isArray(config.searchFields) && config.searchFields.length > 0;
const a = "useImportExport" in config && config.useImportExport === true;
`;
  const { text, skipped } = transformSource(source, displayOf);
  assert.deepEqual(skipped, []);
  assert.doesNotMatch(text, /domain\.json|normalizeDomainJsonConfig|\bconfig\b/);
  assert.match(text, /Array\.isArray\(fooDisplay\.searchFields\)/);
  assert.match(text, /"useImportExport" in fooDisplay && fooDisplay\.useImportExport === true/);
  assert.equal(text.match(/entities\/display/g).length, 1, "既にある写しの import を使う");
});

test("丸ごとの受け口と shorthand の config", () => {
  const source = `import config from "@/features/foo/domain.json";
const a = buildFormDefaultValues(config);
const c = buildDomainColumns({
  config,
  presenters,
});
const d = useRelationOptions(config);
const e = (config as any).fieldGroups;
`;
  const { text, skipped } = transformSource(source, displayOf);
  assert.deepEqual(skipped, []);
  assert.match(text, /import \{ domainDisplay as fooDisplay \} from "@\/features\/foo\/entities\/display";/);
  assert.match(text, /buildFormDefaultValues\(fooDisplay\)/);
  assert.match(text, /^  config: fooDisplay,$/m);
  assert.match(text, /\(fooDisplay as any\)\.fieldGroups/);
});

test("冪等: 置き換え後のファイルは変わらない", () => {
  const { text } = transformSource(`import domainConfig from "@/features/foo/domain.json";\nconst p = domainConfig.plural;\n`, displayOf);
  assert.equal(transformSource(text, displayOf).text, text);
  assert.deepEqual(transformSource(text, displayOf).skipped, []);
});

test("別のものの同じ綴りは触らない: プロパティ・キー・文字列・コメント", () => {
  const source = `import config from "@/features/foo/domain.json";
// config はコメント
const a = other.config;
const a2 = other?.config;
const b = { config: other };
const c = "config";
const d = config.plural;
`;
  const { text, skipped } = transformSource(source, displayOf);
  assert.deepEqual(skipped, []);
  assert.match(text, /\/\/ config はコメント/);
  assert.match(text, /other\.config/);
  assert.match(text, /other\?\.config/);
  assert.match(text, /\{ config: other \}/);
  assert.match(text, /"config"/);
  assert.match(text, /const d = fooDisplay\.plural/);
});

for (const [title, source, reason] of [
  ["写しに無いキー", `import c from "@/features/foo/domain.json";\nconst a = c.defaultOrderBy;\n`, /defaultOrderBy/],
  ["写しに無いキー(any 越し)", `import c from "@/features/foo/domain.json";\nconst a = (c as any).forkOnlyKey;\n`, /forkOnlyKey/],
  ["写しに無いキー(in)", `import c from "@/features/foo/domain.json";\nconst a = "forkOnlyKey" in c;\n`, /forkOnlyKey/],
  ["写しに無い field の項目", `import c from "@/features/foo/domain.json";\nconst a = c.fields.map((f) => f.uploadPath);\n`, /uploadPath/],
  ["外へ丸ごと渡す", `import c from "@/features/foo/domain.json";\nconst a = forkHelper(c);\n`, /写しの外/],
  // 指令 20261103-103348: import を消して `...config` が残り型検査が通らないファイルになっていた
  ["spread で丸ごと展開する", `import config from "@/features/foo/domain.json";\nconst x = { ...config, tableFields: config.tableFields };\n`, /丸ごと展開している\(\.\.\.config\)/],
  ["spread(normalize の別名)", `import c from "@/features/foo/domain.json";\nconst n = normalizeDomainJsonConfig(c);\nconst x = { ... n };\n`, /丸ごと展開している\(\.\.\.n\)/],
  ["typeof", `import c from "@/features/foo/domain.json";\ntype A = typeof c;\n`, /写しの外/],
  ["写しが無いドメイン", `import c from "@/features/none/domain.json";\nconst a = c.plural;\n`, /写しが無い/],
  ["import()", `const c = await import("@/features/foo/domain.json");\n`, /import\(\)/],
  ["export from", `export { default } from "@/features/foo/domain.json";\n`, /import\(\)/],
]) {
  test(`書き換えない: ${title}`, () => {
    const result = transformSource(source, displayOf);
    assert.equal(result.text, source);
    assert.equal(result.skipped.length, 1);
    assert.match(result.skipped[0], reason);
  });
}

test("run: lint 規則と同じ判定で client だけ書き換え、2 回目は変更なし", () => {
  const root = mkdtempSync(join(tmpdir(), "codemod-"));
  const json = `import c from "@/features/foo/domain.json";\nconst p = c.plural;\n`;
  const files = {
    "src/features/foo/entities/display.ts": "export const domainDisplay = {};\n",
    "src/features/foo/domain.json": "{}\n",
    "src/features/foo/components/Part.tsx": json,
    "src/app/a/_components/Part.tsx": json,
    "src/app/a/_components/AScreen.tsx": json,
    "src/app/admin/(protected)/users/general/_components/loader.ts": json,
    "src/app/a/_screen/loader.ts": json,
    "src/features/foo/services/server/drizzleBase.ts": json,
    "src/features/foo/components/Part.test.ts": json,
    "src/features/_template/components/T.tsx": json,
  };
  try {
    writeFileSync(join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@/*": ["src/*"] } } }));
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), text);
    }
    const first = run(root);
    assert.deepEqual(first.changed.sort(), ["src/app/a/_components/Part.tsx", "src/features/foo/components/Part.tsx"]);
    assert.deepEqual(first.skipped, []);
    assert.match(readFileSync(join(root, "src/features/foo/components/Part.tsx"), "utf8"), /fooDisplay\.plural/);
    assert.equal(readFileSync(join(root, "src/app/a/_components/AScreen.tsx"), "utf8"), json);
    assert.deepEqual(run(root).changed, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
