// scripts/runner/gates/gates.test.mjs — 門の仕組み(scan.mjs・run.mjs・netGuard.mjs)を一時のフォルダの fixture で通す。実行: pnpm test scripts/runner/gates/gates.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { globToRegExp, run } from "./run.mjs";
import { GateError, loadGates, scanTargets } from "./scan.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

/** fixture: <tmp>/scripts/runner/gates/gates.json(本物の写し)+ add(kind, name, decl, files) */
function fixture(t) {
  const repo = mkdtempSync(join(tmpdir(), "gates-test-"));
  t.after(() => rmSync(repo, { recursive: true, force: true }));
  const scriptsDir = join(repo, "scripts");
  mkdirSync(join(scriptsDir, "runner/gates"), { recursive: true });
  copyFileSync(join(HERE, "gates.json"), join(scriptsDir, "runner/gates/gates.json"));
  const add = (kind, name, decl, files = { "check.mjs": "process.exit(0)\n" }) => {
    const dir = join(scriptsDir, kind, name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "gate.json"), typeof decl === "string" ? decl : JSON.stringify(decl));
    for (const [f, text] of Object.entries(files)) writeFileSync(join(dir, f), text);
  };
  const exec = (argv, opts = {}) => {
    const lines = [];
    const code = run(argv, { repo, scriptsDir, log: (l) => lines.push(l), ...opts });
    return { code, out: lines.join("\n") };
  };
  return { repo, scriptsDir, add, exec };
}

const names = (f) => scanTargets(f.scriptsDir, loadGates(f.scriptsDir)).map((t) => t.name);

test("門の一覧: 6 つの門、build と build:post が offline、上流の対象フォルダの名簿", () => {
  const g = loadGates(join(HERE, "../.."));
  assert.deepEqual(Object.keys(g.gates), ["build", "build:post", "ship", "forge:pre", "forge:post", "deploy"]);
  assert.deepEqual(Object.entries(g.gates).filter(([, v]) => v.offline).map(([k]) => k), ["build", "build:post"]);
  assert.ok(g.upstreamFolders.structure.includes("domain") && g.upstreamFolders.workflow.includes("notices"));
});

test("gate.json の誤り: 知らない欄・知らない門・無い入口・check も generate も無い・after の先が無い → 止める(全部まとめて)", (t) => {
  const f = fixture(t);
  f.add("structure", "domain", { check: "check.mjs", gates: ["build", "nightly"], color: 1 });
  f.add("structure", "role", { check: "missing.mjs" });
  f.add("structure", "routes", { gates: ["ship"] });
  f.add("workflow", "rules", { check: "check.mjs", after: ["nowhere"] });
  f.add("structure", "cron", "{ not json");
  assert.throws(() => names(f), (e) => {
    assert.ok(e instanceof GateError);
    for (const m of ["知らない欄 color", "知らない門 nightly", "missing.mjs が無い", "check か generate", "after の nowhere が無い", "cron/gate.json: JSON が読めない"]) assert.match(e.message, new RegExp(m));
    return true;
  });
  assert.equal(f.exec(["check"]).code, 2);
});

test("順序: after を満たし、同じ段は上流が先で名前順、名簿に無い fork のフォルダは上流の全部の後に名前順 / 循環は止める", (t) => {
  const f = fixture(t);
  f.add("structure", "routes", { check: "check.mjs", after: ["registry"] });
  f.add("structure", "registry", { check: "check.mjs", after: ["domain"] });
  f.add("structure", "domain", { check: "check.mjs" });
  f.add("structure", "cycles", { check: "check.mjs" });
  f.add("structure", "assets", { check: "check.mjs" }); // fork(名簿に無い)
  f.add("structure", "alpha", { check: "check.mjs", after: ["routes"] }); // fork、上流の後を求める
  f.add("workflow", "rules", { check: "check.mjs" });
  assert.deepEqual(names(f), ["cycles", "domain", "registry", "routes", "rules", "alpha", "assets"]);

  const f2 = fixture(t);
  f2.add("structure", "domain", { check: "check.mjs", after: ["role"] });
  f2.add("structure", "role", { check: "check.mjs", after: ["domain"] });
  assert.throws(() => names(f2), /循環/);

  const f3 = fixture(t);
  f3.add("structure", "domain", { check: "check.mjs", after: ["assets"] });
  f3.add("structure", "assets", { check: "check.mjs" });
  assert.throws(() => names(f3), /上流の対象が fork の対象の後/);
});

