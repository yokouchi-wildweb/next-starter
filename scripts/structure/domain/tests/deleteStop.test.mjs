// pnpm generate domain -- --delete を止める判定（他のドメインから参照されているドメインの削除・残るコードから import されているドメインの削除を止める）と、既定の対話なしの確認（--confirm）の回帰テスト。
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
import { entityDeclarationPath, makeProject, removeAll } from "./helpers.mjs";

const cleanup = [];
after(() => removeAll(cleanup));

const base = (singular, fields = [], extra = {}) => ({
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
const photos = { name: "photos", label: "写真", fieldType: "mediaCollection", formInput: "mediaUploaderMulti", required: true, reorderable: true, collection: { registration: "album_photo" } };
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

test("主: 集まりの従属は主のドメインの中の登録なので一緒に消え、止まらない（D348）", async () => {
  const root = makeProject({ configs: { album }, registrations: { "album/albumPhoto": albumPhoto }, cleanup });
  const workspace = createWorkspace(root);
  assert.equal(deleteStopMessage(workspace, "album"), null);
  await deleteCapturing(workspace, "album", { confirm: "album", removeConfig: true });
  assert.equal(fs.existsSync(path.join(root, "src/domains/album")), false);
});
const relation = (domain, relationType, fieldName, extra = {}) => ({ domain, label: "a", fieldName, fieldType: "uuid", relationType, ...extra });

test("止まらない: 従属がまだ書き出されていない主・組も参照も無いドメイン", () => {
  const notWritten = createWorkspace(makeProject({ configs: { album }, cleanup }));
  assert.equal(deleteStopMessage(notWritten, "album"), null);

  const none = createWorkspace(makeProject({ configs: { note: base("note"), memo: base("memo") }, cleanup }));
  assert.equal(deleteStopMessage(none, "note"), null);
});

test("inboundReferences: どの種類の関連で指されても domain と fieldName を返す。snake_case の名前も camelCase のフォルダと照合する", () => {
  const configs = new Map([
    ["album", [base("album")]],
    ["comment", [base("comment", [], { relations: [relation("album", "belongsTo", "album_id")] })]],
    ["tag", [base("tag", [], { relations: [relation("album", "belongsToMany", "album_ids")] })]],
    ["inverse", [base("inverse", [], { relations: [relation("album", "belongsToMany", "album_ids", { includeRelationTable: false })] })]],
    ["shelf", [base("shelf", [], { relations: [relation("album", "hasMany", "album_id")] })]],
    ["cover", [base("cover", [], { relations: [relation("album", "hasOne", "album_id")] })]],
    ["other", [base("other", [], { relations: [relation("note", "belongsTo", "note_id")] })]],
    ["broken", [null]],
  ]);
  assert.deepEqual(inboundReferences(configs, "album"), [
    { domain: "comment", fieldName: "album_id", relationType: "belongsTo" },
    { domain: "tag", fieldName: "album_ids", relationType: "belongsToMany" },
    { domain: "inverse", fieldName: "album_ids", relationType: "belongsToMany" },
    { domain: "shelf", fieldName: "album_id", relationType: "hasMany" },
    { domain: "cover", fieldName: "album_id", relationType: "hasOne" },
  ]);
  const snake = new Map([["comment", [base("comment", [], { relations: [relation("album_photo", "belongsTo", "album_photo_id")] })]]]);
  assert.deepEqual(inboundReferences(snake, "albumPhoto"), [{ domain: "comment", fieldName: "album_photo_id", relationType: "belongsTo" }]);
});

test("inboundReferences: 主でない登録の関連も数え、消すドメインの中の登録の名前で指す関連でも止める", () => {
  const configs = new Map([
    ["album", [base("album"), base("albumPhoto")]],
    // 参照元の主でない登録(shelfItem)が、消すドメインの主でない登録(album_photo)を登録名で指す
    ["shelf", [base("shelf"), base("shelfItem", [], { relations: [relation("album_photo", "belongsTo", "album_photo_id")] })]],
  ]);
  assert.deepEqual(inboundReferences(configs, "album"), [], "登録名を渡さなければフォルダ名だけを見る");
  assert.deepEqual(inboundReferences(configs, "album", ["album", "albumPhoto"]), [{ domain: "shelf", fieldName: "album_photo_id", relationType: "belongsTo" }]);
});

test("inboundReferences: 自己参照と、消すドメイン自身が持つ外向きの関連は数えない", () => {
  const configs = new Map([
    ["node", [base("node", [], { relations: [relation("node", "belongsTo", "parent_id"), relation("album", "belongsTo", "album_id")] })]],
    ["album", [base("album")]],
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

test("主の停止: 他のドメインの参照元は出し、ドメインの中の従属は参照元に数えない", () => {
  const comment = base("comment", [], { relations: [relation("album", "belongsTo", "album_id")] });
  const workspace = createWorkspace(makeProject({ configs: { album, comment }, registrations: { "album/albumPhoto": albumPhoto }, cleanup }));
  const message = deleteStopMessage(workspace, "album");
  assert.match(message, /comment: album_id（belongsTo）/);
  assert.doesNotMatch(message, /albumPhoto/);
});
test("主でない登録の関連: 他のドメインの主でない登録が消すドメインの主でない登録を指していれば止まる", () => {
  const shelfItem = base("shelfItem", [], { relations: [relation("album_photo", "belongsTo", "album_photo_id")] });
  const workspace = createWorkspace(makeProject({ configs: { album, shelf: base("shelf") }, registrations: { "album/albumPhoto": albumPhoto, "shelf/shelfItem": shelfItem }, cleanup }));
  assert.match(deleteStopMessage(workspace, "album"), /shelf: album_photo_id（belongsTo）/);
});
test("--confirm: 無い・違うなら消すものの一覧と打てるコマンドを出して止まり、何も消さない。一致なら消し、宣言(domain.json と entities/<d>/entity.json)は --remove-config のときだけ消す", async () => {
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

  fs.writeFileSync(path.join(root, "src/domains/note/entities/model.ts"), "export type Note = { id: string };\n");
  await deleteCapturing(workspace, "note", { confirm: "note" });
  assert.equal(fs.existsSync(path.join(root, "src/domains/note/entities/model.ts")), false);
  assert.equal(fs.existsSync(path.join(root, "src/domains/note/domain.json")), true);
  assert.equal(fs.existsSync(entityDeclarationPath(root, "note")), true);
  await deleteCapturing(workspace, "note", { confirm: "note", removeConfig: true });
  assert.equal(fs.existsSync(path.join(root, "src/domains/note/domain.json")), false);
  assert.equal(fs.existsSync(entityDeclarationPath(root, "note")), false);
});

test("codeReferences: @/domains/<d>・@/domains/core/<d>（core/ を省いた書き方も）・相対パスの import を拾い、消すフォルダ・一緒に消すディレクトリ・src/registry は数えない", () => {
  const files = [
    { path: "src/domains/order/services/server/orderService.ts", text: 'import { couponService } from "@/domains/coupon/services/server/couponService";\nimport type { X } from "@/domains/couponIssuer/types";' },
    { path: "src/app/api/me/coupon/route.ts", text: 'export { GET } from "@/domains/core/coupon/routes";\nconst m = await import("@/domains/coupon");' },
    { path: "src/domains/core/wallet/x.ts", text: 'import { a } from "../coupon/utils/a";' },
    { path: "src/domains/core/wallet/y.ts", text: '// import { a } from "@/domains/coupon";\n/* import "@/domains/coupon"; */' },
    { path: "src/domains/core/coupon/internal.ts", text: 'import { b } from "@/domains/coupon/b";' },
    { path: "src/app/admin/(protected)/coupons/page.tsx", text: 'import { c } from "@/domains/coupon/c";' },
    { path: "src/registry/serviceRegistry.ts", text: 'coupon: { service: () => import("@/domains/core/coupon/services/server/couponService").then((m) => m.couponService) },' },
    { path: "src/domains/core/wallet/README.md", text: 'import { a } from "@/domains/coupon";' },
  ];
  assert.deepEqual(codeReferences(files, "src/domains/core/coupon", ["src/app/admin/(protected)/coupons"]), [
    { file: "src/domains/order/services/server/orderService.ts", source: "@/domains/coupon/services/server/couponService" },
    { file: "src/app/api/me/coupon/route.ts", source: "@/domains/core/coupon/routes" },
    { file: "src/app/api/me/coupon/route.ts", source: "@/domains/coupon" },
    { file: "src/domains/core/wallet/x.ts", source: "../coupon/utils/a" },
  ]);
  // business のドメインは @/domains/<d> だけ（名前が前方一致するだけの別ドメインは数えない）
  assert.deepEqual(codeReferences([files[0]], "src/domains/couponIssuer"), [{ file: files[0].path, source: "@/domains/couponIssuer/types" }]);
});

test("残るコードから import されているドメイン: 参照元のファイルと from 先を全部出して止まり、何も消さない。import を外せば消せる", async () => {
  const note = base("note");
  const memo = base("memo");
  const root = makeProject({ configs: { note, memo }, cleanup });
  const workspace = createWorkspace(root);
  fs.writeFileSync(path.join(root, "src/domains/note/entities/model.ts"), "export type Note = { id: string };\n");
  const importer = path.join(root, "src/domains/memo/services/server/memoService.ts");
  fs.mkdirSync(path.dirname(importer), { recursive: true });
  fs.writeFileSync(importer, 'import type { Note } from "@/domains/note/entities/model";\n');
  const before = snapshot(root);
  const { stderr, exitCode } = await deleteCapturing(workspace, "note", { confirm: "note" });
  assert.equal(exitCode, 1);
  assert.match(stderr, /note は消さずに残るコードから import されているため削除できません/);
  assert.match(stderr, /src\/domains\/memo\/services\/server\/memoService\.ts: @\/domains\/note\/entities\/model/);
  assert.deepEqual(snapshot(root), before);

  fs.writeFileSync(importer, "export const memoService = {};\n");
  await deleteCapturing(workspace, "note", { confirm: "note" });
  assert.equal(fs.existsSync(path.join(root, "src/domains/note/entities/model.ts")), false);
});

test("追加ディレクトリの候補の中の import: --extra で選べば一緒に消え、選ばなければ確認の後に止まる", async () => {
  const note = base("note");
  const root = makeProject({ configs: { note }, cleanup });
  const workspace = createWorkspace(root);
  fs.writeFileSync(path.join(root, "src/domains/note/entities/model.ts"), "export type Note = { id: string };\n");
  const extraDir = path.join(root, "src/app/(user)/notes");
  fs.mkdirSync(extraDir, { recursive: true });
  fs.writeFileSync(path.join(extraDir, "page.tsx"), 'import { x } from "@/domains/note/entities/model";\n');
  const before = snapshot(root);
  const unchosen = await deleteCapturing(workspace, "note", { confirm: "note" });
  assert.equal(unchosen.exitCode, 1);
  assert.match(unchosen.stderr, /src\/app\/\(user\)\/notes\/page\.tsx: @\/domains\/note\/entities\/model/);
  assert.deepEqual(snapshot(root), before);

  await deleteCapturing(workspace, "note", { confirm: "note", extras: ["src/app/(user)/notes"] });
  assert.equal(fs.existsSync(extraDir), false);
  assert.equal(fs.existsSync(path.join(root, "src/domains/note/entities/model.ts")), false);
});

/** 門番の規則がドメインのフォルダを domains に持つ fork の状態 */
function gatedProject(features = '["shop"]') {
  const shop = base("shop");
  const root = makeProject({ configs: { shop }, cleanup });
  const workspace = createWorkspace(root);
  const rule = path.join(root, "src/featureGate/rules/shopping.ts");
  fs.mkdirSync(path.dirname(rule), { recursive: true });
  fs.writeFileSync(rule, `export const rule: FeatureGateRule = {\n  pathPatterns: ["/admin/shops"],\n  domains: ${features},\n};\n`);
  return { root, workspace, rule };
}

test("門番の規則が domains に持つドメインの削除は、何も消さずに規則の名前を出して止める(規則の domains から先に外す、D26)", async () => {
  const gated = gatedProject();
  const before = snapshot(gated.root);
  const run = await deleteCapturing(gated.workspace, "shop", { confirm: "shop", removeConfig: true });
  assert.equal(run.exitCode, 1);
  assert.match(run.stderr, /門番の規則がこのドメイン\(shop\)を domains に持つので削除を止めました[\s\S]*src\/featureGate\/rules\/shopping\.ts/);
  assert.deepEqual(snapshot(gated.root), before);
});

test("門番の規則が持たないドメインの削除は規則にも上書きにも触れない(同じ名前のファイルがあっても)", async () => {
  const other = gatedProject('["sample"]');
  await deleteCapturing(other.workspace, "shop", { confirm: "shop", removeConfig: true });
  assert.equal(fs.existsSync(other.rule), true);
  assert.equal(fs.existsSync(path.join(other.root, "src/domains/shop")), false);
  const note = base("note");
  const root = makeProject({ configs: { note }, cleanup });
  const workspace = createWorkspace(root);
  const stray = path.join(root, "src/config/domains/note.config.ts");
  fs.mkdirSync(path.dirname(stray), { recursive: true });
  fs.writeFileSync(stray, "export default {};\n");
  await deleteCapturing(workspace, "note", { confirm: "note", removeConfig: true });
  assert.equal(fs.existsSync(stray), true);
});
