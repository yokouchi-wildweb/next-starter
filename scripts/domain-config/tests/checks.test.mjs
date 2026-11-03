// scripts/domain-config/tests/checks.test.mjs
// 生成前の検査（checks/ の names・required・relations・fields・media・viewConfig と index の集約）の契約テスト。
// 良い例は止めず、悪い例は理由の文で止める（または警告だけにする）ことを確かめる。実行: pnpm test:dc-checks
import { test } from "node:test";
import assert from "node:assert/strict";

import { configIssues, preflightIssues, preflightWarnings } from "../checks/index.mjs";
import { auditIssues } from "../checks/audit.mjs";
import { fieldsIssues, fieldsWarnings } from "../checks/fields.mjs";
import { mediaIssues } from "../checks/media.mjs";
import { nameIssues, nameWarnings } from "../checks/names.mjs";
import { relationIssues } from "../checks/relations.mjs";
import { requiredIssues } from "../checks/required.mjs";
import { viewConfigIssues, viewConfigWarnings } from "../checks/viewConfig.mjs";


/** 全部の検査を通る domain.json */
const good = (extra = {}) => ({
  singular: "sample_tag",
  plural: "sample_tags",
  dbEngine: "Neon",
  idType: "uuid",
  useCreatedAt: true,
  useUpdatedAt: true,
  relations: [{ domain: "sample_category", fieldName: "sample_category_id", fieldType: "uuid", relationType: "belongsTo" }],
  fields: [
    { name: "name", fieldType: "string", formInput: "textInput", required: true },
    { name: "color", fieldType: "string", formInput: "colorInput" },
    { name: "level", fieldType: "integer", formInput: "radio", options: [{ value: 1, label: "低" }], defaultValue: 1 },
    { name: "kind", fieldType: "enum", formInput: "select", options: [{ value: "a", label: "A" }], defaultValue: "a" },
    { name: "image", fieldType: "mediaUploader", formInput: "mediaUploader", accept: "image/*", mediaTypePreset: "images", metadataBinding: { width: "image_width" } },
    { name: "image_width", fieldType: "integer", formInput: "hidden" },
  ],
  searchFields: ["name", "sample_category_id"],
  defaultOrderBy: [["name", "ASC", "LAST"], ["createdAt", "DESC"]],
  tableFields: ["name", "kind", "sample_category_id", "createdAt"],
  compositeUniques: [["name"], ["name", "sample_category_id"]],
  ...extra,
});

const joined = (issues) => issues.join("\n");

test("良い例: どの検査も止めず、警告も出さない", () => {
  assert.deepEqual(configIssues("sampleTag", good()), []);
  assert.deepEqual(preflightIssues({ camel: "sampleTag", config: good() }), []);
  assert.deepEqual(preflightWarnings({ camel: "sampleTag", config: good() }), []);
});

test("必須: singular・plural・dbEngine・useCreatedAt / useUpdatedAt、idType の値（db は廃止）、generate は boolean、generateFiles は廃止で止める", () => {
  const issues = joined(requiredIssues({}));
  for (const word of ["singular", "plural", "dbEngine", "useCreatedAt", "useUpdatedAt"]) assert.match(issues, new RegExp(word));
  assert.doesNotMatch(issues, /generate/);
  assert.match(joined(requiredIssues(good({ idType: "db" }))), /idType "db" は使えません/);
  assert.match(joined(requiredIssues(good({ generate: "no" }))), /generate は true か false/);
  assert.deepEqual(requiredIssues(good({ generate: false })), []);
  assert.match(joined(requiredIssues(good({ generateFiles: { entities: true } }))), /generateFiles は廃止しました/);
});

test("名前: 項目名・従属名は snake_case で止め、singular・plural・リレーション先は警告だけ", () => {
  const config = good({
    singular: "sampleTag",
    plural: "sampleTags",
    relations: [{ domain: "sampleCategory", fieldName: "sample_category_id", fieldType: "uuid", relationType: "belongsTo" }],
    fields: [{ name: "galleryImages", fieldType: "mediaCollection", formInput: "mediaUploaderMulti", collection: { domain: "productImage" } }],
  });
  const issues = joined(nameIssues(config));
  assert.match(issues, /fields\[0\] の name "galleryImages"/);
  assert.match(issues, /collection\.domain "productImage"/);
  assert.doesNotMatch(issues, /singular|plural|relations/);
  const warnings = joined(nameWarnings(config));
  assert.match(warnings, /singular "sampleTag"/);
  assert.match(warnings, /plural "sampleTags"/);
  assert.match(warnings, /relations\[0\] の domain "sampleCategory"/);
});

