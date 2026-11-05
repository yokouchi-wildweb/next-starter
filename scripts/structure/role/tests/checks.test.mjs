// scripts/structure/role/tests/checks.test.mjs
// role:generate の前の検査（checks/ の role・profile・relations と index の集約）の契約テスト。
// 良い例は止めず、悪い例は理由の文で止める（または警告だけにする）ことを確かめる。実行: pnpm test:role-config-checks
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { orphanProfileIssues, roleConfigIssues, roleConfigWarnings } from "../checks/index.mjs";
import { profileFieldIssues, profileTagIssues, profileWarnings } from "../checks/profile.mjs";
import { profileRelationIssues } from "../checks/relations.mjs";
import { roleFolderIssues, roleIssues } from "../checks/role.mjs";

const role = (extra = {}) => ({ id: "reviewer", label: "審査", category: "user", hasProfile: true, ...extra });

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

test("表に無い fieldType は hasProfile:true で止め、hasProfile:false では検査しない", () => {
  const bad = profile({ fields: [{ name: "nickname", label: "表示名", fieldType: "nope", formInput: "textInput" }], tags: {} });
  assert.match(joined(profileFieldIssues(bad)), /fields "nickname": fieldType "nope" は型の表にありません/);
  assert.match(joined(profileFieldIssues(profile({ fields: [{ name: "nickname", label: "表示名", formInput: "textInput" }], tags: {} }))), /fieldType undefined は型の表にありません/);
  assert.match(joined(roleConfigIssues(input({ profile: bad }))), /型の表にありません/);
  assert.doesNotMatch(joined(roleConfigIssues(input({ role: role({ hasProfile: false }), profile: bad }))), /型の表にありません/);
});

test("良い例: どの検査も止めず、警告も出さない", () => {
  assert.deepEqual(roleConfigIssues(input()), []);
  assert.deepEqual(roleConfigWarnings(input()), []);
  assert.deepEqual(roleConfigIssues({ fileName: "admin.role.json", role: role({ id: "admin", category: "admin", hasProfile: false }), profile: null }), []);
});

test("ロール: ID の形、ファイル名、isCore の廃止、category、hasProfile の有無", () => {
  assert.match(joined(roleIssues({ fileName: "Reviewer.role.json", role: role({ id: "Reviewer" }), profileExists: true })), /id "Reviewer"/);
  assert.match(joined(roleIssues({ fileName: "_x.role.json", role: role({ id: "_x" }), profileExists: true })), /id "_x"/);
  assert.match(joined(roleIssues({ fileName: "_reviewer.role.json", role: role(), profileExists: true })), /reviewer\.role\.json にしてください/);
  assert.match(joined(roleIssues({ fileName: "reviewer.role.json", role: role({ isCore: false }), profileExists: true })), /isCore は廃止/);
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

test("置き場: coreRoles/ は上流の 3 つだけ・欠けは止める、roles/ に core の ID は置けない", () => {
  const core = ["admin.role.json", "user.role.json", "debugger.role.json"];
  assert.deepEqual(roleFolderIssues({ coreFileNames: core, addedFileNames: ["editor.role.json"] }), []);
  assert.match(joined(roleFolderIssues({ coreFileNames: [...core, "x.role.json"], addedFileNames: [] })), /\[coreRoles\/x\.role\.json\] coreRoles\/ は/);
  assert.match(joined(roleFolderIssues({ coreFileNames: ["admin.role.json", "user.role.json"], addedFileNames: [] })), /coreRoles\/debugger\.role\.json\] core ロールの設定がありません/);
  assert.match(joined(roleFolderIssues({ coreFileNames: core, addedFileNames: ["user.role.json"] })), /\[roles\/user\.role\.json\] core ロールと同じ ID/);
});

test("実リポジトリ: core 3 ロールの値は移す前と同じ、一覧の並び（= DB の enum user_role の順）は変えない", () => {
  const repo = path.resolve(import.meta.dirname, "../../../..");
  const read = (id) => JSON.parse(fs.readFileSync(path.join(repo, "src/features/core/user/coreRoles", `${id}.role.json`), "utf8"));
  assert.deepEqual(read("admin"), { id: "admin", label: "管理者", category: "admin", description: "システム全体を管理できる", hasProfile: false, enabled: true });
  assert.deepEqual(read("user"), { id: "user", label: "一般", category: "user", description: "一般ユーザー", hasProfile: false, enabled: true });
  assert.deepEqual(read("debugger"), { id: "debugger", label: "デバッガー", category: "user", description: "メンテナンスモードをバイパスしてユーザーアプリを使用可能", hasProfile: false, enabled: true });
  const list = fs.readFileSync(path.join(repo, "src/features/core/user/extensions/roles.ts"), "utf8");
  assert.deepEqual([...list.matchAll(/^ {2}(\w+)Role as RoleConfig,$/gm)].map((m) => m[1]), ["admin", "user", "editor", "debugger", "contributor"]);
});

test("入力部品の名前: 未知の formInput は profile の fields・relations で止まり、登録名は通る", () => {
  const config = profile({ fields: [{ name: "pick", label: "x", fieldType: "string", formInput: "ticketRates" }], relations: [{ domain: "g", label: "g", fieldName: "g_id", relationType: "belongsTo", onDelete: "SET_NULL", formInput: "ticketRates" }], tags: {} });
  assert.match(joined(roleConfigIssues(input({ profile: config }))), /\[reviewer\.profile\.json\] fields "pick": formInput "ticketRates" は組み込みにも登録にもありません/);
  const registered = new Set(["ticketRates"]);
  assert.deepEqual(roleConfigIssues(input({ profile: config, registeredInputs: registered })), []);
  assert.deepEqual(roleConfigWarnings(input({ profile: config, registeredInputs: registered })), []);
});

test("プロフィール項目の既定値は defaultValue だけ（default は止める）", () => {
  const withDefault = profile({
    fields: [{ name: "isApproved", label: "承認", fieldType: "boolean", formInput: "switchInput", default: true }],
    tags: {},
  });
  assert.match(joined(profileFieldIssues(withDefault)), /fields "isApproved": キー "default" は使えません/);
  const withDefaultValue = profile({
    fields: [{ name: "isApproved", label: "承認", fieldType: "boolean", formInput: "switchInput", defaultValue: true }],
    tags: {},
  });
  assert.doesNotMatch(joined(profileFieldIssues(withDefaultValue)), /"default"/);
});
