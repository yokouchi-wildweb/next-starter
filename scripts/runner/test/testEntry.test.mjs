// scripts/runner/test/testEntry.test.mjs — pnpm test の入口(走査・群・test-flags・--changed・起動の束ね方)。実行: pnpm test scripts/runner/test
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { reachable, selectChanged } from "./changed.mjs";
import { BASE_ARGS, DEFAULT_TEST_TIMEOUT, globLiteral, parseArgs, run, select, testTimeoutArgs } from "./run.mjs";
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
  assert.deepEqual(parseArgs(["--db", "--list", "src/a"]), { groups: null, db: true, changed: false, list: true, fileTimeout: null, testTimeout: null, patterns: ["src/a"] });
  assert.deepEqual(parseArgs(["--group=db,fork"]).groups, ["db", "fork"]);
  assert.equal(parseArgs(["--file-timeout=300"]).fileTimeout, "300");
  assert.equal(parseArgs(["--file-timeout=0"]).fileTimeout, "0");
  assert.match(parseArgs(["--file-timeout=abc"]).problem, /--file-timeout は 0 以上の秒数/);
  assert.match(parseArgs(["--file-timeout=-1"]).problem, /--file-timeout は 0 以上の秒数/);
  assert.equal(parseArgs(["--test-timeout=90"]).testTimeout, "90");
  assert.match(parseArgs(["--test-timeout=x"]).problem, /--test-timeout は 0 以上の秒数/);
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

test("門が回すテスト(gate.json の check がテスト・tests の欄)は名指しでない時は除き、除いた本数と門の名を出す。名指しなら回す(D389)", async () => {
  const gateTests = () => new Map([["src/c/c.test.mjs", "cycles"], ["scripts/x/x.test.mts", "notices"]]);
  const sel = (argv) => select(parseArgs(argv), { repo: "/r", files: FILES, changed: noRange, gateTests });
  const all = await sel([]);
  assert.deepEqual(all.files, ["src/a/a.test.ts", "tests/mine/m.test.ts"]);
  assert.ok(all.notes.some((n) => /門が回すテスト 2 本を除いた\(cycles・notices/.test(n)));
  assert.ok(!all.notes.some((n) => n.startsWith("除いた:")));
  assert.ok((await sel(["--list"])).notes.includes("除いた: src/c/c.test.mjs(門 cycles)"));
  assert.deepEqual((await sel(["src/c/c.test.mjs"])).files, ["src/c/c.test.mjs"]);
  assert.deepEqual((await sel(["--group=unit"])).files, ["src/a/a.test.ts"]);
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
  const t = testTimeoutArgs(null).args;
  assert.deepEqual(calls.map((c) => [c.args.slice(BASE_ARGS.length), c.app === ".env.development"]), [
    [[...t, "--test", "src/a/a.test.ts", "src/c/c.test.mjs", "tests/mine/m.test.ts"], process.env.ENV_FILE === ".env.development"],
    [[...t, "--test", "src/a/b.db.test.ts"], true],
    [[...t, "--a", "--test", "scripts/x/x.test.mts"], process.env.ENV_FILE === ".env.development"],
  ]);
  for (const c of calls)
    assert.deepEqual(c.args.slice(0, BASE_ARGS.length), [
      "tsx",
      "--import",
      "./scripts/runner/preload/serverOnly.mjs",
      "--import",
      "./scripts/runner/preload/fileTimeout.mjs",
      "--experimental-test-module-mocks",
    ]);
  assert.ok(!BASE_ARGS.includes("--test-force-exit"), "force-exit は報告の終わりを消すので付けない(README 終わり方)");
  let spawned = 0;
  const bad = await run([], { ...deps, readFlags: () => ({ flags: ["--inspect"], problem: "許可されていないフラグ --inspect" }), spawn: () => (spawned++, 0) });
  assert.equal(bad, 2);
  assert.equal(spawned, 0);
  assert.equal(await run(["--list"], { ...deps, spawn: () => { throw new Error("起動しない"); } }), 0);
});

test("[param] の下: パスの絞り込みで選び、--test には glob にならない形で渡して node が実際に 1 本回す(0 本で黙って通らない)", async () => {
  const file = "src/app/admin/users/[id]/_screen/loader.test.ts";
  const files = [...FILES, file];
  const pick = async (argv) => (await select(parseArgs(argv), { repo: "/r", files, changed: noRange })).files;
  assert.ok((await pick([])).includes(file));
  assert.deepEqual(await pick([file]), [file]);
  assert.deepEqual(await pick(["src/app/admin/users/[id]"]), [file]);
  assert.equal(globLiteral(file), "src/app/admin/users/[[]id[]]/_screen/loader.test.ts");
  assert.equal(globLiteral("src/app/[...slug]/a.test.ts"), "src/app/[[]...slug[]]/a.test.ts");
  assert.equal(globLiteral("src/app/(user)/a.test.ts"), "src/app/(user)/a.test.ts");
  const calls = [];
  await run([file], { repo: "/r", files, changed: noRange, log: () => {}, readFlags: () => ({ flags: [] }), spawn: (args) => (calls.push(args), 0) });
  assert.deepEqual(calls.map((a) => a.slice(BASE_ARGS.length)), [[...testTimeoutArgs(null).args, "--test", globLiteral(file)]]);
  // 実物: [id] の下の置き物を node --test に渡すと 1 本回る(そのままのパスだと node は [id] を i か d の 1 文字と読み 0 本)
  const dir = mkdtempSync(join(tmpdir(), "runner-bracket-"));
  mkdirSync(join(dir, "[id]"));
  writeFileSync(join(dir, "[id]", "a.test.mjs"), 'import { test } from "node:test";\ntest("bracket", () => {});\n');
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;   // 外側の node --test の子として報告を親に回さず、自分で数を出させる
  const r = spawnSync(process.execPath, ["--test", globLiteral("[id]/a.test.mjs")], { cwd: dir, encoding: "utf8", env });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /tests 1\b/);
});