test("入口: 全部・対象 1 つ・--gate で選ぶ、落ちたら exit 1、対象なしは exit 0、引数は -- の後を入口へ", (t) => {
  const f = fixture(t);
  f.add("structure", "domain", { check: "check.mjs", generate: "gen.mjs", gates: ["ship", "forge:post"] }, { "check.mjs": "process.exit(0)\n", "gen.mjs": "process.exit(process.argv.includes('--ok') ? 0 : 3)\n" });
  f.add("structure", "routes", { check: "check.mjs", gates: ["ship"] }, { "check.mjs": "process.exit(1)\n" });
  assert.equal(f.exec(["check", "domain"]).code, 0);
  const all = f.exec(["check"]);
  assert.equal(all.code, 1);
  assert.match(all.out, /structure\/domain: check 通る/);
  assert.match(all.out, /structure\/routes: check が落ちた/);
  assert.equal(f.exec(["check", "--gate=forge:post"]).code, 0);
  assert.match(f.exec(["check", "--gate=deploy"]).out, /対象なし/);
  assert.equal(f.exec(["generate", "domain"]).code, 1);
  assert.equal(f.exec(["generate", "domain", "--", "--ok"]).code, 0);
  assert.equal(f.exec(["check", "nowhere"]).code, 2);
  assert.equal(f.exec(["check", "--gate=nightly"]).code, 2);
});

test("features: 機能が閉じていれば飛ばし、飛ばしたことを必ず出す / 知らない機能は止める", (t) => {
  const f = fixture(t);
  f.add("structure", "proxies", { check: "check.mjs", features: ["coupon"] }, { "check.mjs": "process.exit(1)\n" });
  const prev = process.env.GATES_FEATURES;
  t.after(() => (prev === undefined ? delete process.env.GATES_FEATURES : (process.env.GATES_FEATURES = prev)));
  process.env.GATES_FEATURES = JSON.stringify({ coupon: false });
  const closed = f.exec(["check"]);
  assert.equal(closed.code, 0);
  assert.match(closed.out, /structure\/proxies: 機能 coupon が閉じているので飛ばした/);
  process.env.GATES_FEATURES = JSON.stringify({ coupon: true });
  assert.equal(f.exec(["check"]).code, 1);
  process.env.GATES_FEATURES = JSON.stringify({});
  assert.equal(f.exec(["check"]).code, 2);
});

test("build の守り: build に乗る check が fetch・net・dns に届こうとしたら落とし宣言を拒む(例外を握りつぶしても)/ 届かない物は通る / DB の env は空", (t) => {
  const f = fixture(t);
  f.add("structure", "bundle", { check: "check.mjs", gates: ["build"] }, { "check.mjs": "try { await fetch('http://127.0.0.1:9') } catch {}\nprocess.exit(0)\n" });
  f.add("structure", "cycles", { check: "check.mjs", gates: ["build"] }, { "check.mjs": "import net from 'node:net'; net.connect(9, '127.0.0.1')\n" });
  f.add("structure", "config", { check: "check.mjs", gates: ["build"] }, { "check.mjs": "process.exit(process.env.DATABASE_URL ? 1 : 0)\n" });
  f.add("structure", "domain", { check: "check.mjs", gates: ["ship"] }, { "check.mjs": "try { await fetch('http://127.0.0.1:9') } catch {}\nprocess.exit(0)\n" });
  const prev = process.env.DATABASE_URL;
  process.env.DATABASE_URL = "postgres://x";
  t.after(() => (prev === undefined ? delete process.env.DATABASE_URL : (process.env.DATABASE_URL = prev)));
  const r = f.exec(["check", "--gate=build"]);
  assert.equal(r.code, 1);
  assert.match(r.out, /structure\/bundle: build に宣言した検査が外に届いた\(fetch\)/);
  assert.match(r.out, /structure\/cycles: build に宣言した検査が外に届いた\(net\.connect\)/);
  assert.match(r.out, /structure\/config: check 通る/);
  // build に乗らない対象は守りを付けない
  assert.match(f.exec(["check", "domain"]).out, /structure\/domain: check 通る/);
});

test("explicit の門(build:post)だけに乗る対象は、全部を回す時は飛ばして出し、門か名前で呼べば回す", (t) => {
  const f = fixture(t);
  f.add("structure", "bundle", { check: "check.mjs", gates: ["build:post"] }, { "check.mjs": "process.exit(1)\n" });
  f.add("structure", "cycles", { check: "check.mjs", gates: ["build"] });
  const all = f.exec(["check"]);
  assert.equal(all.code, 0);
  assert.match(all.out, /structure\/bundle: build:post だけの対象なので飛ばした/);
  assert.equal(f.exec(["check", "--gate=build:post"]).code, 1);
  assert.equal(f.exec(["check", "bundle"]).code, 1);
});

