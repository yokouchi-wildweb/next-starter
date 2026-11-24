// scripts/runner/phases/phases.test.mjs — 段階の仕組み(scan.mjs・run.mjs・netGuard.mjs)を一時のフォルダの fixture で通す。実行: pnpm test scripts/runner/phases/phases.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { changedFiles, globToRegExp, run } from "./run.mjs";
import { PhaseError, phaseTestFiles, phaseTestsOf, loadPhases, scanTargets } from "./scan.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

/** fixture: <tmp>/scripts/runner/phases/phases.json(本物の写しから first を外した物。first は下の検査が書く)+ add(kind, name, decl, files) */
function fixture(t) {
  const repo = mkdtempSync(join(tmpdir(), "gates-test-"));
  t.after(() => rmSync(repo, { recursive: true, force: true }));
  const scriptsDir = join(repo, "scripts");
  mkdirSync(join(scriptsDir, "runner/phases"), { recursive: true });
  const phasesOnly = JSON.parse(readFileSync(join(HERE, "phases.json"), "utf8"));
  delete phasesOnly.first;
  const writePhases = (extra = {}) => writeFileSync(join(scriptsDir, "runner/phases/phases.json"), JSON.stringify({ ...phasesOnly, ...extra }));
  writePhases();
  const add = (kind, name, decl, files = { "check.mjs": "process.exit(0)\n" }) => {
    const dir = join(scriptsDir, kind, name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "phase.json"), typeof decl === "string" ? decl : JSON.stringify(decl));
    for (const [f, text] of Object.entries(files)) writeFileSync(join(dir, f), text);
  };
  const exec = (argv, opts = {}) => {
    const lines = [];
    const code = run(argv, { repo, scriptsDir, log: (l) => lines.push(l), ...opts });
    return { code, out: lines.join("\n") };
  };
  return { repo, scriptsDir, add, exec, writePhases };
}

const names = (f) => scanTargets(f.scriptsDir, loadPhases(f.scriptsDir)).map((t) => t.name);

test("段階の一覧の first: その対象をこの順に全部より先(名前順・after の鎖より前)、残りは after の順 / 無い名前・after を持つ first は止める", (t) => {
  const f = fixture(t);
  f.add("structure", "alpha", { generate: "check.mjs" });
  f.add("structure", "beta", { generate: "check.mjs", after: ["alpha"] });
  f.add("structure", "zlock", { generate: "check.mjs" });
  f.writePhases({ first: ["zlock"] });
  assert.deepEqual(names(f), ["zlock", "alpha", "beta"]);
  f.writePhases({ first: ["nope"] });
  assert.throws(() => names(f), (e) => e instanceof PhaseError && /first の nope が無い/.test(e.message));
  f.writePhases({ first: ["beta"] });
  assert.throws(() => names(f), (e) => e instanceof PhaseError && /first の対象は after を持たない/.test(e.message));
  f.writePhases({ first: ["nope"] });
  assert.equal(f.exec(["generate"]).code, 2);
});

test("段階の一覧: 6 つの段階、build と build:post が offline、上流の対象フォルダの名簿、first = lockfile", () => {
  const g = loadPhases(join(HERE, "../.."));
  assert.deepEqual(g.first, ["lockfile"]);
  assert.deepEqual(Object.keys(g.phases), ["build", "build:post", "ship", "forge:pre", "forge:post", "deploy"]);
  assert.deepEqual(Object.entries(g.phases).filter(([, v]) => v.offline).map(([k]) => k), ["build", "build:post"]);
  assert.ok(g.upstreamFolders.structure.includes("domain") && g.upstreamFolders.workflow.includes("notices"));
});