test("時間の上限: --file-timeout は子の env TEST_FILE_TIMEOUT に渡り(env より勝つ)、無ければ env のまま", async () => {
  const seen = [];
  const deps = { repo: "/r", files: ["src/a/a.test.ts"], changed: noRange, log: () => {}, readFlags: () => ({ flags: [] }), spawn: (_a, env) => (seen.push(env.TEST_FILE_TIMEOUT), 0) };
  const saved = process.env.TEST_FILE_TIMEOUT;
  process.env.TEST_FILE_TIMEOUT = "50";
  try {
    await run(["--file-timeout=300"], deps);
    await run([], deps);
  } finally {
    if (saved === undefined) delete process.env.TEST_FILE_TIMEOUT;
    else process.env.TEST_FILE_TIMEOUT = saved;
  }
  assert.deepEqual(seen, ["300", "50"]);
});

test("時間の上限(実物): 終わらないファイルは上限で落ちてまとめに名前が出る、ほかのファイルは回り続ける、0 は上限なし", () => {
  const dir = mkdtempSync(join(tmpdir(), "runner-timeout-"));
  writeFileSync(join(dir, "hang.test.mjs"), 'import { test } from "node:test";\ntest("passes but leaves a handle", () => { setInterval(() => {}, 1000); });\n');
  writeFileSync(join(dir, "ok.test.mjs"), 'import { test } from "node:test";\ntest("ok", () => {});\n');
  const preload = join(import.meta.dirname, "../preload/fileTimeout.mjs");
  const env = { ...process.env, TEST_FILE_TIMEOUT: "1" };
  delete env.NODE_TEST_CONTEXT;   // 外側の node --test の子として報告を親に回さず、自分で数を出させる
  const started = Date.now();
  const r = spawnSync(process.execPath, ["--import", preload, "--test", "--test-concurrency=0", "hang.test.mjs", "ok.test.mjs"], { cwd: dir, encoding: "utf8", env, timeout: 30_000 });
  const out = r.stdout + r.stderr;
  assert.equal(r.status, 1, out);
  assert.ok(Date.now() - started < 20_000, "上限で止まる");
  assert.match(out, /時間切れ 1 秒\(テストの後\): hang\.test\.mjs/);
  assert.match(out, /✖ hang\.test\.mjs/);
  assert.match(out, /pass 2\b/);
  // 0 = 上限なし: 普通に終わるファイルはそのまま通る(見張りのタイマーが引き止めない)
  const ok = spawnSync(process.execPath, ["--import", preload, "--test", "ok.test.mjs"], { cwd: dir, encoding: "utf8", env: { ...env, TEST_FILE_TIMEOUT: "120" }, timeout: 30_000 });
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
});

test("test() 1 つの上限: 既定 60 秒、env TEST_TIMEOUT・フラグで変える(フラグが勝つ)、0 は付けない、数でなければ止める", async () => {
  assert.equal(DEFAULT_TEST_TIMEOUT, 60);
  assert.deepEqual(testTimeoutArgs(null, {}), { args: ["--test-timeout=60000"] });
  assert.deepEqual(testTimeoutArgs(null, { TEST_TIMEOUT: "5" }), { args: ["--test-timeout=5000"] });
  assert.deepEqual(testTimeoutArgs("90", { TEST_TIMEOUT: "5" }), { args: ["--test-timeout=90000"] });
  assert.deepEqual(testTimeoutArgs("0", {}), { args: [] });
  assert.match(testTimeoutArgs(null, { TEST_TIMEOUT: "abc" }).problem, /TEST_TIMEOUT は 0 以上の秒数/);
  let spawned = 0;
  const saved = process.env.TEST_TIMEOUT;
  process.env.TEST_TIMEOUT = "abc";
  try {
    const code = await run([], { repo: "/r", files: ["src/a/a.test.ts"], changed: noRange, log: () => {}, readFlags: () => ({ flags: [] }), spawn: () => (spawned++, 0) });
    assert.equal(code, 2);
  } finally {
    if (saved === undefined) delete process.env.TEST_TIMEOUT;
    else process.env.TEST_TIMEOUT = saved;
  }
  assert.equal(spawned, 0);
});

