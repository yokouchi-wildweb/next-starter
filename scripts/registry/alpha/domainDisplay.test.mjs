// scripts/registry/alpha/domainDisplay.test.mjs
// 実行: pnpm test:domain-display

import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
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
