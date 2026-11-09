// pnpm generate domain -- --delete を止める判定（組を壊す削除・他のドメインから参照されているドメインの削除・残るコードから import されているドメインの削除を止める）と、既定の対話なしの確認（--confirm）の回帰テスト。
// 止まる経路は runDelete を直接呼ぶ（-i でなければ対話は出ない）。止まらない経路は判定が null であることを見る。
// 実行: pnpm test scripts/structure/domain/tests/deleteStop.test.mjs
import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { runDelete } from "../cli/delete.mjs";
import { createWorkspace } from "../domain/workspace.mjs";
import { codeReferences, deleteStopMessage, inboundReferences } from "../pipeline/remove/index.mjs";
import { buildChildDomainConfig } from "../render/collections/childDomainConfig.mjs";
import { makeProject, removeAll } from "./helpers.mjs";

const cleanup = [];
after(() => removeAll(cleanup));

const base = (singular, fields = [], extra = {}) => ({
  domainConfigVersion: "1.3",
  singular,
  plural: `${singular}s`,
  label: singular,
  dbEngine: "Neon",
  idType: "uuid",
  relations: [],
  useCreatedAt: true,
  useUpdatedAt: true,
  fields: [{ name: "name", label: "名前", fieldType: "string", formInput: "textInput", required: true }, ...fields],
  ...extra,
});
const photos = { name: "photos", label: "写真", fieldType: "mediaCollection", formInput: "mediaUploaderMulti", required: true, reorderable: true, collection: { domain: "album_photo" } };
const album = base("album", [photos]);
const albumPhoto = buildChildDomainConfig(album, photos).config;

/** runDelete を呼び、標準エラーと exitCode を返す（exitCode は元に戻す） */
async function deleteCapturing(workspace, domain, options = {}) {
  const errors = [];
  const originalError = console.error;
  const originalLog = console.log;
  console.log = () => {};
  const originalExit = process.exitCode;
  console.error = (message) => errors.push(String(message));
  try {
    await runDelete(workspace, domain, options);
    return { stderr: errors.join("\n"), exitCode: process.exitCode };
  } finally {
    console.error = originalError;
    console.log = originalLog;
    process.exitCode = originalExit;
  }
}
const snapshot = (root) => fs.readdirSync(path.join(root, "src"), { recursive: true }).sort();

test("主: 従属の domain.json が残っていれば一覧と直す順を出して止まり、何も消さない", async () => {
  const root = makeProject({ configs: { album, albumPhoto }, cleanup });
  const workspace = createWorkspace(root);
  const before = snapshot(root);
  const { stderr, exitCode } = await deleteCapturing(workspace, "album");
  assert.equal(exitCode, 1);
  assert.match(stderr, /album は集まりの従属（albumPhoto）を持っているため削除できません/);
  assert.match(stderr, /album\/domain\.json の集まりの項目 "photos" を外し、従属を pnpm generate domain -- --delete --remove-config してから album を消してください/);
  assert.deepEqual(snapshot(root), before);
});

test("従属: 主が集まりの項目を宣言している間は止まり、何も消さない", async () => {
  const root = makeProject({ configs: { album, albumPhoto }, cleanup });
  const workspace = createWorkspace(root);
  const before = snapshot(root);
  const { stderr, exitCode } = await deleteCapturing(workspace, "album_photo");
  assert.equal(exitCode, 1);
  assert.match(stderr, /albumPhoto は album の集まりの従属です。先に album\/domain\.json の集まりの項目 "photos" を外してください/);
  assert.deepEqual(snapshot(root), before);
});

const relation = (domain, relationType, fieldName, extra = {}) => ({ domain, label: "a", fieldName, fieldType: "uuid", relationType, ...extra });

test("止まらない: 従属がまだ書き出されていない主・項目を外した後の従属・組も参照も無いドメイン", () => {
  const notWritten = createWorkspace(makeProject({ configs: { album }, cleanup }));
  assert.equal(deleteStopMessage(notWritten, "album"), null);

  const detached = createWorkspace(makeProject({ configs: { album: base("album"), albumPhoto }, cleanup }));
  assert.equal(deleteStopMessage(detached, "albumPhoto"), null);

  const none = createWorkspace(makeProject({ configs: { note: base("note"), memo: base("memo") }, cleanup }));
  assert.equal(deleteStopMessage(none, "note"), null);
});

