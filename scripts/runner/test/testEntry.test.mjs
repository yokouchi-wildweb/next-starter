// scripts/runner/test/testEntry.test.mjs — pnpm test の入口(走査・群・test-flags・--changed・起動の束ね方)。実行: pnpm test scripts/runner/test
import assert from "node:assert/strict";
import { test } from "node:test";

import { reachable, selectChanged } from "./changed.mjs";
import { BASE_ARGS, parseArgs, run, select } from "./run.mjs";
import { EXCLUDED, flagsOf, groupOf, NAMED_ONLY, TEST_FILE } from "./scan.mjs";

const FILES = ["src/a/a.test.ts", "src/a/b.db.test.ts", "src/c/c.test.mjs", "tests/mine/m.test.ts", "scripts/x/x.test.mts"];
const noRange = () => ({ files: null, why: "比べる上流の枝が無い" });

test("走査の規則: テストの拡張子、tests/e2e/・型のテストは除く、servers/ は名指しの時だけ / 群は db・fork(tests/ の下)・unit", () => {
  const keep = (f) => TEST_FILE.test(f) && !EXCLUDED.some((re) => re.test(f));
  assert.ok(keep("src/a.test.tsx") && keep("scripts/a.test.cjs") && keep("tests/a.test.ts"));
  assert.ok(!keep("tests/e2e/a.test.ts") && !keep("src/x.types.test.ts") && !keep("src/a.ts"));
  assert.ok(NAMED_ONLY.test("servers/room/a.test.ts") && !NAMED_ONLY.test("src/servers/a.test.ts"));
  assert.deepEqual(FILES.map(groupOf), ["unit", "db", "unit", "fork", "unit"]);
});

