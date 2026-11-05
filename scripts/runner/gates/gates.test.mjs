// scripts/runner/gates/gates.test.mjs — 門の仕組み(scan.mjs・run.mjs・netGuard.mjs)を一時のフォルダの fixture で通す。実行: pnpm test:gates
import { test } from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "./run.mjs";
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
  const exec = (argv) => {
    const lines = [];
    const code = run(argv, { repo, scriptsDir, log: (l) => lines.push(l) });
    return { code, out: lines.join("\n") };
  };
  return { repo, scriptsDir, add, exec };
}

const names = (f) => scanTargets(f.scriptsDir, loadGates(f.scriptsDir)).map((t) => t.name);

test("門の一覧: 5 つの門、build だけ offline、上流の対象フォルダの名簿", () => {
  const g = loadGates(join(HERE, "../.."));
  assert.deepEqual(Object.keys(g.gates), ["build", "ship", "forge:pre", "forge:post", "deploy"]);
  assert.deepEqual(Object.entries(g.gates).filter(([, v]) => v.offline).map(([k]) => k), ["build"]);
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