test("inboundReferences: どの種類の関連で指されても domain と fieldName を返す。snake_case の名前も camelCase のフォルダと照合する", () => {
  const configs = new Map([
    ["album", base("album")],
    ["comment", base("comment", [], { relations: [relation("album", "belongsTo", "album_id")] })],
    ["tag", base("tag", [], { relations: [relation("album", "belongsToMany", "album_ids")] })],
    ["inverse", base("inverse", [], { relations: [relation("album", "belongsToMany", "album_ids", { includeRelationTable: false })] })],
    ["shelf", base("shelf", [], { relations: [relation("album", "hasMany", "album_id")] })],
    ["cover", base("cover", [], { relations: [relation("album", "hasOne", "album_id")] })],
    ["other", base("other", [], { relations: [relation("note", "belongsTo", "note_id")] })],
    ["broken", null],
  ]);
  assert.deepEqual(inboundReferences(configs, "album"), [
    { domain: "comment", fieldName: "album_id", relationType: "belongsTo" },
    { domain: "tag", fieldName: "album_ids", relationType: "belongsToMany" },
    { domain: "inverse", fieldName: "album_ids", relationType: "belongsToMany" },
    { domain: "shelf", fieldName: "album_id", relationType: "hasMany" },
    { domain: "cover", fieldName: "album_id", relationType: "hasOne" },
  ]);
  const snake = new Map([["comment", base("comment", [], { relations: [relation("album_photo", "belongsTo", "album_photo_id")] })]]);
  assert.deepEqual(inboundReferences(snake, "albumPhoto"), [{ domain: "comment", fieldName: "album_photo_id", relationType: "belongsTo" }]);
});

test("inboundReferences: 自己参照と、消すドメイン自身が持つ外向きの関連は数えない", () => {
  const configs = new Map([
    ["node", base("node", [], { relations: [relation("node", "belongsTo", "parent_id"), relation("album", "belongsTo", "album_id")] })],
    ["album", base("album")],
  ]);
  assert.deepEqual(inboundReferences(configs, "node"), []);
});

test("参照されているドメイン: --confirm が合っていても、参照元を全部出して止まり何も消さない。自己参照だけなら止まらない", async () => {
  const configs = {
    album: base("album"),
    comment: base("comment", [], { relations: [relation("album", "belongsTo", "album_id")] }),
    tag: base("tag", [], { relations: [relation("album", "belongsToMany", "album_ids")] }),
    node: base("node", [], { relations: [relation("node", "belongsTo", "parent_id")] }),
  };
  const root = makeProject({ configs, cleanup });
  const workspace = createWorkspace(root);
  const before = snapshot(root);
  const { stderr, exitCode } = await deleteCapturing(workspace, "album", { confirm: "album", removeConfig: true });
  assert.equal(exitCode, 1);
  assert.match(stderr, /album は他のドメインから参照されているため削除できません/);
  assert.match(stderr, /comment: album_id（belongsTo）/);
  assert.match(stderr, /tag: album_ids（belongsToMany）/);
  assert.deepEqual(snapshot(root), before);
  assert.equal(deleteStopMessage(workspace, "node"), null);
  assert.equal(deleteStopMessage(workspace, "comment"), null);
});

test("主の停止は、従属以外の参照元も同じ文面で一度に出す（従属は重ねて出さない）", () => {
  const comment = base("comment", [], { relations: [relation("album", "belongsTo", "album_id")] });
  const workspace = createWorkspace(makeProject({ configs: { album, albumPhoto, comment }, cleanup }));
  const message = deleteStopMessage(workspace, "album");
  assert.match(message, /集まりの従属（albumPhoto）/);
  assert.match(message, /comment: album_id（belongsTo）/);
  assert.doesNotMatch(message, /albumPhoto: /);
});

test("消す順: 主の項目を外す → 従属を --remove-config で消す → 主を消す。従属の domain.json を残すと主は止まったまま", async () => {
  const root = makeProject({ configs: { album: base("album"), albumPhoto }, cleanup });
  const workspace = createWorkspace(root);
  const owner = path.join(root, "src/features/album/entities");
  fs.mkdirSync(owner, { recursive: true });
  assert.match(deleteStopMessage(workspace, "album"), /albumPhoto: album_id（belongsTo）/);

  await deleteCapturing(workspace, "album_photo", { confirm: "album_photo" });
  assert.equal(fs.existsSync(path.join(root, "src/features/albumPhoto/domain.json")), true);
  assert.match(deleteStopMessage(workspace, "album"), /albumPhoto: album_id（belongsTo）/);

  await deleteCapturing(workspace, "album_photo", { confirm: "album_photo", removeConfig: true });
  assert.equal(fs.existsSync(path.join(root, "src/features/albumPhoto")), false);
  assert.equal(deleteStopMessage(workspace, "album"), null);
  await deleteCapturing(workspace, "album", { confirm: "album" });
  assert.equal(fs.existsSync(owner), false);
});

