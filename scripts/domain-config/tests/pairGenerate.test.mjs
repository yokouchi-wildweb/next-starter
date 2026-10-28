// 主と従属の組の生成（組の解決・従属 → 主の順・書き出した従属をその場で生成・組の誤りは何も書かずに止める・最後の一覧）の回帰テスト。
// 一時の workspace で entities カテゴリだけを生成して確かめる（--only entities）。
// 実行: pnpm test:dc-pair-generate
import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { generateDomain, generateWithPairs, loadDomainForGenerate } from "../pipeline/generate.mjs";
import { runGenerateAll } from "../pipeline/generateAll.mjs";
import { assertPairs, orderWithPairs, resolvePairs } from "../pipeline/pairs.mjs";
import { createWorkspace } from "../domain/workspace.mjs";
import { makeProject, removeAll } from "./helpers.mjs";

const cleanup = [];
after(() => removeAll(cleanup));

const ONLY = ["entities"];
const GEN = { entities: true };
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
  generateFiles: { entities: true },
  ...extra,
});
const collectionField = (name, domain) => ({ name, label: name, fieldType: "mediaCollection", formInput: "mediaUploaderMulti", required: true, reorderable: true, collection: { domain, maxItems: 5 } });

const capture = () => {
  const lines = [];
  return { io: { log: (m) => lines.push(String(m)), warn: (m) => lines.push(`WARN ${m}`) }, text: () => lines.join("\n"), lines };
};
const drizzle = (root, domain) => path.join(root, "src", "features", domain, "entities", "drizzle.ts");
const domainJson = (root, domain) => path.join(root, "src", "features", domain, "domain.json");
const order = (lines) => lines.filter((l) => /の生成を開始します|Drizzle エンティティを生成しました/.test(l)).map((l) => l.match(/features\/(\w+)\/|\[(\w+)\]/).slice(1).find(Boolean));
const generateOne = (root, domain, options = {}) => {
  const workspace = createWorkspace(root);
  const out = capture();
  const ctx = loadDomainForGenerate(workspace, domain, out.io);
  generateWithPairs(ctx, workspace, GEN, { only: ONLY, io: out.io, ...options });
  return out;
};
const listFiles = (root) => fs.readdirSync(path.join(root, "src", "features"), { recursive: true }).sort();