test("終わり方(実物): 通った後に接続・タイマーが残るファイルは 1 ファイルの上限で名前付きで落ち、終わらない test() は --test-timeout で落ちる。報告は全部届く", () => {
  const dir = mkdtempSync(join(tmpdir(), "runner-file-end-"));
  writeFileSync(join(dir, "leak.test.mjs"), 'import { test } from "node:test";\ntest("passes but leaves a handle", () => { setInterval(() => {}, 1000); });\n');
  writeFileSync(join(dir, "wait.test.mjs"), 'import { test } from "node:test";\ntest("never resolves", async () => { await new Promise(() => { setInterval(() => {}, 1000); }); });\n');
  writeFileSync(join(dir, "many.test.mjs"), 'import { test } from "node:test";\nfor (let i = 0; i < 200; i++) test(`t${i}`, () => {});\n');
  const env = { ...process.env, TEST_FILE_TIMEOUT: "2" };
  delete env.NODE_TEST_CONTEXT;
  const preload = join(import.meta.dirname, "../preload/fileTimeout.mjs");
  const args = ["--import", preload, ...testTimeoutArgs("1", {}).args, "--test", "--test-concurrency=0"];
  const started = Date.now();
  const leak = spawnSync(process.execPath, [...args, "leak.test.mjs"], { cwd: dir, encoding: "utf8", env, timeout: 30_000 });
  assert.equal(leak.status, 1, leak.stdout + leak.stderr);
  assert.match(leak.stdout + leak.stderr, /時間切れ 2 秒\(テストの後\): leak\.test\.mjs/);
  const wait = spawnSync(process.execPath, [...args, "wait.test.mjs"], { cwd: dir, encoding: "utf8", env, timeout: 30_000 });
  assert.equal(wait.status, 1, wait.stdout + wait.stderr);
  assert.match(wait.stdout, /✖ never resolves/);
  const many = spawnSync(process.execPath, [...args, "many.test.mjs"], { cwd: dir, encoding: "utf8", env, timeout: 30_000 });
  assert.equal(many.status, 0, many.stdout + many.stderr);
  assert.match(many.stdout, /ℹ tests 200\b/);
  assert.ok(Date.now() - started < 20_000, "どれもすぐ終わる");
});

test("時間の上限は数え始めがテストの後(実物): 上限より長くかかっても終わるファイルは落ちない、テストに入る前で止まるファイルは起動から上限の 10 倍で落ちる", () => {
  const dir = mkdtempSync(join(tmpdir(), "runner-after-done-"));
  writeFileSync(join(dir, "slow.test.mjs"), 'import { test } from "node:test";\ntest("slow but finishes", async () => { await new Promise((r) => setTimeout(r, 2500)); });\n');
  writeFileSync(join(dir, "stuck.test.mjs"), 'import { test } from "node:test";\nawait new Promise(() => { setInterval(() => {}, 1000); });\ntest("never reached", () => {});\n');
  const preload = join(import.meta.dirname, "../preload/fileTimeout.mjs");
  const env = { ...process.env, TEST_FILE_TIMEOUT: "0.3" };
  delete env.NODE_TEST_CONTEXT;
  const args = ["--import", preload, ...testTimeoutArgs("30", {}).args, "--test", "--test-concurrency=0"];
  // 負荷で遅いだけ: 0.3 秒の上限の 8 倍かかるが、テストが進んでいる間は数えない(起動からの押さえ 3 秒にも届かない)
  const slow = spawnSync(process.execPath, [...args, "slow.test.mjs"], { cwd: dir, encoding: "utf8", env, timeout: 30_000 });
  assert.equal(slow.status, 0, slow.stdout + slow.stderr);
  assert.doesNotMatch(slow.stdout + slow.stderr, /時間切れ/);
  // テストに入る前で止まる: after が来ないので、起動から 0.3 × 10 = 3 秒で名前を出して落ちる
  const started = Date.now();
  const stuck = spawnSync(process.execPath, [...args, "stuck.test.mjs"], { cwd: dir, encoding: "utf8", env, timeout: 30_000 });
  assert.equal(stuck.status, 1, stuck.stdout + stuck.stderr);
  assert.match(stuck.stdout + stuck.stderr, /時間切れ 3 秒\(起動から\): stuck\.test\.mjs/);
  assert.ok(Date.now() - started < 20_000, "押さえで止まる");
});