test("phase.json の誤り: 知らない欄・知らない段階・無い入口・check も generate も無い・after の先が無い → 止める(全部まとめて)", (t) => {
  const f = fixture(t);
  f.add("structure", "domain", { check: "check.mjs", phases: ["build", "nightly"], color: 1 });
  f.add("structure", "role", { check: "missing.mjs" });
  f.add("structure", "routes", { phases: ["ship"] });
  f.add("workflow", "rules", { check: "check.mjs", after: ["nowhere"] });
  f.add("structure", "cron", "{ not json");
  assert.throws(() => names(f), (e) => {
    assert.ok(e instanceof PhaseError);
    for (const m of ["知らない欄 color", "知らない段階 nightly", "missing.mjs が無い", "check か generate", "after の nowhere が無い", "cron/phase.json: JSON が読めない"]) assert.match(e.message, new RegExp(m));
    return true;
  });
  assert.equal(f.exec(["check"]).code, 2);
});

test("phase.json の outputs / regions: outputs は 1 つの形 { glob, kind, source, part? } の配列(D318)、regions は文字列の配列なら通り、それ以外は止める(受け口の一覧の generated / region の行の出どころ)", (t) => {
  const ok = fixture(t);
  ok.add("structure", "registry", {
    generate: "check.mjs",
    outputs: [
      { glob: "src/registry/b.ts", kind: "every-run", source: "src/b.json" },
      { glob: "src/registry/c.ts", kind: "write-once", source: "src/c.json" },
      { glob: "vercel.json", kind: "every-run", source: "src/app/api/cron/*/task.ts", part: "crons" },
    ],
    regions: ["src/registry/**/*.ts"],
  });
  assert.deepEqual(names(ok), ["registry"]);
  const bad = fixture(t);
  bad.add("structure", "registry", { generate: "check.mjs", outputs: "src/registry/a.ts", regions: [1] });
  assert.throws(() => names(bad), (e) => /outputs は配列/.test(e.message) && /regions は文字列の配列/.test(e.message));
  const badEntry = fixture(t);
  badEntry.add("structure", "registry", { generate: "check.mjs", outputs: [{ glob: "src/registry/a.ts", kind: "sometimes" }, { kind: "every-run" }, 1] });
  assert.throws(() => names(badEntry), (e) => /outputs\[0\] の kind は every-run \| write-once/.test(e.message) && /outputs\[1\] の glob が無い/.test(e.message) && /outputs\[2\] は \{ glob, kind, source, part\? \}/.test(e.message));
  // 古い短い形(glob の文字列・source の省略)は、このリポの宣言では止める(書き換えの道具を案内する)
  const shortForm = fixture(t);
  shortForm.add("structure", "registry", { generate: "check.mjs", outputs: ["src/registry/a.ts", { glob: "src/registry/b.ts", kind: "every-run" }] });
  assert.throws(() => names(shortForm), (e) => /outputs\[0\] は .*outputs-form\.mjs/.test(e.message) && /outputs\[1\] の source が無い/.test(e.message));
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

test("入口: 全部・対象 1 つ・--phase で選ぶ、落ちたら exit 1、対象なしは exit 0、引数は -- の後を入口へ", (t) => {
  const f = fixture(t);
  f.add("structure", "domain", { check: "check.mjs", generate: "gen.mjs", phases: ["ship", "forge:post"] }, { "check.mjs": "process.exit(0)\n", "gen.mjs": "process.exit(process.argv.includes('--ok') ? 0 : 3)\n" });
  f.add("structure", "routes", { check: "check.mjs", phases: ["ship"] }, { "check.mjs": "process.exit(1)\n" });
  assert.equal(f.exec(["check", "domain"]).code, 0);
  const all = f.exec(["check"]);
  assert.equal(all.code, 1);
  assert.match(all.out, /structure\/domain: check 通る/);
  assert.match(all.out, /structure\/routes: check が落ちた/);
  assert.equal(f.exec(["check", "--phase=forge:post"]).code, 0);
  assert.match(f.exec(["check", "--phase=deploy"]).out, /対象なし/);
  assert.equal(f.exec(["generate", "domain"]).code, 1);
  assert.equal(f.exec(["generate", "domain", "--", "--ok"]).code, 0);
  assert.equal(f.exec(["check", "nowhere"]).code, 2);
  assert.equal(f.exec(["check", "--phase=nightly"]).code, 2);
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

test("build の守り: build に乗る check が fetch・net・dns に届こうとしたら落とし宣言を拒む(例外を握りつぶしても)/ 届かない物は通る / 外部の env は外す(空の文字でなく未設定)", (t) => {
  const f = fixture(t);
  f.add("structure", "bundle", { check: "check.mjs", phases: ["build"] }, { "check.mjs": "try { await fetch('http://127.0.0.1:9') } catch {}\nprocess.exit(0)\n" });
  f.add("structure", "cycles", { check: "check.mjs", phases: ["build"] }, { "check.mjs": "import net from 'node:net'; net.connect(9, '127.0.0.1')\n" });
  f.add("structure", "config", { check: "check.mjs", phases: ["build"] }, { "check.mjs": "process.exit('DATABASE_URL' in process.env || 'NEXT_PUBLIC_FIREBASE_PROJECT_ID' in process.env ? 1 : 0)\n" });
  f.add("structure", "domain", { check: "check.mjs", phases: ["ship"] }, { "check.mjs": "try { await fetch('http://127.0.0.1:9') } catch {}\nprocess.exit(0)\n" });
  for (const [key, value] of [["DATABASE_URL", "postgres://x"], ["NEXT_PUBLIC_FIREBASE_PROJECT_ID", "proj"]]) {
    const prev = process.env[key];
    process.env[key] = value;
    t.after(() => (prev === undefined ? delete process.env[key] : (process.env[key] = prev)));
  }
  const r = f.exec(["check", "--phase=build"]);
  assert.equal(r.code, 1);
  assert.match(r.out, /structure\/bundle: build に宣言した検査が外に届いた\(fetch\)/);
  assert.match(r.out, /structure\/cycles: build に宣言した検査が外に届いた\(net\.connect\)/);
  assert.match(r.out, /structure\/config: check 通る/);
  // build に乗らない対象は守りを付けない
  assert.match(f.exec(["check", "domain"]).out, /structure\/domain: check 通る/);
});

test("explicit の段階(build:post)だけに乗る対象は、全部を回す時は飛ばして出し、段階か名前で呼べば回す", (t) => {
  const f = fixture(t);
  f.add("structure", "bundle", { check: "check.mjs", phases: ["build:post"] }, { "check.mjs": "process.exit(1)\n" });
  f.add("structure", "cycles", { check: "check.mjs", phases: ["build"] });
  const all = f.exec(["check"]);
  assert.equal(all.code, 0);
  assert.match(all.out, /structure\/bundle: build:post だけの対象なので飛ばした/);
  assert.equal(f.exec(["check", "--phase=build:post"]).code, 1);
  assert.equal(f.exec(["check", "bundle"]).code, 1);
});

test("--phase に複数の段階: どれかに乗る対象を after の順に 1 回ずつ、PHASE はその対象が乗る最初の段階", (t) => {
  const f = fixture(t);
  const echo = 'console.log("PHASE=" + process.env.PHASE)\n';
  f.add("structure", "role", { check: "check.mjs", phases: ["forge:pre"] }, { "check.mjs": echo });
  f.add("structure", "domain", { check: "check.mjs", phases: ["forge:pre", "forge:post"], after: ["role"] }, { "check.mjs": echo });
  f.add("structure", "routes", { check: "check.mjs", phases: ["forge:post"], after: ["domain"] }, { "check.mjs": echo });
  f.add("structure", "cron", { check: "check.mjs", phases: ["deploy"] }, { "check.mjs": echo });
  const r = f.exec(["check", "--phase=forge:pre,forge:post"]);
  assert.equal(r.code, 0);
  assert.deepEqual(r.out.match(/structure\/\w+: check 通る/g), ["structure/role: check 通る", "structure/domain: check 通る", "structure/routes: check 通る"]);
  assert.equal(f.exec(["check", "--phase=forge:pre,nightly"]).code, 2);
});

test("watch の glob: ** は何段でも(0 段も)、* は 1 段の中、? は 1 文字、ほかの字はそのまま、パス全体に当てる", () => {
  const m = (g, p) => globToRegExp(g).test(p);
  assert.ok(m(".claude/rules/**", ".claude/rules/core/a.md"));
  assert.ok(m("src/**/domain.json", "src/domain.json"));
  assert.ok(m("src/**/domain.json", "src/domains/a/domain.json"));
  assert.ok(m("CLAUDE.md", "CLAUDE.md"));
  assert.ok(!m("CLAUDE.md", "CLAUDExmd"));
  assert.ok(!m("CLAUDE.md", "docs/CLAUDE.md"));
  assert.ok(m("src/*.ts", "src/a.ts"));
  assert.ok(!m("src/*.ts", "src/x/a.ts"));
  assert.ok(m("a?.md", "ab.md"));
  assert.ok(!m(".notices/**", ".noticesX/a"));
});

test("watch: 段階 ship で選んだ watch つきの対象は、範囲の変更が当たらなければ飛ばして 1 行出す / 当たれば回す / watch の無い対象・名前で呼んだ時・--all・範囲が決まらない時は回す", (t) => {
  const f = fixture(t);
  f.add("workflow", "rules", { check: "check.mjs", phases: ["ship"], watch: ["CLAUDE.md", ".claude/rules/**"] });
  f.add("workflow", "notices", { check: "check.mjs", phases: ["ship", "forge:post"], watch: [".notices/**"] });
  f.add("structure", "routes", { check: "check.mjs", phases: ["ship"] });
  const changed = (files) => ({ changed: () => ({ files, base: "origin/main" }) });
  const none = f.exec(["check", "--phase=ship"], changed([]));
  assert.equal(none.code, 0);
  assert.match(none.out, /workflow\/rules: 変更が watch に当たらないので飛ばした\(--all で回す\)/);
  assert.match(none.out, /workflow\/notices: 変更が watch に当たらないので飛ばした/);
  assert.match(none.out, /structure\/routes: check 通る/);
  const rules = f.exec(["check", "--phase=ship"], changed([".claude/rules/core/x.md"]));
  assert.match(rules.out, /workflow\/rules: check 通る/);
  assert.match(rules.out, /workflow\/notices: 変更が watch に当たらないので飛ばした/);
  for (const argv of [["check", "--phase=ship", "--all"], ["check", "notices"], ["check", "--phase=forge:post"]]) {
    const out = f.exec(argv, changed([])).out;
    assert.doesNotMatch(out, /飛ばした/, argv.join(" "));
  }
  const unknown = f.exec(["check", "--phase=ship"], { changed: () => ({ files: null, why: "比べる上流の枝が無い" }) });
  assert.match(unknown.out, /比べる上流の枝が無いので watch を見ずに全部回す/);
  assert.match(unknown.out, /workflow\/rules: check 通る/);
  let calls = 0;
  f.exec(["check", "--phase=forge:post"], { changed: () => (calls++, { files: [] }) });
  assert.equal(calls, 0, "watch の段階でなければ範囲を読まない");
});

test("--range: 取り込む区間の差分を watch の範囲にして changed へ渡す / 区間の木の宣言はそろえて読む(古い outputs も通る、無しでは止まる)/ ... の無い値は 2", (t) => {
  const f = fixture(t);
  f.add("workflow", "rules", { check: "check.mjs", phases: ["ship"], watch: [".claude/rules/**"] });
  f.add("structure", "registry", { generate: "check.mjs", check: "check.mjs", phases: ["ship"], watch: ["src/registry/**"], outputs: ["src/registry/a.ts"] });
  const asked = [];
  const changed = (_repo, options) => (asked.push(options), { files: options.range === "pre...seg" ? ["src/registry/x.ts"] : [".claude/rules/a.md"] });
  const seg = f.exec(["generate", "--phase=ship", "--range=pre...seg"], { changed });
  assert.equal(seg.code, 0, seg.out);
  assert.deepEqual(asked, [{ range: "pre...seg" }]);
  assert.match(seg.out, /structure\/registry: generate 通る/);
  const checkSeg = f.exec(["check", "--phase=ship", "--range=pre...seg"], { changed });
  assert.match(checkSeg.out, /workflow\/rules: 変更が watch に当たらないので飛ばした/);
  assert.match(checkSeg.out, /structure\/registry: check 通る/);
  const own = f.exec(["check", "--phase=ship"], { changed });
  assert.equal(own.code, 2, "このリポの宣言としては古い outputs の形を止める");
  assert.match(own.out, /outputs\[0\] は .*outputs-form\.mjs/);
  for (const bad of ["--range=pre..seg", "--range=", "--range=...seg", "--range=pre..."]) {
    const r = f.exec(["check", "--phase=ship", bad], { changed });
    assert.equal(r.code, 2, bad);
    assert.match(r.out, /--range は <前>\.\.\.<先>/);
  }
});

test("changedFiles の range: その 2 点の分岐点から先までの差分だけ(作業ツリー・未追跡は入れない、改名は元と先の両方)、読めない範囲は files: null", (t) => {
  const repo = mkdtempSync(join(tmpdir(), "gates-range-"));
  t.after(() => rmSync(repo, { recursive: true, force: true }));
  const g = (...a) => execFileSync("git", ["-C", repo, ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  g("init", "-q", "-b", "main");
  g("config", "user.email", "t@t");
  g("config", "user.name", "t");
  writeFileSync(join(repo, "old.txt"), "same content\n".repeat(20));
  writeFileSync(join(repo, "keep.txt"), "k\n");
  g("add", "-A");
  g("commit", "-qm", "base");
  const pre = g("rev-parse", "HEAD");
  g("mv", "old.txt", "new.txt");
  writeFileSync(join(repo, "up.txt"), "u\n");
  g("add", "-A");
  g("commit", "-qm", "segment");
  const seg = g("rev-parse", "HEAD");
  writeFileSync(join(repo, "keep.txt"), "worktree\n");
  writeFileSync(join(repo, "untracked.txt"), "x\n");
  assert.deepEqual(changedFiles(repo, { range: `${pre}...${seg}` }).files.sort(), ["new.txt", "old.txt", "up.txt"]);
  const broken = changedFiles(repo, { range: "nope...main" });
  assert.equal(broken.files, null);
  assert.match(broken.why, /nope\.\.\.main/);
});

test("tests の欄: リポ相対の *.test.* の配列で実在する物だけ。check がテストの対象と tests が phaseTestFiles に段階の名で並ぶ(D389)", (t) => {
  const { repo, scriptsDir, add } = fixture(t);
  mkdirSync(join(repo, "lib"), { recursive: true });
  writeFileSync(join(repo, "lib/a.test.mjs"), "");
  add("structure", "cyc", { check: "cyc.test.mjs", phases: ["ship"] }, { "cyc.test.mjs": "" });
  add("workflow", "ntc", { check: "check.mjs", phases: ["ship"], tests: ["lib/a.test.mjs"] });
  assert.deepEqual([...phaseTestFiles(repo)], [["scripts/structure/cyc/cyc.test.mjs", "cyc"], ["lib/a.test.mjs", "ntc"]]);
  assert.deepEqual(phaseTestsOf(join(scriptsDir, "workflow/ntc")), ["lib/a.test.mjs"]);
  add("workflow", "bad", { check: "check.mjs", tests: ["lib/a.mjs", "lib/none.test.mjs"] });
  assert.throws(() => scanTargets(scriptsDir, loadPhases(scriptsDir)), (e) => e instanceof PhaseError && /lib\/a\.mjs はテストのファイル/.test(e.message) && /lib\/none\.test\.mjs が無い/.test(e.message));
  assert.deepEqual([...phaseTestFiles(repo)], []);   // 宣言が読めない時は空(テストを減らさない)
});
