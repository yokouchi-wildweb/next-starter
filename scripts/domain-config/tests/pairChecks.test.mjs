// 主と従属の組の書く前の検査（checks/pairs.mjs・checks/accessRules.mjs）の回帰テスト。項目ごとに通る例と誤りの例を見る。
// 誤りがあると全件を並べて止まり、何も書かれない。知らせるだけのものは止めない。
// 実行: pnpm test:dc-pair-checks
import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ruleCovers } from "../checks/accessRules.mjs";
import { createWorkspace } from "../domain/workspace.mjs";
import { generateWithPairs, loadDomainForGenerate } from "../pipeline/generate.mjs";
import { assertPairs, resolvePairs } from "../pipeline/pairs.mjs";
import { buildChildDomainConfig } from "../render/collections/childDomainConfig.mjs";
import { makeProject, removeAll, repoRoot } from "./helpers.mjs";

const cleanup = [];
after(() => removeAll(cleanup));

const ADMIN = { roleCategories: ["admin"] };
const field = (overrides = {}) => ({
  name: "photos",
  label: "写真",
  fieldType: "mediaCollection",
  formInput: "mediaUploaderMulti",
  required: true,
  reorderable: true,
  collection: { domain: "album_photo", maxItems: 5 },
  ...overrides,
});
const owner = (fieldOverrides = {}, extra = {}) => ({
  domainConfigVersion: "1.3",
  singular: "album",
  plural: "albums",
  label: "アルバム",
  dbEngine: "Neon",
  idType: "uuid",
  relations: [],
  useCreatedAt: true,
  useUpdatedAt: true,
  fields: [{ name: "name", label: "名前", fieldType: "string", formInput: "textInput", required: true }, field(fieldOverrides)],
  apiAccess: { read: "public", write: ADMIN },
  generateFiles: { entities: true },
  ...extra,
});
const childOf = (ownerConfig) => buildChildDomainConfig(ownerConfig, ownerConfig.fields[1]).config;
const withFile = (child, storage) => ({ ...child, fields: [{ ...child.fields[0], storage }, ...child.fields.slice(1)] });

/** 一時の workspace（ロール editor = admin、member = user）で組を解く */
function resolve({ ownerConfig = owner(), child, others = {} } = {}) {
  const configs = { album: ownerConfig, ...others };
  if (child !== undefined) configs.albumPhoto = child;
  const root = makeProject({ configs, cleanup });
  const rolesDir = path.join(root, "src", "features", "core", "user", "roles");
  fs.mkdirSync(rolesDir, { recursive: true });
  fs.writeFileSync(path.join(rolesDir, "editor.role.json"), JSON.stringify({ id: "editor", category: "admin" }));
  fs.writeFileSync(path.join(rolesDir, "member.role.json"), JSON.stringify({ id: "member", category: "user" }));
  const workspace = createWorkspace(root);
  return { root, workspace, pairs: resolvePairs(workspace) };
}
const errorsOf = (args) => resolve(args).pairs.errors.map((e) => e.message);
const noticesOf = (args) => resolve(args).pairs.notices.map((e) => e.message);
const expectError = (args, pattern) => assert.match(errorsOf(args).join("\n"), pattern);

test("広さの比べ方: public ⊇ authenticated ⊇ ロールの規則 ⊇ none、ロールはカテゴリに解いて比べる", () => {
  const categories = new Map([["editor", "admin"], ["member", "user"]]);
  const cases = [
    ["public", "authenticated", true], ["authenticated", "public", false], ["authenticated", ADMIN, true], [ADMIN, "authenticated", false],
    [ADMIN, "none", true], ["none", ADMIN, false], ["none", "none", true],
    [ADMIN, { roles: ["editor"] }, true], [{ roles: ["editor"] }, ADMIN, false], [ADMIN, { roles: ["member"] }, false],
    [{ roles: ["editor", "member"] }, { roles: ["member"] }, true], [{ roleCategories: ["admin", "user"] }, { roles: ["member"] }, true],
    [ADMIN, { roles: ["unknown"] }, false],
  ];
  for (const [broad, narrow, expected] of cases) assert.equal(ruleCovers(broad, narrow, categories), expected, `${JSON.stringify(broad)} ⊇ ${JSON.stringify(narrow)}`);
});