test("--confirm: 無い・違うなら消すものの一覧と打てるコマンドを出して止まり、何も消さない。一致なら消し、domain.json は --remove-config のときだけ消す", async () => {
  const note = base("note");
  const root = makeProject({ configs: { note }, cleanup });
  const workspace = createWorkspace(root);
  const before = snapshot(root);
  const missing = await deleteCapturing(workspace, "note");
  assert.equal(missing.exitCode, 1);
  assert.match(missing.stderr, /--confirm でドメイン名/);
  assert.match(missing.stderr, /実行: pnpm generate domain -- --delete note --confirm note/);
  const wrong = await deleteCapturing(workspace, "note", { confirm: "notes" });
  assert.equal(wrong.exitCode, 1);
  assert.match(wrong.stderr, /--confirm "notes" がドメイン名 "note" と一致しません/);
  const badExtra = await deleteCapturing(workspace, "note", { confirm: "note", extras: ["src/elsewhere"] });
  assert.equal(badExtra.exitCode, 1);
  assert.match(badExtra.stderr, /--extra に候補に無いディレクトリ/);
  assert.deepEqual(snapshot(root), before);

  fs.mkdirSync(path.join(root, "src/features/note/entities"), { recursive: true });
  await deleteCapturing(workspace, "note", { confirm: "note" });
  assert.equal(fs.existsSync(path.join(root, "src/features/note/entities")), false);
  assert.equal(fs.existsSync(path.join(root, "src/features/note/domain.json")), true);
  await deleteCapturing(workspace, "note", { confirm: "note", removeConfig: true });
  assert.equal(fs.existsSync(path.join(root, "src/features/note/domain.json")), false);
});

test("codeReferences: @/features/<d>・@/features/core/<d>（core/ を省いた書き方も）・相対パスの import を拾い、消すフォルダ・一緒に消すディレクトリ・src/registry は数えない", () => {
  const files = [
    { path: "src/features/order/services/server/orderService.ts", text: 'import { couponService } from "@/features/coupon/services/server/couponService";\nimport type { X } from "@/features/couponIssuer/types";' },
    { path: "src/app/api/me/coupon/route.ts", text: 'export { GET } from "@/features/core/coupon/routes";\nconst m = await import("@/features/coupon");' },
    { path: "src/features/core/wallet/x.ts", text: 'import { a } from "../coupon/utils/a";' },
    { path: "src/features/core/wallet/y.ts", text: '// import { a } from "@/features/coupon";\n/* import "@/features/coupon"; */' },
    { path: "src/features/core/coupon/internal.ts", text: 'import { b } from "@/features/coupon/b";' },
    { path: "src/app/admin/(protected)/coupons/page.tsx", text: 'import { c } from "@/features/coupon/c";' },
    { path: "src/registry/serviceRegistry.ts", text: 'coupon: () => import("@/features/core/coupon/services/server/domainEntry"),' },
    { path: "src/features/core/wallet/README.md", text: 'import { a } from "@/features/coupon";' },
  ];
  assert.deepEqual(codeReferences(files, "src/features/core/coupon", ["src/app/admin/(protected)/coupons"]), [
    { file: "src/features/order/services/server/orderService.ts", source: "@/features/coupon/services/server/couponService" },
    { file: "src/app/api/me/coupon/route.ts", source: "@/features/core/coupon/routes" },
    { file: "src/app/api/me/coupon/route.ts", source: "@/features/coupon" },
    { file: "src/features/core/wallet/x.ts", source: "../coupon/utils/a" },
  ]);
  // business のドメインは @/features/<d> だけ（名前が前方一致するだけの別ドメインは数えない）
  assert.deepEqual(codeReferences([files[0]], "src/features/couponIssuer"), [{ file: files[0].path, source: "@/features/couponIssuer/types" }]);
});

