// scripts/role-config/tests/checks.test.mjs
// role:generate の前の検査（checks/ の role・profile・relations と index の集約）の契約テスト。
// 良い例は止めず、悪い例は理由の文で止める（または警告だけにする）ことを確かめる。実行: pnpm test:role-config-checks
import { test } from "node:test";
import assert from "node:assert/strict";

import { orphanProfileIssues, roleConfigIssues, roleConfigWarnings } from "../checks/index.mjs";
import { profileFieldIssues, profileTagIssues, profileWarnings } from "../checks/profile.mjs";
import { profileRelationIssues } from "../checks/relations.mjs";
import { roleIssues } from "../checks/role.mjs";

const role = (extra = {}) => ({ id: "reviewer", label: "審査", category: "user", hasProfile: true, isCore: false, ...extra });

/** 全部の検査を通るプロフィール設定 */
const profile = (extra = {}) => ({
  roleId: "reviewer",
  fields: [
    { name: "nickname", label: "表示名", fieldType: "string", formInput: "textInput", required: true },
    { name: "rank", label: "ランク", fieldType: "enum", formInput: "select", options: [{ value: "a", label: "A" }], defaultValue: "a" },
    { name: "note", label: "メモ", fieldType: "string", formInput: "hidden" },
  ],
  relations: [
    { domain: "reviewer_group", label: "グループ", fieldName: "reviewer_group_id", fieldType: "uuid", relationType: "belongsTo", onDelete: "SET_NULL", formInput: "asyncCombobox" },
    { domain: "reviewer_tag", label: "タグ", fieldName: "reviewer_tag_ids", relationType: "belongsToMany", formInput: "hidden" },
  ],
  tags: { registration: ["nickname"], selfEdit: ["nickname", "reviewer_tag_ids"], adminEdit: ["nickname", "rank", "reviewer_group_id"], notification: [] },
  ...extra,
});

const joined = (issues) => issues.join("\n");
const input = (extra = {}) => ({ fileName: "reviewer.role.json", role: role(), profile: profile(), ...extra });

test("良い例: どの検査も止めず、警告も出さない", () => {
  assert.deepEqual(roleConfigIssues(input()), []);
  assert.deepEqual(roleConfigWarnings(input()), []);
  assert.deepEqual(roleConfigIssues({ fileName: "_admin.role.json", role: role({ id: "admin", category: "admin", hasProfile: false, isCore: true }), profile: null }), []);
});

test("ロール: ID の形、ファイル名と isCore の _、category、hasProfile の有無", () => {
  assert.match(joined(roleIssues({ fileName: "Reviewer.role.json", role: role({ id: "Reviewer" }), profileExists: true })), /id "Reviewer"/);
  assert.match(joined(roleIssues({ fileName: "_x.role.json", role: role({ id: "_x" }), profileExists: true })), /id "_x"/);
  assert.match(joined(roleIssues({ fileName: "_reviewer.role.json", role: role(), profileExists: true })), /reviewer\.role\.json にしてください.*_ を付けるのは isCore/);
  assert.match(joined(roleIssues({ fileName: "admin.role.json", role: role({ id: "admin", isCore: true }), profileExists: true })), /_admin\.role\.json にしてください/);
  assert.match(joined(roleIssues({ fileName: "reviewer.role.json", role: role({ category: "staff" }), profileExists: true })), /category は "user" か "admin"/);
  assert.match(joined(roleIssues({ fileName: "reviewer.role.json", role: role({ hasProfile: undefined }), profileExists: true })), /hasProfile は true か false/);
});

test("ロールとプロフィール: hasProfile true で設定が無いと止め、false で設定があるのは警告だけ。ロールの無い設定は止める", () => {
  assert.match(joined(roleConfigIssues(input({ profile: null }))), /hasProfile: true ですがプロフィール設定 reviewer\.profile\.json がありません/);
  const off = input({ role: role({ hasProfile: false }), profile: profile({ fields: [] }) });
  assert.deepEqual(roleConfigIssues(off), []);
  assert.match(joined(roleConfigWarnings(off)), /hasProfile: false ですが/);
  assert.match(joined(orphanProfileIssues(["admin", "user"], ["user", "contributor"])), /\[contributor\.profile\.json\] ロール設定 contributor\.role\.json がありません/);
});