test("雛形どおりの組（showcase の fixture を含む）はすべての項目を通り、知らせることも無い", () => {
  assert.deepEqual(errorsOf(), []);
  assert.deepEqual(noticesOf(), []);
  assert.deepEqual(errorsOf({ child: childOf(owner()) }), []);
  const showcase = JSON.parse(fs.readFileSync(path.join(repoRoot, "scripts/domain-config/tests/fixtures/parity/synthetic/showcase/domain.json"), "utf8"));
  const root = makeProject({ configs: { showcase }, cleanup });
  const pairs = resolvePairs(createWorkspace(root));
  assert.deepEqual([...pairs.errors, ...pairs.notices], []);
});

test("a. 主の集まりの項目にファイルの条件があれば誤り", () => {
  expectError({ ownerConfig: owner({ accept: "image/*", storage: { visibility: "public" } }) }, /集まりの項目 "photos": ファイルの条件（accept, storage）は主に書けません。albumPhoto\/domain\.json の file/);
});

test("b. 主への belongsTo は 1 本・必須・CASCADE", () => {
  const child = childOf(owner());
  expectError({ child: { ...child, relations: [] } }, /主（album）への belongsTo がちょうど 1 本必要です（今 0 本）/);
  expectError({ child: { ...child, relations: [child.relations[0], child.relations[0]] } }, /今 2 本/);
  expectError({ child: { ...child, relations: [{ ...child.relations[0], onDelete: "RESTRICT" }] } }, /required: true と onDelete: "CASCADE"/);
  expectError({ child: { ...child, relations: [{ ...child.relations[0], required: false }] } }, /required: true と onDelete/);
});

test("d. 論理削除の従属は誤り", () => {
  expectError({ child: { ...childOf(owner()), useSoftDelete: true } }, /useSoftDelete は false/);
});

test("e. メディア項目はちょうど 1 つ、集まりは持たない", () => {
  const child = childOf(owner());
  expectError({ child: { ...child, fields: child.fields.slice(1) } }, /今 mediaUploader 0 \/ 集まり 0/);
  expectError(
    { child: { ...child, fields: [...child.fields, { name: "more", label: "x", fieldType: "mediaCollection", formInput: "mediaUploaderMulti", collection: { domain: "x" } }] } },
    /集まり 1/,
  );
});

test("f. 並び列: sortOrderField・その項目・systemColumns（reorderable: false でも要る）", () => {
  const child = childOf(owner());
  expectError({ child: { ...child, sortOrderField: undefined } }, /sortOrderField を宣言してください/);
  expectError({ child: { ...child, fields: [child.fields[0]] } }, /sortOrderField "sort_order" の項目が fields にありません/);
  expectError({ child: { ...child, systemColumns: [] } }, /systemColumns に入れてください/);
  expectError({ ownerConfig: owner({ reorderable: false }), child: { ...child, sortOrderField: undefined } }, /主の項目が reorderable: false でも要ります/);
  assert.deepEqual(errorsOf({ ownerConfig: owner({ reorderable: false }), child }), []);
});

test("g. 主から埋められない必須の項目は誤り、既定値があれば通る", () => {
  const child = childOf(owner());
  const extra = { name: "caption", label: "説明", fieldType: "string", formInput: "textInput", required: true };
  expectError({ child: { ...child, fields: [...child.fields, extra] } }, /必須の項目 "caption" は主の画面から埋められません/);
  assert.deepEqual(errorsOf({ child: { ...child, fields: [...child.fields, { ...extra, defaultValue: "" }] } }), []);
});

test("h. upload: 従属が狭ければ誤り、広ければ知らせるだけ", () => {
  const child = childOf(owner());
  const narrow = withFile(child, { ...child.fields[0].storage, upload: { roles: ["editor"] } });
  const ownerByRoles = owner({}, { apiAccess: { read: "public", write: { roles: ["editor", "member"] } } });
  expectError({ ownerConfig: ownerByRoles, child: narrow }, /storage\.upload \{"roles":\["editor"\]\} が主の create・update .* より狭く/);
  const broad = withFile(child, { ...child.fields[0].storage, upload: "authenticated" });
  assert.deepEqual(errorsOf({ child: broad }), []);
  assert.match(noticesOf({ child: broad }).join("\n"), /storage\.upload "authenticated" は主の create・update .* より広い/);
  // ロールをカテゴリに解くと等しい規則（editor は admin カテゴリ）は狭いとも広いともしない
  const sameByCategory = { ownerConfig: owner({}, { apiAccess: { read: "public", write: { roles: ["editor"], roleCategories: ["admin"] } } }), child: withFile(child, { ...child.fields[0].storage, upload: ADMIN }) };
  assert.deepEqual(errorsOf(sameByCategory), []);
  assert.deepEqual(noticesOf(sameByCategory), []);
  // admin カテゴリの規則は、その中の 1 ロールより広い（従属が 1 ロールなら狭い = 誤り）
  expectError({ child: withFile(child, { ...child.fields[0].storage, upload: { roles: ["editor"] } }) }, /より狭く/);
});

