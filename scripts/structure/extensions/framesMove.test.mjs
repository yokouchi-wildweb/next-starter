// 枠の宣言の名前の移し替え(./framesMove.mjs、pnpm check extensions -- frames-move)を一時の git リポで確かめる
// 実行: pnpm test scripts/structure/extensions/framesMove.test.mjs
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { closeTmp, commitAll, git as tgit, makeFork, makeParent, openTmp, write } from "../../../src/lib/forkOwnership/testRepos.mjs";
import { planFramesMove, runFramesMove } from "./framesMove.mjs";

const page = "export default function Page() { return null; }\n";
const git = (root, ...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();

/** 親の版(base)にルートを置き、fork の版で枠の宣言を足した一時リポ。base の sha と root を返す */
function repo(baseFiles, forkFiles) {
  const root = mkdtempSync(join(tmpdir(), "frames-move-"));
  const put = (files) => {
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), text);
    }
  };
  git(root, "init", "-q");
  git(root, "config", "user.email", "t@example.com");
  git(root, "config", "user.name", "t");
  put(baseFiles);
  git(root, "add", "-A");
  git(root, "commit", "-qm", "base");
  const base = git(root, "rev-parse", "HEAD");
  put(forkFiles);
  git(root, "add", "-A");
  git(root, "commit", "-qm", "fork");
  return { root, base };
}

const BASE = {
  "src/app/(user)/layout.tsx": page,
  "src/app/(user)/frame.default.ts": "export const frameDefault = { layout: {} };\n",
  "src/app/(user)/mypage/account/email/page.tsx": page,
};