test("項目: 1 つ以上、メディア型は使えない、選択肢・既定値はドメインと同じ検査", () => {
  assert.match(joined(profileFieldIssues(profile({ fields: [] }))), /1 つ以上/);
  const issues = joined(
    profileFieldIssues(
      profile({
        fields: [
          { name: "avatar", fieldType: "mediaUploader", formInput: "mediaUploader" },
          { name: "photos", fieldType: "mediaCollection", formInput: "mediaUploaderMulti" },
          { name: "kind", fieldType: "enum", formInput: "select" },
          { name: "flag", fieldType: "boolean", formInput: "switchInput", defaultValue: "true" },
        ],
      }),
    ),
  );
  assert.match(issues, /"avatar": fieldType "mediaUploader" はプロフィールでは使えません/);
  assert.match(issues, /"photos": fieldType "mediaCollection" はプロフィールでは使えません/);
  assert.match(issues, /"kind": enum には options/);
  assert.match(issues, /"flag": defaultValue の型が合いません/);
});

test("項目（警告だけ）: 表に無い型と入力欄の組、選択肢の要る入力欄に options が無い", () => {
  const config = profile({ fields: [{ name: "pref", fieldType: "string", formInput: "select" }, { name: "age", fieldType: "integer", formInput: "textarea" }] });
  assert.deepEqual(profileFieldIssues(config), []);
  const warnings = joined(profileWarnings(config));
  assert.match(warnings, /"pref": formInput "select" に options/);
  assert.match(warnings, /"age": fieldType "integer" に formInput "textarea"/);
});

test("タグ: 知らないタグ、配列でない値、項目名にもリレーションの fieldName にも無い名前", () => {
  const issues = joined(profileTagIssues(profile({ tags: { admin: ["nickname"], selfEdit: "nickname", registration: ["missing"] } })));
  assert.match(issues, /tags "admin" は知らないタグ/);
  assert.match(issues, /tags "selfEdit" は項目名の配列/);
  assert.match(issues, /tags "registration" の "missing"/);
  assert.match(joined(profileTagIssues(profile({ tags: [] }))), /オブジェクトで書いてください/);
});

test("リレーション: 種類、fieldName、fieldType は uuid だけ、onDelete の値と SET_NULL × required、formInput", () => {
  const issues = joined(
    profileRelationIssues({
      relations: [
        { domain: "a", relationType: "hasMany", fieldName: "a_ids" },
        { domain: "b", relationType: "belongsTo" },
        { domain: "c", relationType: "belongsTo", fieldName: "c_id", fieldType: "string" },
        { domain: "d", relationType: "belongsTo", fieldName: "d_id", onDelete: "NO_ACTION" },
        { domain: "e", relationType: "belongsTo", fieldName: "e_id", onDelete: "SET_NULL", required: true },
        { domain: "f", relationType: "belongsToMany", fieldName: "f_ids", formInput: "select" },
      ],
    }),
  );
  assert.match(issues, /"a": relationType "hasMany"/);
  assert.match(issues, /"b": fieldName/);
  assert.match(issues, /"c": fieldType "string" は使えません/);
  assert.match(issues, /"d": onDelete "NO_ACTION"/);
  assert.match(issues, /"e": onDelete "SET_NULL" は required: true と両立しません/);
  assert.match(issues, /"f": formInput "select"/);
});

test("集約: 問題を全件並べ、ファイル名を付ける", () => {
  const issues = roleConfigIssues({ fileName: "x.role.json", role: { id: "x" }, profile: null });
  assert.ok(issues.length >= 2);
  assert.ok(issues.every((issue) => issue.startsWith("[x.role.json] ")));
  const profileSide = roleConfigIssues(input({ profile: profile({ fields: [] }) }));
  assert.ok(profileSide.every((issue) => issue.startsWith("[reviewer.profile.json] ")));
});
