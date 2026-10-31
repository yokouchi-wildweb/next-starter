// scripts/registry/alpha/domainDisplay.test.mjs
// 実行: pnpm test:domain-display

import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { renderDomainDisplay, toDomainDisplay } from "./domainDisplay.mjs";
import { buildAlphaRegistries, staleAlphaRegistries } from "./index.mjs";

const FORBIDDEN = ["apiAccess", "dbEngine", "idType", "generateFiles", "storage", "indexes", "hiddenColumns", "onDelete", "slug", "collection", "validationRule", "defaultValue"];

function forbiddenKeys(value, found = []) {
  if (Array.isArray(value)) value.forEach((item) => forbiddenKeys(item, found));
  else if (value && typeof value === "object") {
    for (const [key, inner] of Object.entries(value)) {
      if (FORBIDDEN.includes(key)) found.push(key);
      // options の中身は表示の値
      if (key !== "options") forbiddenKeys(inner, found);
    }
  }
  return found;
}

test("全ドメインの写しに内部の項目が無く、ファイルが生成結果と一致する", () => {
  const { outputs, problems } = buildAlphaRegistries(process.cwd());
  assert.deepEqual(problems, []);
  const displays = Object.keys(outputs).filter((path) => path.endsWith("/entities/display.ts"));
  assert.ok(displays.length > 0);
  for (const path of displays) {
    const value = JSON.parse(/= (\{[\s\S]*\}) as const/.exec(outputs[path])[1]);
    assert.deepEqual(forbiddenKeys(value), [], path);
  }
  assert.deepEqual(staleAlphaRegistries(process.cwd(), outputs), []);
});

test("許可の一覧の項目だけを写す", () => {
  const display = toDomainDisplay({
    singular: "a", plural: "as", label: "A", dbEngine: "Neon", apiAccess: {}, futureSecret: "x",
    fields: [{ name: "local_password", label: "L", fieldType: "string", formInput: "textInput", storage: { read: "x" }, futureKey: 1, options: [{ value: 1, label: "一" }] }],
    relations: [{ domain: "b", label: "B", fieldName: "b_id", relationType: "belongsTo", onDelete: "RESTRICT", labelField: "title" }],
    searchFields: ["local_password"], useCreatedAt: true,
  });
  assert.deepEqual(display, {
    singular: "a", plural: "as", label: "A",
    fields: [{ name: "local_password", label: "L", fieldType: "string", formInput: "textInput", options: [{ value: 1, label: "一" }] }],
    relations: [{ domain: "b", label: "B", fieldName: "b_id", relationType: "belongsTo", labelField: "title" }],
    searchFields: ["local_password"], useCreatedAt: true, useUpdatedAt: false, useSoftDelete: false,
  });
});

test("関連先の searchFields は非同期の関連にだけ、関連先の名前の規則で付く", () => {
  const relation = (domain, formInput) => ({ domain, label: "L", fieldName: "x", relationType: "belongsToMany", formInput });
  const main = { singular: "a", plural: "as", label: "A", relations: [relation("b_item", "asyncMultiSelect"), relation("b_item", "select"), relation("c_item", "asyncCombobox"), relation("none", "asyncCombobox")], fields: [] };
  const all = [main, { singular: "bItem", searchFields: ["some_name"], dbEngine: "Neon" }, { singular: "cItem", searchFields: ["some_name"], dbEngine: "Firestore" }];
  const { relations } = toDomainDisplay(main, all);
  assert.deepEqual(relations.map((r) => r.searchFields), [["some_name"], undefined, ["someName"], undefined]);
});

test("実物: 写しの searchFields は getDomainConfig が返していた関連先の値と同じ", () => {
  const { outputs } = buildAlphaRegistries(process.cwd());
  const display = JSON.parse(/= (\{[\s\S]*\}) as const/.exec(outputs["src/features/sample/entities/display.ts"])[1]);
  const tag = JSON.parse(readFileSync("src/features/sampleTag/domain.json", "utf8"));
  const relation = display.relations.find((r) => r.domain === "sample_tag");
  assert.deepEqual(relation.searchFields, tag.searchFields);
  assert.equal(display.relations.find((r) => r.domain === "sample_category").searchFields, undefined);
});

test("Firestore は名前を camelCase に", () => {
  const display = toDomainDisplay({ singular: "a", plural: "as", label: "A", dbEngine: "Firestore", fields: [{ name: "user_name", label: "U" }], searchFields: ["user_name"] });
  assert.equal(display.fields[0].name, "userName");
  assert.deepEqual(display.searchFields, ["userName"]);
});

test("registry の検査: 写しがずれると stale", () => {
  const dir = mkdtempSync(join(tmpdir(), "display-"));
  try {
    const file = "src/features/foo/domain.json";
    const config = { singular: "foo", plural: "foos", label: "F", dbEngine: "Neon", fields: [] };
    mkdirSync(join(dir, "src/features/foo/entities"), { recursive: true });
    const path = "src/features/foo/entities/display.ts";
    const text = renderDomainDisplay(file, config);
    writeFileSync(join(dir, path), text);
    assert.deepEqual(staleAlphaRegistries(dir, { [path]: text }), []);
    writeFileSync(join(dir, path), text + "// 手で直した\n");
    assert.deepEqual(staleAlphaRegistries(dir, { [path]: text }), [path]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("全ドメイン: ボタンが読む singular・plural・label は domain.json と同じ", () => {
  const { outputs } = buildAlphaRegistries(process.cwd());
  for (const path of Object.keys(outputs).filter((p) => p.endsWith("/entities/display.ts"))) {
    const display = JSON.parse(/= (\{[\s\S]*\}) as const/.exec(outputs[path])[1]);
    const config = JSON.parse(readFileSync(path.replace("entities/display.ts", "domain.json"), "utf8"));
    assert.deepEqual([display.singular, display.plural, display.label], [config.singular, config.plural, config.label], path);
  }
});
