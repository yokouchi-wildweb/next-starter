// scripts/registry/alpha/domainDisplay.test.mjs
// 実行: pnpm test:domain-display

import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { renderDomainDisplay, toDomainDisplay } from "./domainDisplay.mjs";
import { buildAlphaRegistries, staleAlphaRegistries } from "./index.mjs";
import { toCamelCase } from "../../../src/utils/stringCase.mjs";

const FORBIDDEN = ["apiAccess", "dbEngine", "idType", "generateFiles", "storage", "indexes", "hiddenColumns", "onDelete", "slug", "collection", "defaultOrderBy", "metadataBinding", "uploadPath", "description"];

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
    const value = JSON.parse(/: DomainDisplay = (\{[\s\S]*\});/.exec(outputs[path])[1]);
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
  const display = JSON.parse(/: DomainDisplay = (\{[\s\S]*\});/.exec(outputs["src/features/sample/entities/display.ts"])[1]);
  const tag = JSON.parse(readFileSync("src/features/sampleTag/domain.json", "utf8"));
  const relation = display.relations.find((r) => r.domain === "sample_tag");
  assert.deepEqual(relation.searchFields, tag.searchFields);
  assert.equal(display.relations.find((r) => r.domain === "sample_category").searchFields, undefined);
});

test("hiddenColumns の列は fields と searchFields に出ない", () => {
  const display = toDomainDisplay({ singular: "a", plural: "as", label: "A", hiddenColumns: ["localPassword"], fields: [{ name: "local_password", label: "P" }, { name: "email", label: "E" }], searchFields: ["local_password", "email"] });
  assert.deepEqual(display.fields.map((f) => f.name), ["email"]);
  assert.deepEqual(display.searchFields, ["email"]);
});

test("実物: user の写しに local_password が無い", () => {
  assert.doesNotMatch(readFileSync("src/features/core/user/entities/display.ts", "utf8"), /local_password|localPassword/);
});

test("全ドメイン: domain.json の hiddenColumns と entities の defineHiddenColumns の列が一致する", () => {
  const { outputs } = buildAlphaRegistries(process.cwd());
  const checked = [];
  for (const path of Object.keys(outputs).filter((p) => p.endsWith("/entities/display.ts"))) {
    const config = JSON.parse(readFileSync(path.replace("entities/display.ts", "domain.json"), "utf8"));
    const drizzlePath = path.replace("display.ts", "drizzle.ts");
    const declared = existsSync(drizzlePath)
      ? [...readFileSync(drizzlePath, "utf8").matchAll(/defineHiddenColumns\(\w+,\s*\[([^\]]*)\]/g)].flatMap((m) => [...m[1].matchAll(/["']([^"']+)["']/g)].map((c) => c[1]))
      : [];
    assert.deepEqual([...(config.hiddenColumns ?? [])].sort(), declared.sort(), path);
    checked.push(path);
  }
  assert.ok(checked.includes("src/features/core/user/entities/display.ts"));
});

test("Firestore は名前を camelCase に", () => {
  const display = toDomainDisplay({ singular: "a", plural: "as", label: "A", dbEngine: "Firestore", fields: [{ name: "user_name", label: "U" }], searchFields: ["user_name"] });
  assert.equal(display.fields[0].name, "userName");
  assert.deepEqual(display.searchFields, ["userName"]);
});

test("許可の一覧: 足した項目は写し、F4 の項目は写さない", () => {
  const display = toDomainDisplay({
    singular: "a", plural: "as", label: "A", dbEngine: "Neon",
    useImportExport: true, sortOrderField: "sort_order", tableFields: ["title"], defaultOrderBy: [["title", "ASC"]],
    fieldGroups: [{ key: "k", label: "G", fields: ["title"], collapsible: true, defaultCollapsed: true, bgColor: "#fff", futureKey: 1 }],
    fields: [{
      name: "title", label: "T", required: true, readonly: false, defaultValue: 0, displayType: "d", placeholder: "p", accept: "image/*",
      validationRule: { maxSizeBytes: 1 }, reorderable: true, helperText: "h", metadataBinding: {}, uploadPath: "x", description: "内部の説明",
    }],
  });
  assert.deepEqual(display.fields[0], {
    name: "title", label: "T", required: true, readonly: false, defaultValue: 0, displayType: "d", placeholder: "p", accept: "image/*",
    validationRule: { maxSizeBytes: 1 }, reorderable: true, helperText: "h",
  });
  assert.equal(display.useImportExport, true);
  assert.equal(display.sortOrderField, "sort_order");
  assert.deepEqual(display.tableFields, ["title"]);
  assert.deepEqual(display.fieldGroups, [{ key: "k", label: "G", fields: ["title"], collapsible: true, defaultCollapsed: true, bgColor: "#fff" }]);
  assert.equal("defaultOrderBy" in display, false);
});

test("足した項目が domain.json に無ければ写しにも無い", () => {
  const display = toDomainDisplay({ singular: "a", plural: "as", label: "A", fields: [] });
  for (const key of ["useImportExport", "sortOrderField", "fieldGroups", "tableFields"]) assert.equal(key in display, false, key);
});

