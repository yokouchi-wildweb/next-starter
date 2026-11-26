// scripts/structure/lib-package/moved.test.mjs
// moved の動き(指令 27 d3): 閉じた lib への付け替えの表を宣言と git の差分から出す。
// 実行: pnpm test scripts/structure/lib-package/moved.test.mjs
// fixture = 一時フォルダの git repo(2 commit: base と head)。

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { clearLibPackageCache } from "../../../src/lib/libPackage/node.mjs";
import { formatMoved, movedRows, runMoved } from "./moved.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const write = (root, files) => {
  for (const [name, body] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    writeFileSync(path.join(root, name), typeof body === "string" ? body : JSON.stringify(body, null, 2));
  }
};

function withGitRepo(fn) {
  const root = mkdtempSync(path.join(tmpdir(), "lib-moved-"));
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  try {
    git("init", "-q");
    git("config", "user.email", "test@example.test");
    git("config", "user.name", "test");
    git("config", "commit.gpgsign", "false");
    const commit = (message) => {
      git("add", "-A");
      git("commit", "-q", "-m", message);
      return git("rev-parse", "HEAD");
    };
    clearLibPackageCache();
    return fn({ root, git, commit });
  } finally {
    clearLibPackageCache();
    rmSync(root, { recursive: true, force: true });
  }
}

const TSCONFIG = { compilerOptions: { paths: { "@/*": ["./src/*"] } } };
const USE_X = `import { useState } from "react";\nexport function useX() {\n  const [v] = useState(1);\n  return v;\n}\n`;

function fixture({ root, git, commit }) {
  write(root, {
    "tsconfig.json": TSCONFIG,
    "src/hooks/useX.ts": USE_X,
    "src/lib/t/index.ts": `export { inner } from "./inner";\n`,
    "src/lib/t/inner.ts": "export const inner = 1;\n",
    "src/lib/t/inner2.ts": "export const inner2 = 1;\n",
    "src/lib/t/old.ts": "export const old = 1;\n",
    "src/lib/m/index.ts": "export const m = 1;\n",
    "src/lib/m/server.ts": `export { db } from "./impl/db";\n`,
    "src/lib/m/impl/db.ts": "export const db = 1;\n",
    "src/lib/u/inner.ts": "export const u = 1;\n",
    "src/app/a.ts": [
      `import { useX } from "@/hooks/useX";`,
      `import { inner } from "@/lib/t/inner";`,
      `import { inner as again } from "@/lib/t/inner";`,
      `import { inner2 } from "@/lib/t/inner2";`,
      `import { old } from "@/lib/t/old";`,
      `import { db } from "@/lib/m/impl/db";`,
      `import { m } from "@/lib/m";`,
      `import { u } from "@/lib/u/inner";`,
      `export const all = [useX, inner, again, inner2, old, db, m, u];`,
      "",
    ].join("\n"),
  });
  const base = commit("base");
  mkdirSync(path.join(root, "src/lib/x"), { recursive: true });
  git("mv", "src/hooks/useX.ts", "src/lib/x/useX.ts");
  git("rm", "-q", "src/lib/t/old.ts");
  write(root, {
    "src/lib/x/index.ts": `export { useX } from "./useX";\n`,
    "src/lib/x/package.json": { exports: { ".": "./index.ts" } },
    "src/lib/t/package.json": { exports: { ".": "./index.ts" } },
    "src/lib/m/package.json": { exports: { ".": "./index.ts", "./server": "./server.ts" } },
  });
  const head = commit("head");
  clearLibPackageCache();
  return { base, head };
}

test("moved: 閉じた lib へ移ったファイルの行・中を読む指定子 → 入口の行・消えた先・入口から出ていない物", () => {
  withGitRepo((ctx) => {
    const { base, head } = fixture(ctx);
    const rows = movedRows(ctx.root, { base });
    assert.equal(rows.head, "HEAD");
    assert.deepEqual(rows.moved, [{ from: "src/hooks/useX.ts", to: "src/lib/x/useX.ts" }]);
    assert.deepEqual(rows.imports, [
      { from: "@/hooks/useX", to: "@/lib/x", files: 1 },
      { from: "@/lib/m/impl/db", to: "@/lib/m/server", files: 1 },
      { from: "@/lib/t/inner", to: "@/lib/t", files: 2 },
    ]);
    // 入口を読む @/lib/m・閉じていない lib u の中は行にしない
    assert.deepEqual(rows.deleted, [{ from: "@/lib/t/old", file: "src/lib/t/old.ts" }]);
    assert.deepEqual(rows.unresolved, [{ from: "@/lib/t/inner2", file: "src/lib/t/inner2.ts", lib: "t" }]);
    assert.deepEqual({ ...movedRows(ctx.root, { base, head }), head: "HEAD" }, rows);
  });
});