test("リレーション: Firestore の hasMany / belongsToMany、fieldName の無い外部キー、使えない外部キーの型（number・主の idType number）", () => {
  const firestore = { dbEngine: "Firestore", relations: [{ domain: "a", relationType: "hasMany" }, { domain: "b", relationType: "belongsToMany", fieldName: "b_ids" }] };
  assert.equal(relationIssues(firestore).length, 2);
  assert.match(joined(relationIssues(good({ relations: [{ domain: "a", relationType: "belongsTo", fieldType: "uuid" }] }))), /fieldName/);
  assert.match(joined(relationIssues(good({ relations: [{ domain: "a", relationType: "belongsTo", fieldName: "a_id", fieldType: "number" }] }))), /外部キーの型 "number"/);
  assert.match(joined(relationIssues(good({ idType: "number", relations: [{ domain: "a", relationType: "belongsToMany", fieldName: "a_ids" }] }))), /主の idType/);
  assert.deepEqual(relationIssues(good({ relations: [{ domain: "a", relationType: "belongsTo", fieldName: "a_id", fieldType: "integer" }] })), []);
});

test("項目: enum の選択肢・選択肢の値の型・既定値（持てない型・型・enum は選択肢の値）", () => {
  const issues = joined(
    fieldsIssues(
      good({
        fields: [
          { name: "kind", fieldType: "enum", formInput: "select" },
          { name: "level", fieldType: "integer", formInput: "select", options: [{ value: "1", label: "一" }] },
          { name: "meta", fieldType: "jsonb", formInput: "hidden", defaultValue: {} },
          { name: "image", fieldType: "mediaUploader", formInput: "mediaUploader", defaultValue: "x" },
          { name: "flag", fieldType: "boolean", formInput: "switchInput", defaultValue: "true" },
          { name: "status", fieldType: "enum", formInput: "radio", options: [{ value: "a", label: "A" }], defaultValue: "b" },
        ],
      }),
    ),
  );
  assert.match(issues, /"kind": enum には options/);
  assert.match(issues, /"level": options\[0\]\.value の型が合いません（数値/);
  assert.match(issues, /"meta": fieldType "jsonb" は defaultValue を持てません/);
  assert.match(issues, /"image": fieldType "mediaUploader" は defaultValue を持てません/);
  assert.match(issues, /"flag": defaultValue の型が合いません（true か false/);
  assert.match(issues, /"status": defaultValue "b" は options の value/);
});

test("項目（警告だけ）: 表に無い型と入力欄の組、選択肢の要る入力欄に options が無い", () => {
  const config = good({
    fields: [
      { name: "state", fieldType: "enum", formInput: "textarea", options: [{ value: "on", label: "有効" }] },
      { name: "theme", fieldType: "string", formInput: "select" },
      { name: "tags", fieldType: "array", formInput: "checkbox" },
    ],
  });
  assert.deepEqual(fieldsIssues(config), []);
  const warnings = joined(fieldsWarnings(config));
  assert.match(warnings, /"state": fieldType "enum" に formInput "textarea"/);
  assert.match(warnings, /"theme": formInput "select" に options/);
  assert.match(warnings, /"tags": formInput "checkbox" に options/);
});

// 指令 20261103-170209-enum-switch-input-pair: 選択肢 2 つの enum の switchInput は表にある組(inputResolver が 2 択のスイッチを描く)
test("項目: enum の switchInput は options がちょうど 2 つなら警告なし、1 つ・3 つ以上は数の警告", () => {
  const two = [{ value: "active", label: "有効" }, { value: "inactive", label: "無効" }];
  const ok = good({ fields: [{ name: "state", fieldType: "enum", formInput: "switchInput", required: true, defaultValue: "active", options: two }] });
  assert.deepEqual(fieldsIssues(ok), []);
  assert.deepEqual(fieldsWarnings(ok), []);
  const config = good({
    fields: [
      { name: "one", fieldType: "enum", formInput: "switchInput", options: [two[0]] },
      { name: "three", fieldType: "enum", formInput: "switchInput", options: [...two, { value: "x", label: "x" }] },
      { name: "flag", fieldType: "boolean", formInput: "switchInput" },
    ],
  });
  const warnings = joined(fieldsWarnings(config));
  assert.match(warnings, /"one": enum の formInput "switchInput" は options がちょうど 2 つ.*今 1 つ/);
  assert.match(warnings, /"three": enum の formInput "switchInput" は options がちょうど 2 つ.*今 3 つ/);
  assert.doesNotMatch(warnings, /"flag"/);
  assert.doesNotMatch(warnings, /表（spec\/formInputs\.mjs）に無い組/);
});

test("表に無い型は項目の検査の対象外（語彙の警告だけ）", () => {
  const config = good({ fields: [{ name: "ids", fieldType: "uuid[]", formInput: "hidden", defaultValue: [] }] });
  assert.deepEqual(fieldsIssues(config), []);
  assert.deepEqual(fieldsWarnings(config), []);
});

