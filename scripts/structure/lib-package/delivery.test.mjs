// scripts/structure/lib-package/delivery.test.mjs
// lib への設定の届け方(指令 24 d3): tsconfig.json の "@lib-config/*" の 1 行で、上書きのファイルが無い lib は
// tsc・tsx(pnpm task / scripts の実行)・pnpm test のどれでも解決の失敗で止まり(黙って既定にならない)、空の上書きを置くと通る。
// 実行: pnpm test scripts/structure/lib-package/delivery.test.mjs
// fixture = 一時フォルダの小さな repo。paths の行は本物の tsconfig.json から写す(行が変わる・消えるとここが落ちる)。
// next build・Turbopack での確かめは指令 25(toast)。

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import ts from "typescript";

import { clearLibPackageCache } from "../../../src/lib/libPackage/index.mjs";
import { BASE_ARGS } from "../../runner/test/run.mjs";
import { expectedPaths } from "./standalone.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const KEY = "@lib-config/*";

const realTsconfig = () => ts.readConfigFile(path.join(repo, "tsconfig.json"), ts.sys.readFile).config;
const realLine = () => realTsconfig().compilerOptions.paths[KEY];

/** lib x が @lib-config/x を読む小さな repo。override: undefined = 上書き無し / 文字列 = その中身 */
function withRepo(override, fn) {
  const root = mkdtempSync(path.join(tmpdir(), "lib-config-"));
  const files = {
    "tsconfig.json": JSON.stringify({
      compilerOptions: { target: "ES2020", module: "esnext", moduleResolution: "bundler", strict: true, noEmit: true, skipLibCheck: true, types: [], paths: { [KEY]: realLine() } },
      include: ["src/**/*.ts", "scripts/run.ts"],
    }),
    "src/lib/x/index.ts": `import override from "@lib-config/x";\nexport const config = { ...override };\n`,
    "scripts/run.ts": `import { config } from "../src/lib/x/index";\nconsole.log("loaded", JSON.stringify(config));\n`,
    "scripts/x.test.ts": `import { test } from "node:test";\nimport { config } from "../src/lib/x/index";\ntest("reads", () => { if (typeof config !== "object") throw new Error("no config"); });\n`,
  };
  if (override !== undefined) files["src/config/lib/x.config.ts"] = override;
  try {
    for (const [name, body] of Object.entries(files)) {
      mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
      writeFileSync(path.join(root, name), body);
    }
    return fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const EMPTY = "export default {};\n";

function tsc(root) {
  const configFile = path.join(root, "tsconfig.json");
  const parsed = ts.parseJsonConfigFileContent(ts.readConfigFile(configFile, ts.sys.readFile).config, ts.sys, root, undefined, configFile);
  const program = ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options });
  return ts.getPreEmitDiagnostics(program).map((d) => `TS${d.code} ${ts.flattenDiagnosticMessageText(d.messageText, "\n")}`);
}

const TSX = path.join(repo, "node_modules/.bin/tsx");
/** pnpm test の起動の形(scripts/runner/test/run.mjs の BASE_ARGS。preload は repo の絶対パスに直す) */
const testArgs = () => BASE_ARGS.slice(1).map((a) => (a.startsWith("./scripts/") ? path.join(repo, a) : a));
const spawn = (root, args) => {
  // NODE_TEST_CONTEXT を外す(残すと子の --test が「入れ子の実行」として飛ばされる)
  const { NODE_TEST_CONTEXT: _ctx, ...env } = process.env;
  const r = spawnSync(TSX, args, { cwd: root, encoding: "utf8", env: { ...env, NODE_OPTIONS: "" } });
  return { status: r.status, out: `${r.stdout}\n${r.stderr}` };
};

test("tsconfig.json の \"@lib-config/*\" は 1 行・候補 1 つで src/config/lib/<名前>.config.ts を指す", () => {
  const paths = realTsconfig().compilerOptions.paths;
  assert.deepEqual(Object.keys(paths).filter((k) => k.startsWith("@lib-config")), [KEY]);
  assert.deepEqual(realLine(), ["./src/config/lib/*.config.ts"]);
});

test("lib の単体用 tsconfig.json の @lib-config/<自分> の行は、ルートの 1 行と同じ先を指す", () => {
  withRepo(EMPTY, (root) => {
    writeFileSync(path.join(root, "src/lib/x/package.json"), JSON.stringify({ exports: { ".": "./index.ts" } }));
    clearLibPackageCache();
    const [own] = expectedPaths(root, "x")["@lib-config/x"];
    const fromLib = path.resolve(root, "src/lib/x", own);
    const fromRoot = path.resolve(root, realLine()[0].replace("*", "x"));
    assert.equal(fromLib, fromRoot);
    clearLibPackageCache();
  });
});

test("tsc: 上書きが無いと解決の失敗(TS2307)で止まり、空の上書きで通る", () => {
  withRepo(undefined, (root) => {
    const errors = tsc(root);
    assert.ok(errors.some((e) => e.startsWith("TS2307") && e.includes("@lib-config/x")), errors.join("\n"));
  });
  withRepo(EMPTY, (root) => assert.deepEqual(tsc(root), []));
});

test("tsx(pnpm task / scripts の実行): 上書きが無いと解決の失敗で止まり、空の上書きで通る", () => {
  withRepo(undefined, (root) => {
    const r = spawn(root, ["scripts/run.ts"]);
    assert.notEqual(r.status, 0, r.out);
    assert.match(r.out, /ERR_MODULE_NOT_FOUND|Cannot find (module|package) '@lib-config\/x'/);
    assert.doesNotMatch(r.out, /loaded/);
  });
  withRepo(EMPTY, (root) => {
    const r = spawn(root, ["scripts/run.ts"]);
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /loaded \{\}/);
  });
});

test("pnpm test(テストの起動の形): 上書きが無いとテストのファイルが解決の失敗で落ち、空の上書きで通る", () => {
  withRepo(undefined, (root) => {
    const r = spawn(root, [...testArgs(), "--test", "scripts/x.test.ts"]);
    assert.notEqual(r.status, 0, r.out);
    assert.match(r.out, /ERR_MODULE_NOT_FOUND|Cannot find (module|package) '@lib-config\/x'/);
  });
  withRepo(EMPTY, (root) => {
    const r = spawn(root, [...testArgs(), "--test", "scripts/x.test.ts"]);
    assert.equal(r.status, 0, r.out);
  });
});
