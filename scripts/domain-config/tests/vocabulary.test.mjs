// domain.json の語彙検査（綴り違い・古いキー・その DB に無い型・知らない入力種別を警告する）の回帰テスト。
// 実行: pnpm test:dc-vocabulary
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { BUILTIN_FORM_INPUTS } from "../../../src/lib/domain/fields/formInputs.mjs";
import { toCamelCase } from "../../../src/utils/stringCase.mjs";
import { formInputNameIssues } from "../checks/formInputNames.mjs";
import { formInputNameOf, readRegisteredFormInputs } from "../domain/formInputNames.mjs";
import { createWorkspace } from "../domain/workspace.mjs";
import { vocabularyWarnings } from "../checks/vocabulary.mjs";
import { FORM_INPUT_VALUES, RELATION_FORM_INPUTS } from "../spec/domainJson.mjs";
import { FORM_INPUTS } from "../spec/formInputs.mjs";
import { repoRoot } from "./helpers.mjs";

const BASE = {
  domainConfigVersion: "1.3",
  singular: "memo",
  plural: "memos",
  label: "メモ",
  dbEngine: "Neon",
  idType: "uuid",
  relations: [],
  useCreatedAt: true,
  useUpdatedAt: true,
  fields: [{ name: "title", label: "題名", fieldType: "string", formInput: "textInput", required: true }],
};

test("正しい domain.json には警告が無い（このリポのサンプル 3 件を含む）", () => {
  assert.deepEqual(vocabularyWarnings(BASE), []);
  for (const domain of ["sample", "sampleCategory", "sampleTag"]) {
    const config = JSON.parse(fs.readFileSync(path.join(repoRoot, "src", "features", domain, "domain.json"), "utf8"));
    assert.deepEqual(vocabularyWarnings(config), [], domain);
  }
});

test("知らないトップレベルのキーと古いキー（version）を警告する", () => {
  const warnings = vocabularyWarnings({ ...BASE, version: "1.1", useSoftDelte: true });
  assert.match(warnings.join("\n"), /古いキー "version" は "domainConfigVersion"/);
  assert.match(warnings.join("\n"), /知らないキー "useSoftDelte"/);
});

test("その DB に無い fieldType と知らない formInput を警告する", () => {
  const warnings = vocabularyWarnings({
    ...BASE,
    fields: [
      { name: "ids", label: "ID", fieldType: "uuid[]", formInput: "custom" },
      { name: "at", label: "日時", fieldType: "timestamp with time zone", formInput: "datetimeInput" },
      { name: "pic", label: "画像", fieldType: "mediaUploader", formInput: "imageUploader" },
      { name: "color", label: "色", fieldType: "string", formInput: "colorInput", description: "x", uploadPath: "y" },
    ],
  });
  assert.match(warnings.join("\n"), /fields\[0\] "ids": fieldType "uuid\[\]" は Neon に無い型/);
  assert.match(warnings.join("\n"), /fields\[1\] "at": fieldType "timestamp with time zone" は Neon に無い型/);
  assert.match(warnings.join("\n"), /fields\[3\] "color": 知らないキー "description"/);
  assert.match(warnings.join("\n"), /fields\[3\] "color": 知らないキー "uploadPath"/);
  assert.doesNotMatch(warnings.join("\n"), /colorInput/);
});

test("Firestore の型は Firestore の表で見る", () => {
  const fs = { ...BASE, dbEngine: "Firestore", fields: [{ name: "n", label: "n", fieldType: "number", formInput: "numberInput" }, { name: "i", label: "i", fieldType: "integer", formInput: "numberInput" }] };
  const warnings = vocabularyWarnings(fs);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /"integer" は Firestore に無い型/);
});

test("リレーションのキー・種別・onDelete・formInput を見る（旧 onDeleteCascade は移行を案内）", () => {
  const warnings = vocabularyWarnings({
    ...BASE,
    relations: [
      { domain: "vault", label: "v", fieldName: "vault_id", fieldType: "uuid", relationType: "belongsTo", onDeleteCascade: true },
      { domain: "tag", label: "t", fieldName: "tag_ids", fieldType: "uuid", relationType: "belongsToMany", formInput: "asyncCombobox" },
      { domain: "x", label: "x", fieldName: "x_id", relationType: "belongsToo", onDelete: "NULLIFY" },
    ],
  });
  const text = warnings.join("\n");
  assert.match(text, /relations\[0\] "vault": 古いキー "onDeleteCascade" は onDelete: "CASCADE"/);
  assert.match(text, /relations\[1\] "tag": formInput "asyncCombobox" は belongsToMany では使えません/);
  assert.match(text, /relations\[2\] "x": relationType "belongsToo"/);
  assert.match(text, /relations\[2\] "x": onDelete "NULLIFY"/);
});

test("generate は知っているキー（generateFiles は廃止キー = checks/required.mjs が止める）", () => {
  assert.deepEqual(vocabularyWarnings({ ...BASE, generate: false }), []);
});