test("// test-flags: 先頭行だけ読む、許可の一覧に無いフラグは止める理由を返す", () => {
  assert.deepEqual(flagsOf("import x;\n"), { flags: [] });
  assert.deepEqual(flagsOf("import x;\n// test-flags: --x\n"), { flags: [] });
  assert.deepEqual(flagsOf("// test-flags: --a --b=1\n", ["--a", "--b"]), { flags: ["--a", "--b=1"] });
  assert.match(flagsOf("// test-flags: --inspect\n", []).problem, /許可されていないフラグ --inspect\(許可: なし/);
});

test("引数: 群・--db・--changed・--list・パス、知らない引数と群は止める", () => {
  assert.deepEqual(parseArgs(["--db", "--list", "src/a"]), { groups: null, db: true, changed: false, list: true, patterns: ["src/a"] });
  assert.deepEqual(parseArgs(["--group=db,fork"]).groups, ["db", "fork"]);
  assert.match(parseArgs(["--watch"]).problem, /知らない引数 --watch/);
  assert.match(parseArgs(["--group=e2e"]).problem, /知らない群 e2e/);
});

test("選ぶ: 既定 = unit + fork、--db で全部、--group でその群、パス(前方一致)と glob で絞る", async () => {
  const pick = async (argv) => (await select(parseArgs(argv), { repo: "/r", files: FILES, changed: noRange })).files;
  assert.deepEqual(await pick([]), ["src/a/a.test.ts", "src/c/c.test.mjs", "tests/mine/m.test.ts", "scripts/x/x.test.mts"]);
  assert.deepEqual(await pick(["--db"]), FILES);
  assert.deepEqual(await pick(["--group=db"]), ["src/a/b.db.test.ts"]);
  assert.deepEqual(await pick(["src/a"]), ["src/a/a.test.ts"]);
  assert.deepEqual(await pick(["**/*.mjs", "scripts/**"]), ["src/c/c.test.mjs", "scripts/x/x.test.mts"]);
});

test("servers/ の下: 既定と src/ のパスでは選ばない、servers/ を名指ししたパス・glob の時だけ選ぶ", async () => {
  const files = [...FILES, "servers/room/src/core/room.test.ts"];
  const pick = async (argv) => (await select(parseArgs(argv), { repo: "/r", files, changed: noRange })).files;
  assert.ok(!(await pick([])).includes("servers/room/src/core/room.test.ts"));
  assert.ok(!(await pick(["**/*.test.ts"])).includes("servers/room/src/core/room.test.ts"));
  assert.deepEqual(await pick(["servers/room"]), ["servers/room/src/core/room.test.ts"]);
  assert.deepEqual(await pick(["servers/**/*.test.ts"]), ["servers/room/src/core/room.test.ts"]);
});

test("--changed: import で届くテスト + 同じフォルダ、辿れないテストは同じフォルダだけで選び名前を出す、範囲が決まらなければ全部、変更 0 は 0 本", async () => {
  const tree = {
    "src/a/a.test.ts": [{ id: "src/lib/x.ts" }, { id: null }],
    "src/lib/x.ts": [{ id: "src/lib/y.ts" }],
    "src/c/c.test.mjs": [{ id: "src/c/c.mjs" }],
    "scripts/x/x.test.mts": [],
  };
  assert.deepEqual([...reachable(tree, "src/a/a.test.ts")].sort(), ["src/a/a.test.ts", "src/lib/x.ts", "src/lib/y.ts"]);
  const tests = ["src/a/a.test.ts", "src/c/c.test.mjs", "tests/mine/m.test.ts", "scripts/x/x.test.mts"];
  assert.deepEqual(selectChanged(tests, ["src/lib/y.ts"], tree), { selected: ["src/a/a.test.ts"], untraced: ["tests/mine/m.test.ts"] });
  assert.deepEqual(selectChanged(tests, ["src/c/other.ts", "tests/mine/m.ts"], tree).selected, ["src/c/c.test.mjs", "tests/mine/m.test.ts"]);
  assert.deepEqual(selectChanged(tests, ["scripts/x/x.test.mts"], tree).selected, ["scripts/x/x.test.mts"]);
  const viaSelect = await select(parseArgs(["--changed"]), { repo: "/r", files: FILES, changed: () => ({ files: ["src/lib/y.ts"] }), tree: async () => tree });
  assert.deepEqual(viaSelect.files, ["src/a/a.test.ts"]);
  assert.ok(viaSelect.notes.includes("依存を辿れなかった: tests/mine/m.test.ts(同じフォルダで選んだ)"));
  const none = await select(parseArgs(["--changed"]), { repo: "/r", files: FILES, changed: () => ({ files: [] }), tree: async () => { throw new Error("呼ばない"); } });
  assert.deepEqual(none.files, []);
  const unknown = await select(parseArgs(["--changed"]), { repo: "/r", files: FILES, changed: noRange });
  assert.equal(unknown.files.length, 4);
  assert.match(unknown.notes[0], /比べる上流の枝が無いので選んだ全部を回す/);
});

test("--changed: servers/ の下の変更が範囲にある時だけ、その下のテストも候補にする(全体の走査は今どおり外す)", async () => {
  const files = [...FILES, "servers/room/src/core/room.test.ts"];
  const tree = { "servers/room/src/core/room.test.ts": [{ id: "servers/room/src/core/room.ts" }], "src/a/a.test.ts": [{ id: "src/lib/x.ts" }] };
  const pick = async (changedFiles, argv = ["--changed"]) => (await select(parseArgs(argv), { repo: "/r", files, changed: () => ({ files: changedFiles }), tree: async () => tree })).files;
  assert.deepEqual(await pick(["servers/room/src/core/room.ts"]), ["servers/room/src/core/room.test.ts"]);
  assert.deepEqual(await pick(["servers/room/src/core/room.ts", "src/lib/x.ts"]), ["src/a/a.test.ts", "servers/room/src/core/room.test.ts"]);
  assert.deepEqual(await pick(["src/lib/x.ts"]), ["src/a/a.test.ts"]);
  assert.ok(!(await pick([], [])).includes("servers/room/src/core/room.test.ts"));
});

test("起動: 下駄と module mocks を常に付け、群(db は ENV_FILE)とフラグごとに束ねて 1 回ずつ、落ちたら exit 1、許可されないフラグは起動せず exit 2", async () => {
  const calls = [];
  const flags = { "scripts/x/x.test.mts": { flags: ["--a"] } };
  const deps = { repo: "/r", files: FILES, changed: noRange, log: () => {}, readFlags: (_r, f) => flags[f] ?? { flags: [] } };
  const savedOpen = process.env.FEATURE_GATE_OPEN;
  process.env.FEATURE_GATE_OPEN = "all";
  let code;
  try {
    code = await run(["--db"], { ...deps, spawn: (args, env) => (calls.push({ args, app: env.ENV_FILE, open: env.FEATURE_GATE_OPEN }), args.includes("src/a/b.db.test.ts") ? 1 : 0) });
  } finally {
    if (savedOpen === undefined) delete process.env.FEATURE_GATE_OPEN;
    else process.env.FEATURE_GATE_OPEN = savedOpen;
  }
  assert.equal(code, 1);
  assert.ok(calls.every((c) => c.open === undefined), "門番の全開スイッチ FEATURE_GATE_OPEN は子に渡さない");
  assert.deepEqual(calls.map((c) => [c.args.slice(BASE_ARGS.length), c.app === ".env.development"]), [
    [["--test", "src/a/a.test.ts", "src/c/c.test.mjs", "tests/mine/m.test.ts"], process.env.ENV_FILE === ".env.development"],
    [["--test", "src/a/b.db.test.ts"], true],
    [["--a", "--test", "scripts/x/x.test.mts"], process.env.ENV_FILE === ".env.development"],
  ]);
  for (const c of calls) assert.deepEqual(c.args.slice(0, BASE_ARGS.length), ["tsx", "--import", "./scripts/runner/preload/serverOnly.mjs", "--experimental-test-module-mocks"]);
  let spawned = 0;
  const bad = await run([], { ...deps, readFlags: () => ({ flags: ["--inspect"], problem: "許可されていないフラグ --inspect" }), spawn: () => (spawned++, 0) });
  assert.equal(bad, 2);
  assert.equal(spawned, 0);
  assert.equal(await run(["--list"], { ...deps, spawn: () => { throw new Error("起動しない"); } }), 0);
});