test("--gate に複数の門: どれかに乗る対象を after の順に 1 回ずつ、GATE はその対象が乗る最初の門", (t) => {
  const f = fixture(t);
  const echo = 'console.log("GATE=" + process.env.GATE)\n';
  f.add("structure", "role", { check: "check.mjs", gates: ["forge:pre"] }, { "check.mjs": echo });
  f.add("structure", "domain", { check: "check.mjs", gates: ["forge:pre", "forge:post"], after: ["role"] }, { "check.mjs": echo });
  f.add("structure", "routes", { check: "check.mjs", gates: ["forge:post"], after: ["domain"] }, { "check.mjs": echo });
  f.add("structure", "cron", { check: "check.mjs", gates: ["deploy"] }, { "check.mjs": echo });
  const r = f.exec(["check", "--gate=forge:pre,forge:post"]);
  assert.equal(r.code, 0);
  assert.deepEqual(r.out.match(/structure\/\w+: check 通る/g), ["structure/role: check 通る", "structure/domain: check 通る", "structure/routes: check 通る"]);
  assert.equal(f.exec(["check", "--gate=forge:pre,nightly"]).code, 2);
});

test("watch の glob: ** は何段でも(0 段も)、* は 1 段の中、? は 1 文字、ほかの字はそのまま、パス全体に当てる", () => {
  const m = (g, p) => globToRegExp(g).test(p);
  assert.ok(m(".claude/rules/**", ".claude/rules/core/a.md"));
  assert.ok(m("src/**/domain.json", "src/domain.json"));
  assert.ok(m("src/**/domain.json", "src/features/a/domain.json"));
  assert.ok(m("CLAUDE.md", "CLAUDE.md"));
  assert.ok(!m("CLAUDE.md", "CLAUDExmd"));
  assert.ok(!m("CLAUDE.md", "docs/CLAUDE.md"));
  assert.ok(m("src/*.ts", "src/a.ts"));
  assert.ok(!m("src/*.ts", "src/x/a.ts"));
  assert.ok(m("a?.md", "ab.md"));
  assert.ok(!m(".notices/**", ".noticesX/a"));
});

test("watch: 門 ship で選んだ watch つきの対象は、範囲の変更が当たらなければ飛ばして 1 行出す / 当たれば回す / watch の無い対象・名前で呼んだ時・--all・範囲が決まらない時は回す", (t) => {
  const f = fixture(t);
  f.add("workflow", "rules", { check: "check.mjs", gates: ["ship"], watch: ["CLAUDE.md", ".claude/rules/**"] });
  f.add("workflow", "notices", { check: "check.mjs", gates: ["ship", "forge:post"], watch: [".notices/**"] });
  f.add("structure", "routes", { check: "check.mjs", gates: ["ship"] });
  const changed = (files) => ({ changed: () => ({ files, base: "origin/main" }) });
  const none = f.exec(["check", "--gate=ship"], changed([]));
  assert.equal(none.code, 0);
  assert.match(none.out, /workflow\/rules: 変更が watch に当たらないので飛ばした\(--all で回す\)/);
  assert.match(none.out, /workflow\/notices: 変更が watch に当たらないので飛ばした/);
  assert.match(none.out, /structure\/routes: check 通る/);
  const rules = f.exec(["check", "--gate=ship"], changed([".claude/rules/core/x.md"]));
  assert.match(rules.out, /workflow\/rules: check 通る/);
  assert.match(rules.out, /workflow\/notices: 変更が watch に当たらないので飛ばした/);
  for (const argv of [["check", "--gate=ship", "--all"], ["check", "notices"], ["check", "--gate=forge:post"]]) {
    const out = f.exec(argv, changed([])).out;
    assert.doesNotMatch(out, /飛ばした/, argv.join(" "));
  }
  const unknown = f.exec(["check", "--gate=ship"], { changed: () => ({ files: null, why: "比べる上流の枝が無い" }) });
  assert.match(unknown.out, /比べる上流の枝が無いので watch を見ずに全部回す/);
  assert.match(unknown.out, /workflow\/rules: check 通る/);
  let calls = 0;
  f.exec(["check", "--gate=forge:post"], { changed: () => (calls++, { files: [] }) });
  assert.equal(calls, 0, "watch の門でなければ範囲を読まない");
});