test("メディア: accept の型が無い（制限なしでも列挙）、preset の綴り、metadataBinding のキーと書き先。Firestore の集まりは止める", () => {
  const issues = joined(
    mediaIssues({
      fields: [
        { name: "a", fieldType: "mediaUploader", accept: "", mediaTypePreset: "imagesOnly", metadataBinding: { size: "a_size", width: "missing" } },
      ],
    }),
  );
  assert.match(issues, /accept に受け付ける型/);
  assert.match(issues, /mediaTypePreset "imagesOnly"/);
  assert.match(issues, /キー "size"/);
  assert.match(issues, /書き先 "missing"/);
  const firestore = { camel: "memo", config: { ...good({ dbEngine: "Firestore", relations: [], compositeUniques: [] }), fields: [{ name: "images", fieldType: "mediaCollection", formInput: "mediaUploaderMulti", collection: { domain: "memo_image" } }] } };
  assert.match(joined(preflightIssues(firestore)), /mediaCollection/);
});

test("一覧の設定: 無い項目名・向き・FIRST / LAST、複合ユニーク（空・無い名・Firestore）。文字列でない列の検索は警告だけ", () => {
  const issues = joined(
    viewConfigIssues(
      good({
        searchFields: ["missing"],
        defaultOrderBy: [["name", "UP"], ["missing", "ASC"], ["name", "ASC", "MIDDLE"], ["name"]],
        tableFields: ["price_plan_id"],
        compositeUniques: [[], ["missing"]],
      }),
    ),
  );
  assert.match(issues, /searchFields "missing"/);
  assert.match(issues, /向き "UP"/);
  assert.match(issues, /"missing" が fields にありません/);
  assert.match(issues, /3 つ目 "MIDDLE"/);
  assert.match(issues, /defaultOrderBy\[3\] は/);
  assert.match(issues, /tableFields "price_plan_id"/);
  assert.match(issues, /compositeUniques\[0\] は 1 つ以上/);
  assert.match(issues, /compositeUniques\[1\] の "missing"/);
  assert.match(joined(viewConfigIssues(good({ dbEngine: "Firestore", relations: [] }))), /Firestore のドメインでは compositeUniques/);
  assert.match(joined(viewConfigWarnings(good({ searchFields: ["level"] }))), /searchFields "level" は文字列の列ではありません/);
});

test("集約: 問題を全件並べ、[camel] を付ける", () => {
  const issues = configIssues("x", { fields: [{ name: "Bad" }] });
  assert.ok(issues.length > 3);
  assert.ok(issues.every((issue) => issue.startsWith("[x] ")));
});

test("audit: 無し・enabled: false・正しい形は通り、未知キー・必須の欠け・値の型・実在しない列・Neon 以外は止まる", () => {
  const fields = [{ name: "first_name", fieldType: "string", formInput: "textInput" }];
  const relations = [{ domain: "group", fieldName: "group_id", relationType: "belongsTo" }, { domain: "tag", fieldName: "tag_ids", relationType: "belongsToMany" }];
  const audit = (extra) => auditIssues({ dbEngine: "Neon", fields, relations, audit: { targetType: "x", actionPrefix: "x", ...extra } }).join("\n");
  assert.deepEqual(auditIssues({ dbEngine: "Firestore", fields }), []);
  assert.deepEqual(auditIssues({ dbEngine: "Firestore", fields, audit: { enabled: false } }), []);
  assert.equal(audit({ trackedFields: ["firstName", "groupId"], bulkMode: "detail", retentionDays: 730, strict: true }), "");
  assert.match(audit({ recorder: "a" }), /知らないキー recorder/);
  assert.match(audit({ targetType: undefined }), /audit\.targetType/);
  assert.match(audit({ actionPrefix: "" }), /audit\.actionPrefix/);
  assert.match(audit({ bulkMode: "all" }), /audit\.bulkMode/);
  assert.match(audit({ retentionDays: 0 }), /audit\.retentionDays/);
  assert.match(audit({ trackedFields: "firstName" }), /列名の配列/);
  assert.match(audit({ trackedFields: ["first_name"] }), /"first_name" が列にありません/);
  assert.match(audit({ trackedFields: ["tagIds"] }), /"tagIds" が列にありません/);
  assert.match(auditIssues({ dbEngine: "Firestore", fields, audit: { targetType: "x", actionPrefix: "x" } }).join(), /Neon のドメインだけ/);
  assert.match(auditIssues({ dbEngine: "Neon", fields, audit: [] }).join(), /オブジェクトで書いて/);
  assert.match(configIssues("sample", { ...good(), audit: { enabled: "no" } }).join("\n"), /\[sample\] audit\.enabled/);
});
