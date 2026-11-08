// src/lib/libPackage/libPackage.test.mjs
// lib の package.json の読み手と形の検査の契約テスト。fixture は一時フォルダに作る(src の下に置かない)。
// 実行: pnpm test src/lib/libPackage/libPackage.test.mjs (node:test)
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  checkAllLibPackages,
  checkLibPackage,
  clearLibPackageCache,
  findEntry,
  hasLibPackage,
  libOfPath,
  listDeclaredLibs,
  listLibs,
  listLibsFrom,
  readLibPackage,
} from "./index.mjs";

const root = mkdtempSync(path.join(tmpdir(), "lib-package-"));
after(() => rmSync(root, { recursive: true, force: true }));

function write(rel, content) {
  const file = path.join(root, rel);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, typeof content === "string" ? content : JSON.stringify(content, null, 2));
}

/** lib を 1 本作る(pkg = package.json の中身、undefined なら置かない。文字列ならそのまま) */
function lib(name, pkg, files = ["index.ts"]) {
  for (const file of files) write(`src/lib/${name}/${file}`, "export {};\n");
  if (pkg !== undefined) write(`src/lib/${name}/package.json`, pkg);
}

lib("cn", undefined);
lib("plain", undefined);
lib("ok", { exports: { ".": "./index.ts", "./server": "./server.ts", "./hooks": "./hooks/index.tsx" }, libs: ["cn"], peers: ["components"], sideEffects: false }, [
  "index.ts",
  "server.ts",
  "hooks/index.tsx",
  "inner.ts",
]);
lib("sidefx", { exports: { ".": "./index.ts" }, sideEffects: ["./register.ts"] }, ["index.ts", "register.ts"]);
lib("broken", "{ not json");
lib("named", { name: "@x/named", exports: { ".": "./index.ts" } });
lib("extra", { exports: { ".": "./index.ts" }, dependencies: { cn: "lib" } });
lib("noexports", {});
lib("emptyexports", { exports: {} });
lib("pattern", { exports: { "./*": "./*.ts" } });
lib("condition", { exports: { ".": { import: "./index.ts", default: "./index.ts" } } });
lib("keyform", { exports: { index: "./index.ts" } });
lib("outside", { exports: { ".": "../ok/index.ts" } });
lib("mismatch", { exports: { "./client": "./index.ts" } });
lib("missing", { exports: { ".": "./index.ts", "./gone": "./gone.ts" } });
lib("noext", { exports: { ".": "./index" } });
lib("badlibs", { exports: { ".": "./index.ts" }, libs: ["cn", "cn", "badlibs", "nope"] });
lib("libsshape", { exports: { ".": "./index.ts" }, libs: { cn: "lib" } });
lib("badpeers", { exports: { ".": "./index.ts" }, peers: ["hooks"] });
lib("sidetrue", { exports: { ".": "./index.ts" }, sideEffects: true });
write("src/lib/README.md", "# lib\n");

const codesOf = (name) => checkLibPackage(root, name).map((p) => p.code);

test("listLibs / hasLibPackage / listDeclaredLibs: src/lib 直下のフォルダだけ、宣言は package.json の有無", () => {
  assert.ok(listLibs(root).includes("plain"));
  assert.ok(!listLibs(root).includes("README.md"));
  assert.equal(hasLibPackage(root, "plain"), false);
  assert.equal(hasLibPackage(root, "ok"), true);
  assert.ok(!listDeclaredLibs(root).includes("plain"));
  assert.ok(listDeclaredLibs(root).includes("ok"));
});

test("listLibsFrom: 注入した listDir の src/lib 直下のフォルダだけを名前順に(listLibs と同じ結果)", () => {
  const seen = [];
  const listDir = (rel) => {
    seen.push(rel);
    return [
      { name: "zeta", isDir: true },
      { name: "README.md", isDir: false },
      { name: "alpha", isDir: true },
    ];
  };
  assert.deepEqual(listLibsFrom(listDir), ["alpha", "zeta"]);
  assert.deepEqual(seen, ["src/lib"]);
  assert.deepEqual(listLibsFrom(() => []), []);
  assert.deepEqual(listLibs(path.join(root, "missing")), []);
});

test("readLibPackage: 宣言の無い lib は null、正しい形は問題 0 で一覧を返す", () => {
  assert.equal(readLibPackage(root, "plain"), null);
  const pkg = readLibPackage(root, "ok");
  assert.deepEqual(pkg.problems, []);
  assert.equal(pkg.dir, "src/lib/ok");
  assert.deepEqual(
    pkg.exports.map((e) => [e.key, e.target, e.keyPath, e.targetPath]),
    [
      [".", "./index.ts", "", "index.ts"],
      ["./server", "./server.ts", "server", "server.ts"],
      ["./hooks", "./hooks/index.tsx", "hooks", "hooks/index.tsx"],
    ],
  );
  assert.deepEqual(pkg.libs, ["cn"]);
  assert.deepEqual(pkg.peers, ["components"]);
  assert.equal(pkg.sideEffects, false);
  assert.deepEqual(readLibPackage(root, "sidefx").sideEffects, ["./register.ts"]);
  assert.deepEqual(codesOf("sidefx"), []);
});