test("主の集まりの項目（mediaCollection + collection）は警告なく通り、collection の下位キーの誤りは警告する", () => {
  const gallery = { name: "gallery", label: "ギャラリー", fieldType: "mediaCollection", formInput: "mediaUploaderMulti", required: true, reorderable: true };
  const ok = { ...BASE, fields: [...BASE.fields, { ...gallery, collection: { domain: "memoImage", maxItems: 10, duplicate: false } }] };
  assert.deepEqual(vocabularyWarnings(ok), []);
  assert.deepEqual(vocabularyWarnings({ ...BASE, fields: [...BASE.fields, { ...gallery, collection: { domain: "memoImage" } }] }), []);

  const text = vocabularyWarnings({
    ...BASE,
    fields: [
      { ...gallery, collection: { domain: "", maxItems: 0, duplicate: "no", minItems: 1 } },
      { ...gallery, name: "other", collection: ["memoImage"] },
    ],
  }).join("\n");
  assert.match(text, /fields\[0\] "gallery": collection: 知らないキー "minItems"/);
  assert.match(text, /fields\[0\] "gallery": collection\.domain は従属ドメインの singular/);
  assert.match(text, /fields\[0\] "gallery": collection\.maxItems は 1 以上の整数/);
  assert.match(text, /fields\[0\] "gallery": collection\.duplicate は true か false/);
  assert.match(text, /fields\[1\] "other": collection はオブジェクトで書いてください/);
});

test("mediaCollection は Firestore に無い型", () => {
  const warnings = vocabularyWarnings({
    ...BASE,
    dbEngine: "Firestore",
    fields: [{ name: "gallery", label: "g", fieldType: "mediaCollection", formInput: "mediaUploaderMulti", collection: { domain: "x" } }],
  });
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /"mediaCollection" は Firestore に無い型/);
});

test("組み込みの入力種別: 検査の一覧は正の表と同じ、候補の表とリレーションの名前は全部その中、combobox 系は警告にならない", () => {
  assert.deepEqual([...FORM_INPUT_VALUES], [...BUILTIN_FORM_INPUTS]);
  const fromTable = Object.values(FORM_INPUTS).flatMap((byType) => Object.values(byType).flat()).map((name) => toCamelCase(name));
  const fromRelations = Object.values(RELATION_FORM_INPUTS).flatMap((names) => [...names]);
  assert.deepEqual([...new Set([...fromTable, ...fromRelations])].filter((name) => !FORM_INPUT_VALUES.has(name)), []);
  const fields = ["combobox", "asyncCombobox", "asyncMultiSelect", "colorValueInput"].map((formInput, index) => ({ name: `f${index}`, label: "x", fieldType: "string", formInput }));
  assert.deepEqual(formInputNameIssues({ fields }), []);
});

test("未知の formInput: fields・relations とも止まり、登録名は通って組の警告も出ない", () => {
  const config = { fields: [{ name: "a", fieldType: "string", formInput: "ticketRates" }, { name: "b", fieldType: "string", formInput: "fileUploader" }], relations: [{ domain: "x", relationType: "belongsTo", formInput: "ticketRates" }, { domain: "y", relationType: "belongsTo", formInput: "nope" }] };
  const none = formInputNameIssues(config).join("\n");
  assert.match(none, /fields "a": formInput "ticketRates"/);
  assert.match(none, /relations "y": formInput "nope"/);
  const registered = formInputNameIssues(config, new Set(["ticketRates"]));
  assert.equal(registered.length, 2);
  assert.ok(registered.every((issue) => /"(fileUploader|nope)"/.test(issue) && issue.includes("src/wiring/formInputs/inputs/")));
  const pair = { ...BASE, relations: [{ domain: "x", fieldName: "x_id", fieldType: "uuid", relationType: "belongsTo", onDelete: "RESTRICT", formInput: "ticketRates" }] };
  assert.match(vocabularyWarnings(pair).join("\n"), /ticketRates/);
  assert.doesNotMatch(vocabularyWarnings(pair, new Set(["ticketRates"])).join("\n"), /ticketRates/);
});

test("登録名の読み手: 項目の name を字面で読み、ファイル形・フォルダ形とも拾う", () => {
  const text = 'export const formInput = {\n  name: "ticketRates",\n  load: () => import("./x"),\n} as const satisfies FormInputItem;\n';
  assert.equal(formInputNameOf(text), "ticketRates");
  assert.equal(formInputNameOf("export const other = 1;\n"), null);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "form-input-names-"));
  const dir = path.join(root, "src/wiring/formInputs/inputs");
  fs.mkdirSync(path.join(dir, "b.acme"), { recursive: true });
  fs.writeFileSync(path.join(dir, "a.acme.ts"), text);
  fs.writeFileSync(path.join(dir, "b.acme/index.ts"), text.replace("ticketRates", "pick"));
  fs.writeFileSync(path.join(dir, "README.md"), "# x\n");
  assert.deepEqual([...readRegisteredFormInputs(createWorkspace(root))].sort(), ["pick", "ticketRates"]);
  assert.deepEqual([...readRegisteredFormInputs(createWorkspace(path.join(root, "nothing")))], []);
  fs.rmSync(root, { recursive: true, force: true });
});
