// scripts/structure/lib-package/declare.test.mjs
// 宣言の道具(declare.mjs): fork の自前の lib に package.json と tsconfig.json を書き、祖先の lib と宣言済みの lib は拒む。
// 実行: pnpm test scripts/structure/lib-package/declare.test.mjs
// fixture = 一時フォルダの小さな fork の repo(git なし → 全部を歩いて走査)

import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { clearLibPackageCache, readLibPackage } from "../../../src/lib/libPackage/node.mjs";
import { checkLibs } from "./check.mjs";
import { ownUndeclaredLibs, planDeclare, runDeclare, suggestEntry } from "./declare.mjs";

const ROOT_TSCONFIG = {
  compilerOptions: { target: "ES2020", module: "esnext", moduleResolution: "bundler", strict: true, noEmit: true, skipLibCheck: true, types: [], paths: { "@/*": ["./src/*"] } },
};

// fork1 = 葉の fork。祖先 next-starter の lib は cn(宣言済み)と up(宣言なし)、自前の lib は mine と bare
const FILES = {
  "tsconfig.json": ROOT_TSCONFIG,
  "repo.json": { repo_id: "fork1", tier: "leaf" },
  "src/lib/CATALOG.md": "# lib\n\n## next-starter\n\n- src/lib/cn — クラス名\n- src/lib/up — 祖先の lib\n\n## fork1\n\n- src/lib/mine — 自前の lib\n- src/lib/bare — 入口の無い自前の lib\n",
  "src/lib/cn/package.json": { exports: { ".": "./index.ts" } },
  "src/lib/cn/index.ts": "export const cn = (...a: string[]) => a.join(' ');\n",
  "src/lib/up/index.ts": "export const up = 1;\n",
  "src/components/Box/index.ts": "export const Box = 1;\n",
  "src/lib/mine/index.ts": 'import { cn } from "@/lib/cn";\nimport { Box } from "@/components/Box";\nexport const mine = [cn, Box];\n',
  "src/lib/mine/server.ts": 'import { helper } from "./inner";\nexport const serverOnly = helper;\n',
  "src/lib/mine/inner.ts": "export const helper = 1;\n",
  "src/lib/mine/tool.ts": "export const tool = 1;\n",
  "src/lib/mine/mine.test.ts": 'import { mine } from "./index";\nexport const t = mine;\n',
  "src/lib/bare/thing.ts": 'import { x } from "@/domains/shop/x";\nexport const thing = x;\n',
  "src/domains/shop/x.ts": "export const x = 1;\n",
  "src/domains/shop/a.ts": 'import { mine } from "@/lib/mine";\nexport const a = mine;\n',
  "src/app/api/r/route.ts": 'import { helper } from "@/lib/mine/inner";\nexport const r = helper;\n',
  "scripts/t.ts": 'import { tool } from "@/lib/mine/tool";\nexport const t = tool;\n',
};

function withRepo(fn) {
  const root = mkdtempSync(path.join(tmpdir(), "lib-declare-"));
  try {
    for (const [name, body] of Object.entries(FILES)) {
      mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
      writeFileSync(path.join(root, name), typeof body === "string" ? body : JSON.stringify(body, null, 2));
    }
    clearLibPackageCache();
    return fn(root);
  } finally {
    clearLibPackageCache();
    rmSync(root, { recursive: true, force: true });
  }
}

const quiet = () => {
  let text = "";
  return { stdout: { write: (/** @type {string} */ s) => (text += s) }, text: () => text };
};

test("自前の lib: 入口(ファイルの名前から)・libs・peers を推し、外から中を読む import は入口の候補を添えて一覧に出す", () => {
  withRepo((root) => {
    const plan = planDeclare(root, "mine");
    assert.equal(plan.status, "plan");
    assert.deepEqual(plan.packageJson, { exports: { ".": "./index.ts", "./server": "./server.ts" }, libs: ["cn"], peers: ["components"] });
    assert.deepEqual(plan.tsconfig.compilerOptions.paths, { "@/components/*": ["../../components/*"], "@/lib/cn": ["../cn"], "@/lib/cn/*": ["../cn/*"] });
    assert.deepEqual(
      plan.unresolved.map((u) => [u.kind, u.file, u.specifier]),
      [
        ["inner", "scripts/t.ts", "@/lib/mine/tool"],
        ["inner", "src/app/api/r/route.ts", "@/lib/mine/inner"],
      ],
    );
    assert.match(plan.unresolved[0].detail, /候補 \.\/node。そのファイルはまだ無い/);
    assert.match(plan.unresolved[1].detail, /候補 \.\/server\)/);
  });
});

test("--apply で package.json と tsconfig.json を書き、宣言した lib として読める(検査の undeclared が消える)", () => {
  withRepo((root) => {
    assert.ok(checkLibs(root).problems.some((p) => p.lib === "mine" && p.code === "undeclared"));
    const io = quiet();
    assert.equal(runDeclare(root, ["mine", "--apply"], io), 1, "決めきれない所があれば 1");
    assert.match(io.text(), /書いた src\/lib\/mine\/package\.json/);
    const pkg = readLibPackage(root, "mine");
    assert.deepEqual(pkg?.problems, []);
    assert.deepEqual(pkg?.libs, ["cn"]);
    assert.deepEqual(JSON.parse(readFileSync(path.join(root, "src/lib/mine/tsconfig.json"), "utf8")).extends, "../../../tsconfig.json");
    assert.ok(!checkLibs(root).problems.some((p) => p.lib === "mine" && p.code === "undeclared"));
  });
});

test("祖先の lib・宣言済みの lib・節に無い lib は拒み、書かない", () => {
  withRepo((root) => {
    const up = planDeclare(root, "up");
    assert.equal(up.status, "refused");
    assert.match(up.reason, /祖先の lib です/);
    assert.match(planDeclare(root, "cn").reason, /宣言済みです/);
    assert.match(planDeclare(root, "nope").reason, /がありません/);
    const io = quiet();
    assert.equal(runDeclare(root, ["up", "--apply"], io), 1);
    assert.match(io.text(), /拒む up: /);
    assert.equal(existsSync(path.join(root, "src/lib/up/package.json")), false);
  });
});

test("名指ししなければ自分の節の宣言の無い lib 全部。入口が無い・lib が読めない所を読むのは決めきれない所に出す", () => {
  withRepo((root) => {
    assert.deepEqual(ownUndeclaredLibs(root), ["bare", "mine"]);
    const bare = planDeclare(root, "bare");
    assert.deepEqual(bare.packageJson.exports, {});
    assert.deepEqual(
      bare.unresolved.map((u) => u.kind),
      ["noEntry", "outside"],
    );
    const io = quiet();
    runDeclare(root, [], io);
    assert.match(io.text(), /書く\(dry-run\) src\/lib\/bare\/package\.json/);
    assert.match(io.text(), /書く\(dry-run\) src\/lib\/mine\/package\.json/);
    assert.equal(existsSync(path.join(root, "src/lib/mine/package.json")), false, "dry-run は書かない");
  });
});

test("suggestEntry: 読み手の場所から入口の候補", () => {
  assert.equal(suggestEntry("scripts/x.ts"), "./node");
  assert.equal(suggestEntry("servers/room/src/a.ts"), "./node");
  assert.equal(suggestEntry("src/domains/a/services/server/s.ts"), "./server");
  assert.equal(suggestEntry("src/app/api/x/route.ts"), "./server");
  assert.equal(suggestEntry("src/domains/a/components/A.tsx"), ".");
});