test("形の検査: 負例はそれぞれの問題の名前で止まる", () => {
  assert.deepEqual(codesOf("broken"), ["json"]);
  assert.deepEqual(codesOf("named"), ["name"]);
  assert.deepEqual(codesOf("extra"), ["unknownKey"]);
  assert.deepEqual(codesOf("noexports"), ["exportsMissing"]);
  assert.deepEqual(codesOf("emptyexports"), ["exportsShape"]);
  assert.ok(codesOf("pattern").includes("pattern"));
  assert.deepEqual(codesOf("condition"), ["condition"]);
  assert.ok(codesOf("keyform").includes("keyForm"));
  assert.deepEqual(codesOf("outside"), ["targetOutside"]);
  assert.deepEqual(codesOf("mismatch"), ["keyMismatch"]);
  assert.deepEqual(codesOf("missing"), ["targetMissing"]);
  assert.deepEqual(codesOf("noext"), ["targetExt"]);
  assert.deepEqual(codesOf("badlibs"), ["libDuplicate", "libSelf", "libUnknown"]);
  assert.deepEqual(codesOf("libsshape"), ["libsShape"]);
  assert.deepEqual(codesOf("badpeers"), ["peerUnknown"]);
  assert.deepEqual(codesOf("sidetrue"), ["sideEffectsShape"]);
  assert.deepEqual(codesOf("plain"), [], "宣言の無い lib は形の検査の対象外(L1.21)");
});

test("問題のある exports の行は入口に入れず、正しい行は残す", () => {
  const pkg = readLibPackage(root, "missing");
  assert.deepEqual(pkg.exports.map((e) => e.key), ["."]);
});

test("checkAllLibPackages: 宣言済みの lib ごとの報告と問題の数", () => {
  const report = checkAllLibPackages(root);
  assert.equal(report.declared, listDeclaredLibs(root).length);
  assert.deepEqual(report.libs.find((item) => item.lib === "ok").problems, []);
  assert.ok(report.problemCount >= 16);
});

test("checkAllLibPackages: 宣言の無い repo は 0 件", () => {
  const empty = mkdtempSync(path.join(tmpdir(), "lib-package-empty-"));
  try {
    mkdirSync(path.join(empty, "src/lib/a"), { recursive: true });
    assert.deepEqual(checkAllLibPackages(empty), { libs: [], declared: 0, problemCount: 0 });
  } finally {
    rmSync(empty, { recursive: true, force: true });
  }
});

test("libOfPath: src/lib/<name>/… だけを lib とみなす", () => {
  assert.equal(libOfPath("src/lib/ok/index.ts"), "ok");
  assert.equal(libOfPath("src/lib/ok"), "ok");
  assert.equal(libOfPath("src/lib/README.md"), null);
  assert.equal(libOfPath("src/lib"), null);
  assert.equal(libOfPath("src/components/Button"), null);
  assert.equal(libOfPath(null), null);
});

test("findEntry: 拡張子・index の有無によらず実パスで入口を照合する", () => {
  const pkg = readLibPackage(root, "ok");
  assert.equal(findEntry(pkg, "src/lib/ok")?.key, ".");
  assert.equal(findEntry(pkg, "src/lib/ok/index")?.key, ".");
  assert.equal(findEntry(pkg, "src/lib/ok/index.ts")?.key, ".");
  assert.equal(findEntry(pkg, "src/lib/ok/server")?.key, "./server");
  assert.equal(findEntry(pkg, "src/lib/ok/hooks")?.key, "./hooks");
  assert.equal(findEntry(pkg, "src/lib/ok/hooks/index.tsx")?.key, "./hooks");
  assert.equal(findEntry(pkg, "src/lib/ok/inner"), null);
  assert.equal(findEntry(pkg, "src/lib/okay/index"), null, "別の lib の前方一致に当てない");
  assert.equal(findEntry(null, "src/lib/ok"), null);
});

test("clearLibPackageCache: 書き換えた後に読み直す", () => {
  lib("later", undefined);
  assert.equal(readLibPackage(root, "later"), null);
  write("src/lib/later/package.json", { exports: { ".": "./index.ts" } });
  assert.equal(readLibPackage(root, "later"), null, "覚えた結果のまま");
  clearLibPackageCache();
  assert.deepEqual(readLibPackage(root, "later").problems, []);
});
