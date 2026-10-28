// dc:delete を止める判定（主と従属の組を壊す削除だけを止める）の回帰テスト。
// 止まる経路は runDelete を直接呼ぶ（名前の再入力より前に戻るので対話は出ない）。止まらない経路は判定が null であることを見る。
// 実行: pnpm test:dc-delete-stop
import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { runDelete } from "../cli/delete.mjs";
import { createWorkspace } from "../domain/workspace.mjs";
import { deleteStopMessage } from "../pipeline/remove/index.mjs";
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
  generateFiles: { entities: true },
  ...extra,
});
const photos = { name: "photos", label: "写真", fieldType: "mediaCollection", formInput: "mediaUploaderMulti", required: true, reorderable: true, collection: { domain: "album_photo" } };
const album = base("album", [photos]);
const albumPhoto = buildChildDomainConfig(album, photos).config;

/** runDelete を呼び、標準エラーと exitCode を返す（exitCode は元に戻す） */
async function deleteCapturing(workspace, domain) {
  const errors = [];
  const originalError = console.error;
  const originalExit = process.exitCode;
  console.error = (message) => errors.push(String(message));
  try {
    await runDelete(workspace, domain);
    return { stderr: errors.join("\n"), exitCode: process.exitCode };
  } finally {
    console.error = originalError;
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
  assert.match(stderr, /album\/domain\.json の集まりの項目 "photos" を外し、従属を dc:delete してから album を消してください/);
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

test("止まらない: 従属がまだ書き出されていない主・項目を外した後の従属・集まりでない belongsTo の参照・組の無いドメイン", () => {
  const notWritten = createWorkspace(makeProject({ configs: { album }, cleanup }));
  assert.equal(deleteStopMessage(notWritten, "album"), null);

  const detached = createWorkspace(makeProject({ configs: { album: base("album"), albumPhoto }, cleanup }));
  assert.equal(deleteStopMessage(detached, "albumPhoto"), null);
  assert.equal(deleteStopMessage(detached, "album"), null);

  const referrer = base("comment", [], {
    relations: [{ domain: "album", label: "a", fieldName: "album_id", fieldType: "uuid", relationType: "belongsTo", required: true, onDelete: "CASCADE" }],
  });
  const plain = createWorkspace(makeProject({ configs: { album: base("album"), comment: referrer }, cleanup }));
  assert.equal(deleteStopMessage(plain, "album"), null);
  assert.equal(deleteStopMessage(plain, "comment"), null);
});
