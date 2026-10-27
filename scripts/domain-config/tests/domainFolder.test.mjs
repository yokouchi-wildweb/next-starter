// dc:generate のドメインフォルダ名検査（フォルダ名 = camel(singular)）の回帰テスト。
// 実行: pnpm test:dc-domain-folder
import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { assertDomainFolderNames, checkDomainFolderName } from "../checks/domainFolder.mjs";
import { createWorkspace } from "../domain/workspace.mjs";
import { makeProject, removeAll, repoRoot } from "./helpers.mjs";

const cleanup = [];
after(() => removeAll(cleanup));

const workspaceWith = (domains) => createWorkspace(makeProject({ configs: domains, cleanup }));

test("フォルダ名が camel(singular) と一致すれば通る", () => {
  assert.equal(checkDomainFolderName("sampleCategory", { singular: "sample_category" }), null);
  assert.equal(checkDomainFolderName("sample", { singular: "sample" }), null);
});

test("singular 未宣言は検査しない", () => {
  assert.equal(checkDomainFolderName("anything", {}), null);
});

test("フォルダ名がずれていれば期待するフォルダ名を含むエラーを返す", () => {
  const error = checkDomainFolderName("namePool", { singular: "name_pool_entry" });
  assert.match(error, /"namePool"/);
  assert.match(error, /"name_pool_entry"/);
  assert.match(error, /期待するフォルダ名: "namePoolEntry"/);
});

test("一括検査は不一致を全件並べて投げる", () => {
  const workspace = workspaceWith({
    sample: { singular: "sample" },
    namePool: { singular: "name_pool_entry" },
    shortName: { singular: "long_name" },
  });
  assert.throws(
    () => assertDomainFolderNames(workspace, ["sample", "namePool", "shortName"]),
    (err) => /namePool/.test(err.message) && /shortName/.test(err.message) && !/"sample"/.test(err.message),
  );
});

test("一括検査は全件一致なら何もしない", () => {
  const workspace = workspaceWith({ sample: { singular: "sample" }, sampleTag: { singular: "sample_tag" } });
  assert.doesNotThrow(() => assertDomainFolderNames(workspace, ["sample", "sampleTag"]));
});

test("リポジトリ内の既存ドメインはすべて一致している", () => {
  const workspace = createWorkspace(repoRoot);
  const folders = fs
    .readdirSync(path.join(repoRoot, "src", "features"), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  assert.doesNotThrow(() => assertDomainFolderNames(workspace, folders));
});