test("h. read: 従属が主の get より狭ければ誤り、広いのと従属が public なのは通す。主の規則が写せなければ見ない", () => {
  const ownerAuth = owner({}, { apiAccess: { read: "authenticated", write: ADMIN } });
  const child = childOf(ownerAuth);
  expectError({ ownerConfig: ownerAuth, child: withFile(child, { ...child.fields[0].storage, read: ADMIN }) }, /storage\.read .* が主の get "authenticated" より狭く/);
  assert.deepEqual(errorsOf({ ownerConfig: ownerAuth, child: withFile(child, { ...child.fields[0].storage, read: "public" }) }), []);
  assert.deepEqual(errorsOf({ ownerConfig: ownerAuth, child: withFile(child, { visibility: "public", upload: ADMIN, read: ADMIN }) }), []);
  const closed = owner({}, { apiAccess: { read: "none", write: "none" } });
  assert.deepEqual(errorsOf({ ownerConfig: closed, child: withFile(child, { visibility: "private", upload: { roles: ["member"] }, read: { roles: ["member"] } }) }), []);
});

test("i. 63 字: 従属の表名、短い FK 名も超えるとき", () => {
  const child = childOf(owner());
  expectError({ child: { ...child, plural: "x".repeat(64) } }, /表名 "x{64}" が 63 字を超えます/);
  expectError({ child: { ...child, plural: "y".repeat(50), relations: [{ ...child.relations[0], fieldName: "z".repeat(12) }] } }, /主への FK 名 .* が 63 字を超えます/);
});

test("j. 名前の衝突: 従属の表名が他のドメインと重なる、主の項目名が他の項目・関係と重なる", () => {
  const other = { ...owner(), singular: "photo_box", plural: "album_photos", fields: [], label: "x" };
  expectError({ others: { photoBox: other } }, /表名 "album_photos" が photoBox\/domain\.json の表と重なります/);
  const clash = owner({}, { relations: [{ domain: "user", label: "u", fieldName: "photos", fieldType: "uuid", relationType: "belongsTo" }] });
  expectError({ ownerConfig: clash }, /集まりの項目 "photos": 項目名が主の他の項目・関係の fieldName と重なります/);
});

test("k. 必須 × duplicate: false は誤り、必須でなければ通る", () => {
  expectError({ ownerConfig: owner({ collection: { domain: "album_photo", duplicate: false } }) }, /required の集まりに collection\.duplicate: false は書けません/);
  assert.deepEqual(errorsOf({ ownerConfig: owner({ required: false, collection: { domain: "album_photo", duplicate: false } }) }), []);
});

test("l. 従属の汎用 API が開いていれば知らせるだけ", () => {
  const child = { ...childOf(owner()), apiAccess: { read: ADMIN, write: "none" } };
  assert.deepEqual(errorsOf({ child }), []);
  assert.match(noticesOf({ child }).join("\n"), /汎用 API（apiAccess）が開いています/);
  assert.match(noticesOf({ child: { ...child, apiAccess: undefined } }).join("\n"), /開いています/);
});

test("誤りが複数あれば全件を並べて止まり、何も書かない（1 ドメインの生成・知らせるだけのものは出す）", () => {
  const child = { ...childOf(owner()), useSoftDelete: true, systemColumns: [], apiAccess: { read: ADMIN, write: ADMIN } };
  const { root, workspace, pairs } = resolve({ ownerConfig: owner({ accept: "image/*" }), child });
  const before = fs.readdirSync(path.join(root, "src"), { recursive: true }).sort();
  assert.throws(() => assertPairs(pairs, ["album"]), (error) => {
    for (const pattern of [/ファイルの条件/, /useSoftDelete/, /systemColumns/]) assert.match(error.message, pattern);
    assert.match(error.message, /何も生成せずに終了します/);
    return true;
  });
  const ctx = loadDomainForGenerate(workspace, "album", { log() {}, warn() {} });
  assert.throws(() => generateWithPairs(ctx, workspace, { entities: true }, { only: ["entities"], io: { log() {}, warn() {} } }), /何も生成せずに終了します/);
  assert.deepEqual(fs.readdirSync(path.join(root, "src"), { recursive: true }).sort(), before);
  assert.doesNotThrow(() => assertPairs(pairs, ["unrelated"]));
});