test("主を生成すると、従属の domain.json を書き出してその中身で従属も生成し、従属 → 主の順。最後に一覧を出す", () => {
  const root = makeProject({ configs: { album: base("album", [collectionField("photos", "album_photo")]) }, cleanup });
  const out = generateOne(root, "album");
  assert.ok(fs.existsSync(domainJson(root, "albumPhoto")));
  assert.ok(fs.existsSync(drizzle(root, "albumPhoto")));
  assert.ok(fs.existsSync(drizzle(root, "album")));
  assert.deepEqual(order(out.lines).filter((d, i, a) => a.indexOf(d) === i), ["albumPhoto", "album"]);
  const text = out.text();
  assert.match(text, /\[組\] 書き出した domain\.json: .*albumPhoto\/domain\.json/);
  assert.match(text, /\[組\] db:push が要る表: album_photos（pnpm db:push を実行してください）/);
  assert.match(text, /\[組\] コミットに含めるもの: .*features\/albumPhoto\//);
  assert.match(fs.readFileSync(drizzle(root, "albumPhoto"), "utf8"), /album_id/);
});

test("従属を生成すると所有する主も続けて生成する。既にある従属は書き出さず、db:push の表も出さない", () => {
  const root = makeProject({ configs: { album: base("album", [collectionField("photos", "album_photo")]) }, cleanup });
  generateOne(root, "album");
  fs.rmSync(drizzle(root, "album"));
  const out = generateOne(root, "albumPhoto");
  assert.ok(fs.existsSync(drizzle(root, "album")));
  assert.match(out.text(), /\[組\] 書き出した domain\.json: なし/);
  assert.match(out.text(), /\[組\] db:push が要る表: なし/);
});

test("一括生成: 従属は主の直前、組に関わらないドメインの順は変えない", () => {
  const root = makeProject({
    configs: { album: base("album", [collectionField("photos", "album_photo")]), zoo: base("zoo"), apple: base("apple") },
    cleanup,
  });
  const out = capture();
  runGenerateAll(createWorkspace(root), ["album", "apple", "zoo"], null, ONLY, { io: out.io });
  const started = out.lines.filter((l) => l.includes("の生成を開始します")).map((l) => l.match(/\[(\w+)\]/)[1]);
  assert.deepEqual(started, ["albumPhoto", "album", "apple", "zoo"]);
  assert.ok(fs.existsSync(drizzle(root, "albumPhoto")));
  assert.match(out.text(), /\[組\] 書き出した domain\.json: .*albumPhoto/);
  assert.deepEqual(orderWithPairs(resolvePairs(createWorkspace(root)), ["apple", "zoo", "album", "albumPhoto"]), ["apple", "zoo", "albumPhoto", "album"]);
});

test("集まりの項目に従属の名前が無ければ、何も書かずに止まる（一括も）", () => {
  const root = makeProject({ configs: { album: base("album", [{ ...collectionField("photos", ""), collection: { maxItems: 3 } }]) }, cleanup });
  const before = listFiles(root);
  assert.throws(() => generateOne(root, "album"), /album: 集まりの項目 "photos" に従属のドメイン名（collection\.domain）がありません/);
  assert.throws(() => runGenerateAll(createWorkspace(root), ["album"], null, ONLY, { io: capture().io }), /何も生成せずに終了します/);
  assert.deepEqual(listFiles(root), before);
});

test("従属を所有する主が 2 つあれば、何も書かずに止まる", () => {
  const root = makeProject({
    configs: { album: base("album", [collectionField("photos", "shared_photo")]), book: base("book", [collectionField("photos", "shared_photo")]) },
    cleanup,
  });
  const before = listFiles(root);
  assert.throws(() => generateOne(root, "book"), /sharedPhoto: 従属を所有する主が 2 つ以上あります（album, book）/);
  assert.throws(() => generateOne(root, "album"), /2 つ以上/);
  assert.throws(() => runGenerateAll(createWorkspace(root), ["album", "book"], null, ONLY, { io: capture().io }), /2 つ以上/);
  assert.deepEqual(listFiles(root), before);
});

test("1 ドメインの生成は、関わらない主の組の誤りでは止まらない（一括は止まる）", () => {
  const root = makeProject({ configs: { album: base("album", [{ ...collectionField("photos", ""), collection: {} }]), apple: base("apple") }, cleanup });
  generateOne(root, "apple");
  assert.ok(fs.existsSync(drizzle(root, "apple")));
  assert.throws(() => assertPairs(resolvePairs(createWorkspace(root))), /collection\.domain/);
});

test("dry-run は何も書かず、一覧を「書き出す予定」として出す", () => {
  const root = makeProject({ configs: { album: base("album", [collectionField("photos", "album_photo")]) }, cleanup });
  const before = listFiles(root);
  const out = generateOne(root, "album", { dryRun: true });
  assert.deepEqual(listFiles(root), before);
  assert.match(out.text(), /\[dry-run\]\[組\] 書き出す予定の domain\.json: .*albumPhoto\/domain\.json/);
  assert.match(out.text(), /\[dry-run\] albumPhoto: 作成/);
});

test("集まりの無いドメインの生成は generateDomain と同じ出力（一覧も出さない）", () => {
  const rootA = makeProject({ configs: { apple: base("apple") }, cleanup });
  const rootB = makeProject({ configs: { apple: base("apple") }, cleanup });
  const viaPairs = generateOne(rootA, "apple").text().split(rootA).join("<ROOT>");
  const direct = capture();
  const workspace = createWorkspace(rootB);
  generateDomain(loadDomainForGenerate(workspace, "apple", direct.io), workspace, GEN, { io: direct.io });
  assert.equal(viaPairs, direct.text().split(rootB).join("<ROOT>"));
  assert.doesNotMatch(viaPairs, /\[組\]/);
  assert.equal(fs.readFileSync(drizzle(rootA, "apple"), "utf8"), fs.readFileSync(drizzle(rootB, "apple"), "utf8"));
});