test("移す: 親のルートの隣の fork の frame.ts → frame.override.ts(export override)、fork 自身の frame.default.ts → frame.ts(export frame)。dry-run は書かない", () => {
  const { root, base } = repo(BASE, {
    "src/app/(user)/frame.ts": "// src/app/(user)/frame.ts\nexport const frame = { layout: { hide: { footer: { sp: true } } } };\n",
    "src/app/(user)/mypage/account/email/frame.ts": "export const frame = { page: { fill: true } };\n",
    "src/app/(user)/mine/page.tsx": page,
    "src/app/(user)/mine/frame.default.ts": "export const frameDefault = { page: { fill: true } };\n",
    "src/app/(user)/own/page.tsx": page,
    "src/app/(user)/own/frame.ts": "export const frame = { page: { fill: true } };\n",
  });
  try {
    const plan = planFramesMove(root, { base });
    assert.deepEqual(
      plan.moves.map((m) => `${m.from} → ${m.to}`),
      [
        "src/app/(user)/frame.ts → src/app/(user)/frame.override.ts",
        "src/app/(user)/mine/frame.default.ts → src/app/(user)/mine/frame.ts",
        "src/app/(user)/mypage/account/email/frame.ts → src/app/(user)/mypage/account/email/frame.override.ts",
      ],
      "fork 自身のルートの frame.ts は動かさない",
    );
    assert.deepEqual(plan.stops, []);
    const out = [];
    assert.equal(runFramesMove(root, ["--base", base], { stdout: { write: (t) => out.push(t) } }), 0);
    assert.ok(existsSync(join(root, "src/app/(user)/frame.ts")), "dry-run は書かない");
    assert.equal(runFramesMove(root, ["--base", base, "--apply"], { stdout: { write: () => {} } }), 0);
    assert.equal(readFileSync(join(root, "src/app/(user)/frame.override.ts"), "utf8"), "// src/app/(user)/frame.override.ts\nexport const override = { layout: { hide: { footer: { sp: true } } } };\n");
    assert.equal(readFileSync(join(root, "src/app/(user)/mine/frame.ts"), "utf8"), "export const frame = { page: { fill: true } };\n");
    assert.ok(!existsSync(join(root, "src/app/(user)/frame.ts")) && !existsSync(join(root, "src/app/(user)/mine/frame.default.ts")));
    const tracked = git(root, "ls-files", "src/app");
    assert.ok(tracked.includes("src/app/(user)/frame.override.ts") && !tracked.split("\n").includes("src/app/(user)/frame.ts"), "git mv と git add まで(コミットは呼ぶ側)");
    assert.deepEqual(planFramesMove(root, { base }).moves, [], "2 回目は何もしない");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("止まる: 行き先が既にある・export が読めない。--json の形。基準が決まらなければ exit 2", () => {
  const { root, base } = repo(BASE, {
    "src/app/(user)/frame.ts": "export const frame = { layout: {} };\n",
    "src/app/(user)/frame.override.ts": "export const override = { layout: {} };\n",
    "src/app/(user)/mypage/account/email/frame.ts": "const x = {};\nexport const frame = x;\n",
  });
  try {
    const out = [];
    assert.equal(runFramesMove(root, ["--base", base, "--json"], { stdout: { write: (t) => out.push(t) } }), 1);
    const json = JSON.parse(out.join(""));
    assert.deepEqual(Object.keys(json), ["apply", "base", "upstreamTrees", "moves", "stops"]);
    assert.deepEqual(json.moves, []);
    assert.deepEqual(json.stops.map((s) => s.path), ["src/app/(user)/frame.ts", "src/app/(user)/mypage/account/email/frame.ts"]);
    assert.match(json.stops[0].why, /行き先 .*frame\.override\.ts が既にある/);
    const err = [];
    assert.equal(runFramesMove(root, [], { stdout: { write: () => {} }, stderr: { write: (t) => err.push(t) } }), 2);
    assert.match(err.join(""), /基準の版が決まらない/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("上流が改名した frame.ts は 0 件: 台帳の行を書く前(基準 = 前の区間)でも、取り込み中(MERGE_HEAD)も取り込んだ後(親との分岐点)も上流の物は挙げない", () => {
  openTmp();
  try {
    const parent = makeParent();
    write(parent, "src/app/(user)/layout.tsx", page);
    write(parent, "src/app/(user)/frame.default.ts", "export const frameDefault = { layout: {} };\n");
    write(parent, "src/app/(user)/maintenance/page.tsx", page);
    write(parent, "src/app/(user)/maintenance/frame.default.ts", "export const frameDefault = { page: {} };\n");
    commitAll(parent, "routes");
    const fork = makeFork(parent);
    // 前の区間の後(台帳の upstream: = この版)。fork 自身のルートの既定は 1 本
    write(fork, "src/app/(user)/mine/page.tsx", page);
    write(fork, "src/app/(user)/mine/frame.default.ts", "export const frameDefault = { page: { fill: true } };\n");
    commitAll(fork, "own route");
    // 上流が改名する(2 段目)
    tgit(parent, "mv", "src/app/(user)/frame.default.ts", "src/app/(user)/frame.ts");
    tgit(parent, "mv", "src/app/(user)/maintenance/frame.default.ts", "src/app/(user)/maintenance/frame.ts");
    write(parent, "src/app/(user)/frame.ts", "export const frame = { layout: {} };\n");
    write(parent, "src/app/(user)/maintenance/frame.ts", "export const frame = { page: {} };\n");
    commitAll(parent, "rename");
    tgit(fork, "fetch", "-q", "upstream");
    const moved = (plan) => plan.moves.map((m) => m.from);
    // 取り込み中(merge --no-commit、/flux の手順の時点)
    tgit(fork, "merge", "--no-commit", "--no-ff", "-q", "upstream/main");
    const during = planFramesMove(fork);
    assert.deepEqual(moved(during), ["src/app/(user)/mine/frame.default.ts"], "上流の frame.ts 2 本は挙げない");
    assert.deepEqual(during.stops, []);
    assert.ok(during.upstreamTrees.some((t) => t.startsWith("MERGE_HEAD")));
    // 取り込んだ後(台帳の行はまだ前の版)
    tgit(fork, "commit", "-q", "--no-edit");
    const after = planFramesMove(fork);
    assert.deepEqual(moved(after), ["src/app/(user)/mine/frame.default.ts"]);
    assert.ok(after.upstreamTrees.some((t) => t.startsWith("merge-base")));
  } finally {
    closeTmp();
  }
});

test("fork のコミット(railroad のトラックなど)を取り込み中: MERGE_HEAD の木は上流と数えず、fork 自身のルートの frame.ts を挙げない。上流の改名は親の ref で数える", () => {
  openTmp();
  try {
    const parent = makeParent();
    write(parent, "src/app/(user)/layout.tsx", page);
    write(parent, "src/app/(user)/frame.default.ts", "export const frameDefault = { layout: {} };\n");
    commitAll(parent, "routes");
    const fork = makeFork(parent);
    // fork 自身のルート(旧い名前の宣言)
    write(fork, "src/app/(user)/own/page.tsx", page);
    write(fork, "src/app/(user)/own/frame.default.ts", "export const frameDefault = { page: { fill: true } };\n");
    commitAll(fork, "own route");
    // 上流が改名する(2 段目)
    tgit(parent, "mv", "src/app/(user)/frame.default.ts", "src/app/(user)/frame.ts");
    write(parent, "src/app/(user)/frame.ts", "export const frame = { layout: {} };\n");
    commitAll(parent, "rename");
    tgit(fork, "fetch", "-q", "upstream");
    // トラック: 上流を取り込む(fork 自身のルートは旧い名前のまま木にある)
    tgit(fork, "switch", "-q", "-c", "track");
    tgit(fork, "merge", "-q", "--no-edit", "upstream/main");
    // 本線: fork 自身の宣言を作ったリポの名前に移した後
    tgit(fork, "switch", "-q", "main");
    tgit(fork, "mv", "src/app/(user)/own/frame.default.ts", "src/app/(user)/own/frame.ts");
    write(fork, "src/app/(user)/own/frame.ts", "export const frame = { page: { fill: true } };\n");
    commitAll(fork, "own frame.ts");
    tgit(fork, "merge", "--no-commit", "--no-ff", "-q", "track");
    const plan = planFramesMove(fork);
    assert.deepEqual(plan.moves, [], "fork 自身の own/frame.ts も上流の (user)/frame.ts も挙げない");
    assert.deepEqual(plan.stops, []);
    assert.ok(!plan.upstreamTrees.some((t) => t.startsWith("MERGE_HEAD")), "トラックのコミットは上流の木に数えない");
    assert.ok(plan.upstreamTrees.includes("upstream/main"));
  } finally {
    closeTmp();
  }
});