test("moved: 出力は notice に貼れる moved: と imports: の 2 つの塊(--json は同じ物)", () => {
  withGitRepo((ctx) => {
    const { base } = fixture(ctx);
    const text = formatMoved(movedRows(ctx.root, { base }));
    const lines = text.split("\n");
    assert.equal(lines[0], "moved: src/hooks/useX.ts -> src/lib/x/useX.ts");
    assert.equal(lines[1], "imports: @/hooks/useX -> @/lib/x; @/lib/m/impl/db -> @/lib/m/server; @/lib/t/inner -> @/lib/t");
    assert.match(text, /^deleted: @\/lib\/t\/old \(src\/lib\/t\/old\.ts\)$/m);
    assert.match(text, /^unresolved: @\/lib\/t\/inner2 /m);
    const logs = [];
    assert.equal(runMoved(ctx.root, ["--base", base, "--json"], (l) => logs.push(l)), 0);
    assert.deepEqual(JSON.parse(logs[0]).moved, [{ from: "src/hooks/useX.ts", to: "src/lib/x/useX.ts" }]);
  });
});

test("moved: <base> で既に閉じていた lib の中を読む古い書き方は行にしない(<base>..<head> の変更だけ)", () => {
  withGitRepo((ctx) => {
    write(ctx.root, {
      "tsconfig.json": TSCONFIG,
      // c は <base> の前から閉じている lib。a.ts の @/lib/c/inner は <base> の時点で既に中を読む書き方
      "src/lib/c/package.json": { exports: { ".": "./index.ts" } },
      "src/lib/c/index.ts": `export { c } from "./inner";\n`,
      "src/lib/c/inner.ts": "export const c = 1;\n",
      "src/lib/k/index.ts": `export { k } from "./inner";\n`,
      "src/lib/k/inner.ts": "export const k = 1;\n",
      "src/app/a.ts": `import { c } from "@/lib/c/inner";\nimport { k } from "@/lib/k/inner";\nexport const all = [c, k];\n`,
    });
    const base = ctx.commit("base");
    // 範囲の中: k を閉じる。c の中のファイルを変えても(改名でも package.json でもない)行にしない
    write(ctx.root, {
      "src/lib/k/package.json": { exports: { ".": "./index.ts" } },
      "src/lib/c/inner.ts": "export const c = 2;\n",
    });
    ctx.commit("head");
    clearLibPackageCache();
    const rows = movedRows(ctx.root, { base });
    assert.deepEqual(rows.imports, [{ from: "@/lib/k/inner", to: "@/lib/k", files: 1 }]);
    assert.deepEqual(rows.unresolved, []);
  });
});

test("moved: 印のファイル(入口を re-export するだけのファイル)を通る行は re-export を辿って入口に解く", () => {
  withGitRepo((ctx) => {
    write(ctx.root, {
      "tsconfig.json": TSCONFIG,
      "src/lib/d/index.ts": `export { tx } from "./transaction";\nexport const d = 1;\n`,
      "src/lib/d/transaction.ts": "export const tx = 1;\nexport type Tx = number;\n",
      "src/app/a.ts": `import { tx, type Tx } from "@/lib/d/transaction";\nexport const v: Tx = tx;\n`,
    });
    const base = ctx.commit("base");
    // 中身を入口へ移し、transaction.ts は入口の名前を re-export する印として残して閉じる
    write(ctx.root, {
      "src/lib/d/package.json": { exports: { ".": "./index.ts" } },
      "src/lib/d/index.ts": "export const tx = 1;\nexport type Tx = number;\nexport const d = 1;\n",
      "src/lib/d/transaction.ts": `export { tx, type Tx } from "./index";\n`,
    });
    ctx.commit("head");
    clearLibPackageCache();
    const rows = movedRows(ctx.root, { base });
    assert.deepEqual(rows.imports, [{ from: "@/lib/d/transaction", to: "@/lib/d", files: 1 }]);
    assert.deepEqual(rows.unresolved, []);
  });
});