test("残るコードから import されているドメイン: 参照元のファイルと from 先を全部出して止まり、何も消さない。import を外せば消せる", async () => {
  const note = base("note");
  const memo = base("memo");
  const root = makeProject({ configs: { note, memo }, cleanup });
  const workspace = createWorkspace(root);
  fs.mkdirSync(path.join(root, "src/features/note/entities"), { recursive: true });
  fs.writeFileSync(path.join(root, "src/features/note/entities/model.ts"), "export type Note = { id: string };\n");
  const importer = path.join(root, "src/features/memo/services/server/memoService.ts");
  fs.mkdirSync(path.dirname(importer), { recursive: true });
  fs.writeFileSync(importer, 'import type { Note } from "@/features/note/entities/model";\n');
  const before = snapshot(root);
  const { stderr, exitCode } = await deleteCapturing(workspace, "note", { confirm: "note" });
  assert.equal(exitCode, 1);
  assert.match(stderr, /note は消さずに残るコードから import されているため削除できません/);
  assert.match(stderr, /src\/features\/memo\/services\/server\/memoService\.ts: @\/features\/note\/entities\/model/);
  assert.deepEqual(snapshot(root), before);

  fs.writeFileSync(importer, "export const memoService = {};\n");
  await deleteCapturing(workspace, "note", { confirm: "note" });
  assert.equal(fs.existsSync(path.join(root, "src/features/note/entities")), false);
});

test("追加ディレクトリの候補の中の import: --extra で選べば一緒に消え、選ばなければ確認の後に止まる", async () => {
  const note = base("note");
  const root = makeProject({ configs: { note }, cleanup });
  const workspace = createWorkspace(root);
  fs.mkdirSync(path.join(root, "src/features/note/entities"), { recursive: true });
  const extraDir = path.join(root, "src/app/(user)/notes");
  fs.mkdirSync(extraDir, { recursive: true });
  fs.writeFileSync(path.join(extraDir, "page.tsx"), 'import { x } from "@/features/note/entities/model";\n');
  const before = snapshot(root);
  const unchosen = await deleteCapturing(workspace, "note", { confirm: "note" });
  assert.equal(unchosen.exitCode, 1);
  assert.match(unchosen.stderr, /src\/app\/\(user\)\/notes\/page\.tsx: @\/features\/note\/entities\/model/);
  assert.deepEqual(snapshot(root), before);

  await deleteCapturing(workspace, "note", { confirm: "note", extras: ["src/app/(user)/notes"] });
  assert.equal(fs.existsSync(extraDir), false);
  assert.equal(fs.existsSync(path.join(root, "src/features/note/entities")), false);
});

/** 門番の規則がドメインのフォルダを features に持つ fork の状態 */
function gatedProject(features = '["shop"]') {
  const shop = base("shop");
  const root = makeProject({ configs: { shop }, cleanup });
  const workspace = createWorkspace(root);
  const rule = path.join(root, "src/featureGate/rules/shopping.ts");
  fs.mkdirSync(path.dirname(rule), { recursive: true });
  fs.writeFileSync(rule, `export const rule: FeatureGateRule = {\n  pathPatterns: ["/admin/shops"],\n  features: ${features},\n};\n`);
  return { root, workspace, rule };
}

test("門番の規則が features に持つドメインの削除は、何も消さずに規則の名前を出して止める(規則の features から先に外す、D26)", async () => {
  const gated = gatedProject();
  const before = snapshot(gated.root);
  const run = await deleteCapturing(gated.workspace, "shop", { confirm: "shop", removeConfig: true });
  assert.equal(run.exitCode, 1);
  assert.match(run.stderr, /門番の規則がこのドメイン\(shop\)を features に持つので削除を止めました[\s\S]*src\/featureGate\/rules\/shopping\.ts/);
  assert.deepEqual(snapshot(gated.root), before);
});

test("門番の規則が持たないドメインの削除は規則にも上書きにも触れない(同じ名前のファイルがあっても)", async () => {
  const other = gatedProject('["sample"]');
  await deleteCapturing(other.workspace, "shop", { confirm: "shop", removeConfig: true });
  assert.equal(fs.existsSync(other.rule), true);
  assert.equal(fs.existsSync(path.join(other.root, "src/features/shop")), false);
  const note = base("note");
  const root = makeProject({ configs: { note }, cleanup });
  const workspace = createWorkspace(root);
  const stray = path.join(root, "src/config/features/note.config.ts");
  fs.mkdirSync(path.dirname(stray), { recursive: true });
  fs.writeFileSync(stray, "export default {};\n");
  await deleteCapturing(workspace, "note", { confirm: "note", removeConfig: true });
  assert.equal(fs.existsSync(stray), true);
});
