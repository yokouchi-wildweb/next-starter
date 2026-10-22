// dc:generate のドメインフォルダ名検査（フォルダ名 = camel(singular)）の回帰テスト。
// 実行: pnpm test:dc-domain-folder
import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertDomainFolderNames, checkDomainFolderName } from "./domainFolder.mjs";

const tmpDirs = [];
after(() => {
  for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
});

function makeFeaturesDir(domains) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dc-domain-folder-"));
  tmpDirs.push(dir);
  for (const [folder, config] of Object.entries(domains)) {
    fs.mkdirSync(path.join(dir, folder));
    fs.writeFileSync(path.join(dir, folder, "domain.json"), JSON.stringify(config));
  }
  return dir;
}

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
  const dir = makeFeaturesDir({
    sample: { singular: "sample" },
    namePool: { singular: "name_pool_entry" },
    shortName: { singular: "long_name" },
  });
  assert.throws(
    () => assertDomainFolderNames(dir, ["sample", "namePool", "shortName"]),
    (err) => /namePool/.test(err.message) && /shortName/.test(err.message) && !/"sample"/.test(err.message),
  );
});

test("一括検査は全件一致なら何もしない", () => {
  const dir = makeFeaturesDir({ sample: { singular: "sample" }, sampleTag: { singular: "sample_tag" } });
  assert.doesNotThrow(() => assertDomainFolderNames(dir, ["sample", "sampleTag"]));
});

test("リポジトリ内の既存ドメインはすべて一致している", () => {
  const featuresDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "src", "features");
  const folders = fs
    .readdirSync(featuresDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  assert.doesNotThrow(() => assertDomainFolderNames(featuresDir, folders));
});