test("moved: 閉じる段で消した束(入口 \".\" にたたんだ client/index.ts)は <base> の版を読み、名前ごとに今の入口へ解く", () => {
  withGitRepo((ctx) => {
    write(ctx.root, {
      "tsconfig.json": TSCONFIG,
      "src/lib/s/index.ts": `export { ref } from "./ref";\n`,
      "src/lib/s/ref.ts": "export const ref = 1;\n",
      "src/lib/s/client/index.ts": `export { upload, type Upload } from "./upload";\nexport * from "./types";\n`,
      "src/lib/s/client/upload.ts": "export const upload = 1;\nexport type Upload = number;\n",
      "src/lib/s/client/types.ts": "export type Progress = number;\n",
      "src/lib/s/server/fake.ts": "export const fake = 1;\n",
      "src/lib/s/server/index.ts": `export { fake } from "./fake";\n`,
      "src/lib/s/gone.ts": "export const gone = 1;\n",
      "src/lib/s/mixed/index.ts": `export { upload } from "../client/upload";\nexport { fake } from "../server/fake";\n`,
      "src/lib/s/partial/index.ts": `export { ref } from "../ref";\nexport { hidden } from "./hidden";\n`,
      "src/lib/s/partial/hidden.ts": "export const hidden = 1;\n",
      "src/app/a.ts": [
        `import { upload, type Progress } from "@/lib/s/client";`,
        `import { upload as u2, fake } from "@/lib/s/mixed";`,
        `import { hidden } from "@/lib/s/partial";`,
        `import { gone } from "@/lib/s/gone";`,
        "",
      ].join("\n"),
    });
    const base = ctx.commit("base");
    // 閉じる: client/index.ts は "." に、mixed は "." と "./server" に分かれ、partial の hidden はどこからも出ない。gone は束でない
    ctx.git("rm", "-q", "src/lib/s/client/index.ts", "src/lib/s/mixed/index.ts", "src/lib/s/partial/index.ts", "src/lib/s/gone.ts");
    write(ctx.root, {
      "src/lib/s/package.json": { exports: { ".": "./index.ts", "./server": "./server/index.ts" } },
      "src/lib/s/index.ts": `export { ref } from "./ref";\nexport { upload, type Upload } from "./client/upload";\nexport * from "./client/types";\n`,
    });
    ctx.commit("head");
    clearLibPackageCache();
    const rows = movedRows(ctx.root, { base });
    assert.deepEqual(rows.imports, [
      {
        from: "@/lib/s/client",
        to: "@/lib/s",
        files: 1,
        byName: {
          upload: { to: "@/lib/s", name: "upload" },
          Upload: { to: "@/lib/s", name: "Upload" },
          Progress: { to: "@/lib/s", name: "Progress" },
        },
      },
      {
        from: "@/lib/s/mixed",
        to: "@/lib/s, @/lib/s/server",
        files: 1,
        byName: { upload: { to: "@/lib/s", name: "upload" }, fake: { to: "@/lib/s/server", name: "fake" } },
      },
    ]);
    assert.deepEqual(rows.unresolved, [{ from: "@/lib/s/partial", file: "src/lib/s/partial/index.ts", lib: "s" }], "どの入口からも出ない名前を持つ束");
    assert.deepEqual(rows.deleted, [{ from: "@/lib/s/gone", file: "src/lib/s/gone.ts" }], "束でない消えたファイルは今までどおり");
  });
});

test("moved: 引数の誤り(--base 無し・知らない引数・commit でない rev)は exit 2", () => {
  withGitRepo((ctx) => {
    fixture(ctx);
    const logs = [];
    const log = (l) => logs.push(l);
    assert.equal(runMoved(ctx.root, [], log), 2);
    assert.equal(runMoved(ctx.root, ["--base", "HEAD~1", "--what"], log), 2);
    assert.equal(runMoved(ctx.root, ["--base", "no-such-rev"], log), 2);
    assert.match(logs.join("\n"), /--base <rev> が要ります/);
    assert.match(logs.join("\n"), /知らない引数 --what/);
    assert.match(logs.join("\n"), /no-such-rev は commit ではありません/);
  });
});

// 計画書 04 の前の main(指令 23 の base)と、指令 25・26 の移動が済んだ後の commit(比べ先)。
// 比べ先を HEAD にしないのは、移した後でファイルを書き直すと git が改名と見なくなるから(frameDims の登録の形で
// useFrameDimsStyle.ts を書き直した build b2 の注文 82)。履歴に無い repo(fork の浅い clone など)では飛ばす
const SHEET04_BASE = "023ada03";
const SHEET04_HEAD = "c2aebb59";
const hasBase = [SHEET04_BASE, SHEET04_HEAD].every((rev) => {
  try {
    execFileSync("git", ["rev-parse", "--verify", "--quiet", `${rev}^{commit}`], { cwd: repo, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
});

test("d3: 今の repo で計画書 04 の前の main から: 指令 25・26 の 5 行が imports: に出る", { skip: !hasBase && `${SHEET04_BASE}・${SHEET04_HEAD} が履歴に無い` }, () => {
  clearLibPackageCache();
  const rows = movedRows(repo, { base: SHEET04_BASE, head: SHEET04_HEAD });
  const imports = Object.fromEntries(rows.imports.map((r) => [r.from, r.to]));
  for (const [from, to] of [
    ["@/hooks/useIsClient", "@/lib/isClient"],
    ["@/hooks/useFrameDimsStyle", "@/lib/frameDims"],
    ["@/lib/toast/useLoadingToast", "@/lib/toast"],
    ["@/lib/toast/useToast", "@/lib/toast"],
    ["@/lib/request/getClientIp", "@/lib/request"],
  ]) {
    assert.equal(imports[from], to, `${from} -> ${to} が無い: ${JSON.stringify(rows.imports)}`);
  }
  const moved = Object.fromEntries(rows.moved.map((r) => [r.from, r.to]));
  assert.equal(moved["src/hooks/useIsClient.ts"], "src/lib/isClient/useIsClient.ts");
  assert.equal(moved["src/hooks/useFrameDimsStyle.ts"], "src/lib/frameDims/useFrameDimsStyle.ts");
});