test("Firestore: 列名のキーはどれも camelCase に", () => {
  const display = toDomainDisplay({
    singular: "a", plural: "as", label: "A", dbEngine: "Firestore", fields: [],
    tableFields: ["user_name"], sortOrderField: "sort_order", fieldGroups: [{ key: "k", label: "G", fields: ["user_name"] }],
    relations: [{ domain: "b", label: "B", fieldName: "b_id", relationType: "belongsTo" }],
  });
  assert.deepEqual(display.tableFields, ["userName"]);
  assert.equal(display.sortOrderField, "sortOrder");
  assert.deepEqual(display.fieldGroups[0].fields, ["userName"]);
  assert.equal(display.relations[0].fieldName, "bId");
});

test("Neon: 列名のキーは変換しない", () => {
  const display = toDomainDisplay({
    singular: "a", plural: "as", label: "A", dbEngine: "Neon", fields: [],
    tableFields: ["user_name"], sortOrderField: "sort_order", fieldGroups: [{ key: "k", label: "G", fields: ["user_name"] }],
    relations: [{ domain: "b", label: "B", fieldName: "b_id", relationType: "belongsTo" }],
  });
  assert.deepEqual(display.tableFields, ["user_name"]);
  assert.equal(display.sortOrderField, "sort_order");
  assert.deepEqual(display.fieldGroups[0].fields, ["user_name"]);
  assert.equal(display.relations[0].fieldName, "b_id");
});

test("hiddenColumns の列は列名のキーのどれにも出ない", () => {
  const display = toDomainDisplay({
    singular: "a", plural: "as", label: "A", hiddenColumns: ["secretCol"], fields: [],
    tableFields: ["secret_col", "email"], sortOrderField: "secret_col", fieldGroups: [{ key: "k", label: "G", fields: ["secret_col", "email"] }],
    relations: [{ domain: "b", label: "B", fieldName: "secret_col", relationType: "belongsTo" }, { domain: "c", label: "C", fieldName: "c_id", relationType: "belongsTo" }],
  });
  assert.deepEqual(display.tableFields, ["email"]);
  assert.equal("sortOrderField" in display, false);
  assert.deepEqual(display.fieldGroups[0].fields, ["email"]);
  assert.deepEqual(display.relations.map((r) => r.domain), ["c"]);
});

test("実物 chatRoom: 写しの列名は normalizeDomainJsonConfig の結果と同じ", () => {
  const { outputs } = buildAlphaRegistries(process.cwd());
  const display = JSON.parse(/: DomainDisplay = (\{[\s\S]*\});/.exec(outputs["src/features/core/chatRoom/entities/display.ts"])[1]);
  const config = JSON.parse(readFileSync("src/features/core/chatRoom/domain.json", "utf8"));
  const camel = (name) => toCamelCase(name) || name;
  assert.deepEqual(display.fields.map((f) => f.name), config.fields.map((f) => camel(f.name)));
  assert.deepEqual(display.tableFields, config.tableFields.map(camel));
  assert.deepEqual(display.searchFields, config.searchFields.map(camel));
  assert.ok(display.tableFields.includes("updatedAt"));
});

test("全ドメイン: 部品が読む項目の値は domain.json(Firestore は名前の変換後)と同じ", () => {
  const { outputs } = buildAlphaRegistries(process.cwd());
  const FIELD_VALUE_KEYS = ["label", "fieldType", "formInput", "options", "required", "readonly", "defaultValue", "displayType", "placeholder", "accept", "validationRule", "reorderable", "helperText"];
  for (const path of Object.keys(outputs).filter((p) => p.endsWith("/entities/display.ts"))) {
    const display = JSON.parse(/: DomainDisplay = (\{[\s\S]*\});/.exec(outputs[path])[1]);
    const config = JSON.parse(readFileSync(path.replace("entities/display.ts", "domain.json"), "utf8"));
    const name = (value) => (config.dbEngine === "Firestore" ? toCamelCase(value) || value : value);
    const hidden = new Set(config.hiddenColumns ?? []);
    const isPublic = (value) => !hidden.has(toCamelCase(value) || value);
    const fields = (config.fields ?? []).filter((f) => isPublic(f.name));
    assert.deepEqual(display.fields.map((f) => f.name), fields.map((f) => name(f.name)), path);
    fields.forEach((field, index) => {
      for (const key of FIELD_VALUE_KEYS) assert.deepEqual(display.fields[index][key], field[key], `${path} ${field.name}.${key}`);
    });
    assert.equal(display.useImportExport, config.useImportExport, path);
    assert.equal(display.sortOrderField, config.sortOrderField && name(config.sortOrderField), path);
    assert.deepEqual(display.tableFields, config.tableFields?.filter(isPublic).map(name), path);
    assert.deepEqual(display.fieldGroups, config.fieldGroups?.map((g) => ({ ...g, fields: g.fields.filter(isPublic).map(name) })), path);
    assert.deepEqual(display.relations.map((r) => r.fieldName), (config.relations ?? []).filter((r) => isPublic(r.fieldName)).map((r) => name(r.fieldName)), path);
  }
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
    const display = JSON.parse(/: DomainDisplay = (\{[\s\S]*\});/.exec(outputs[path])[1]);
    const config = JSON.parse(readFileSync(path.replace("entities/display.ts", "domain.json"), "utf8"));
    assert.deepEqual([display.singular, display.plural, display.label], [config.singular, config.plural, config.label], path);
  }
});
