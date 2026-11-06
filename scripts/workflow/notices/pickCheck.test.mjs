// scripts/workflow/notices/pickCheck.test.mjs — pnpm workflow notices pickCheck の判定を小さなリポで通す。実行: pnpm test scripts/workflow/notices
// 検査(既定 typecheck・config の読み込み・registry)は --check の口で「src/a.txt が ok を含む」に差し替える
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { DEFAULT_CHECKS, judge, parseFixes, pickCommand, run, runChecks, writePick } from "./pickCheck.mjs";
import { DEFAULT_CHECKS as CHECKPOINT_CHECKS } from "./checkpointCheck.mjs";
import { rowFromNotice } from "./shippedIndex.mjs";

const OK = `node -e "process.exit(require('fs').readFileSync('src/a.txt','utf8').includes('ok')?0:1)"`;
const NEEDS_LIB = `node -e "process.exit(require('fs').existsSync('src/lib.txt')?0:1)"`;

function notice(id, { checkpoint = id.slice(16), fixes, pick, steps = "none" } = {}) {
  return [
    `# DOWNSTREAM NOTICE id:${id}`,
    "severity: info",
    `checkpoint: ${checkpoint}`,
    ...(fixes ? [`fixes: ${fixes}`] : []),
    ...(pick ? [`pick: ${pick}`] : []),
    "change: c",
    "why: w",
    "required_actions:",
    steps,
    "verify: v",
    "manual_steps: -",
    "refs: -",
    "notes: -",
    "",
  ].join("\n");
}

/** 小さなリポ: commit(files, msg) → sha */
function repo(t) {
  const dir = mkdtempSync(join(tmpdir(), "pick-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const g = (...a) => execFileSync("git", ["-C", dir, ...a], { encoding: "utf8" }).trim();
  g("init", "-q", "-b", "main");
  g("config", "user.email", "t@t");
  g("config", "user.name", "t");
  const commit = (files, msg = "c") => {
    for (const [f, text] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, f)), { recursive: true });
      writeFileSync(join(dir, f), text);
    }
    g("add", "-A");
    g("commit", "-qm", msg);
    return g("rev-parse", "HEAD");
  };
  commit({ "src/a.txt": "start\n", "src/b.txt": "b\n" }, "base");
  return { dir, commit };
}

const N = (k) => `20990101-00000${k}-n${k}`;
const F = (id) => `.notices/${id}.md`;

test("clean: 壊れた地点(修正元の区切り)に修正だけを載せて検査が通る", (t) => {
  const r = repo(t);
  const s = r.commit({ "src/a.txt": "bug\n", [F(N(1))]: notice(N(1)) });
  r.commit({ "src/b.txt": "between\n" });
  r.commit({ "src/a.txt": "ok\n", [F(N(2))]: notice(N(2), { fixes: N(1) }) });
  const [res] = judge(r.dir, "HEAD", { checks: [OK] });
  assert.equal(res.verdict, "clean", res.reasons.join("\n"));
  assert.equal(res.base, s);
});

test("-: 間の commit が同じ行を変えていて壊れた地点で cherry-pick が衝突する", (t) => {
  const r = repo(t);
  r.commit({ "src/a.txt": "bug\n", [F(N(1))]: notice(N(1)) });
  r.commit({ "src/a.txt": "bug2\n" });
  r.commit({ "src/a.txt": "ok\n", [F(N(2))]: notice(N(2), { fixes: N(1) }) });
  const [res] = judge(r.dir, "HEAD", { checks: [OK] });
  assert.equal(res.verdict, "-");
  assert.match(res.reasons.join("\n"), /衝突/);
});

test("-: 衝突しないが、間の commit が足した物に頼っていて検査が落ちる", (t) => {
  const r = repo(t);
  r.commit({ "src/a.txt": "bug\n", [F(N(1))]: notice(N(1)) });
  r.commit({ "src/lib.txt": "lib\n" });
  r.commit({ "src/a.txt": "ok\n", [F(N(2))]: notice(N(2), { fixes: N(1) }) });
  const [res] = judge(r.dir, "HEAD", { checks: [OK, NEEDS_LIB] });
  assert.equal(res.verdict, "-");
  assert.match(res.reasons.join("\n"), /落ちる/);
});

test("-: pnpm-lock.yaml・route-map を含む commit", (t) => {
  const r = repo(t);
  r.commit({ "src/a.txt": "bug\n", [F(N(1))]: notice(N(1)) });
  r.commit({ "src/a.txt": "ok\n", "pnpm-lock.yaml": "x\n", "src/app/route-map.jsonl": "{}\n", [F(N(2))]: notice(N(2), { fixes: N(1) }) });
  const [res] = judge(r.dir, "HEAD", { checks: [OK] });
  assert.equal(res.verdict, "-");
  assert.match(res.reasons.join("\n"), /pnpm-lock\.yaml/);
  assert.match(res.reasons.join("\n"), /route-map\.jsonl/);
});

test("-: 本体と notice が別の commit", (t) => {
  const r = repo(t);
  r.commit({ "src/a.txt": "bug\n", [F(N(1))]: notice(N(1)) });
  r.commit({ "src/a.txt": "ok\n" });
  r.commit({ [F(N(2))]: notice(N(2), { fixes: N(1) }) });
  const [res] = judge(r.dir, "HEAD", { checks: [OK] });
  assert.equal(res.verdict, "-");
  assert.match(res.reasons.join("\n"), /本体が無い/);
});

test("修正元が複数: 最も古い区切りを土台にする", (t) => {
  const r = repo(t);
  const s1 = r.commit({ "src/a.txt": "bug\n", [F(N(1))]: notice(N(1)) });
  r.commit({ "src/c.txt": "bug\n", [F(N(2))]: notice(N(2)) });
  r.commit({ "src/a.txt": "ok\n", [F(N(3))]: notice(N(3), { fixes: `${N(2)}, ${N(1)}` }) });
  const [res] = judge(r.dir, "HEAD", { checks: [OK] });
  assert.equal(res.verdict, "clean", res.reasons.join("\n"));
  assert.equal(res.base, s1);
});

test("修正元が checkpoint: - なら次の区切りが壊れた地点、commit: 指定も同じ", (t) => {
  const r = repo(t);
  const bug = r.commit({ "src/a.txt": "bug\n", [F(N(1))]: notice(N(1), { checkpoint: "-" }) });
  const cp = r.commit({ "src/b.txt": "x\n", [F(N(2))]: notice(N(2)) });
  r.commit({ "src/a.txt": "ok\n", [F(N(3))]: notice(N(3), { fixes: `${N(1)}, commit:${bug.slice(0, 8)}` }) });
  const [res] = judge(r.dir, "HEAD", { checks: [OK] });
  assert.equal(res.verdict, "clean", res.reasons.join("\n"));
  assert.equal(res.base, cp);
});

test("-: 修正元と修正が同じ区間(間に区切りが無い)", (t) => {
  const r = repo(t);
  r.commit({ "src/a.txt": "bug\n", [F(N(1))]: notice(N(1), { checkpoint: "-" }) });
  r.commit({ "src/a.txt": "ok\n", [F(N(2))]: notice(N(2), { fixes: N(1) }) });
  const [res] = judge(r.dir, "HEAD", { checks: [OK] });
  assert.equal(res.verdict, "-");
  assert.match(res.reasons.join("\n"), /同じ区間/);
});

test("-: 手順が壊れた地点より後の notice を名指す", (t) => {
  const r = repo(t);
  r.commit({ "src/a.txt": "bug\n", [F(N(1))]: notice(N(1)) });
  r.commit({ "src/b.txt": "x\n", [F(N(2))]: notice(N(2)) });
  r.commit({ "src/a.txt": "ok\n", [F(N(3))]: notice(N(3), { fixes: N(1), steps: `1. apply ${N(2)} first` }) });
  const [res] = judge(r.dir, "HEAD", { checks: [OK] });
  assert.equal(res.verdict, "-");
  assert.match(res.reasons.join("\n"), new RegExp(N(2)));
});

test("修正の修正: 前の修正が pick: clean なら、壊れた地点にそれを載せた木で試す / clean でなければ -", (t) => {
  const r = repo(t);
  const s = r.commit({ "src/a.txt": "bug\n", [F(N(1))]: notice(N(1)) });
  r.commit({ "src/b.txt": "between\n" });
  r.commit({ "src/a.txt": "almost\n", [F(N(2))]: notice(N(2), { fixes: N(1), pick: "clean" }) });
  r.commit({ "src/a.txt": "ok\n", [F(N(3))]: notice(N(3), { fixes: N(2), steps: `1. after ${N(2)}` }) });
  const [res] = judge(r.dir, "HEAD", { checks: [OK] });
  assert.equal(res.verdict, "clean", res.reasons.join("\n"));
  assert.equal(res.base, s);
  assert.match(res.why, /先に載せた/);

  const r2 = repo(t);
  r2.commit({ "src/a.txt": "bug\n", [F(N(1))]: notice(N(1)) });
  r2.commit({ "src/a.txt": "almost\n", [F(N(2))]: notice(N(2), { fixes: N(1), pick: "-" }) });
  r2.commit({ "src/a.txt": "ok\n", [F(N(3))]: notice(N(3), { fixes: N(2) }) });
  const [res2] = judge(r2.dir, "HEAD", { checks: [OK] });
  assert.equal(res2.verdict, "-");
  assert.match(res2.reasons.join("\n"), /連鎖を試さない/);
});

test("判定できない: fixes: の参照先が無い / fixes: の notice を足していない commit", (t) => {
  const r = repo(t);
  r.commit({ "src/a.txt": "ok\n", [F(N(1))]: notice(N(1), { fixes: "20000101-000000-nowhere" }) });
  const [res] = judge(r.dir, "HEAD", { checks: [OK] });
  assert.equal(res.verdict, null);
  r.commit({ "src/b.txt": "x\n" });
  assert.deepEqual(judge(r.dir, "HEAD", { checks: [OK] }), []);
});

test("writePick: fixes: の直後に足す / あれば置き換える", () => {
  const text = notice(N(2), { fixes: N(1) });
  const once = writePick(text, "clean");
  assert.match(once, new RegExp(`^fixes: ${N(1)}\\npick: clean$`, "m"));
  assert.equal(writePick(once, "-").match(/^pick:.*$/gm).join(), "pick: -");
});

test("parseFixes: id と commit", () => {
  assert.deepEqual(parseFixes("a-b, commit:07924f6c"), [{ id: "a-b" }, { commit: "07924f6c" }]);
});

const PROJECT = { ".claude/rules/project.md": "fork_id: up\n" };
const IDX = ".notices/shipped/up.md";
const index = (...ids) => `# SHIPPED up\n\n${ids.map(([id, opts]) => `${rowFromNotice(notice(id, opts))}\n`).join("")}`;

test("run: 判定を索引のその notice の行の pick: に書き、本文には書かない", (t) => {
  const r = repo(t);
  r.commit({ ...PROJECT, "src/a.txt": "bug\n", [F(N(1))]: notice(N(1)), [IDX]: index([N(1)]) });
  r.commit({ "src/b.txt": "between\n" });
  r.commit({ "src/a.txt": "ok\n", [F(N(2))]: notice(N(2), { fixes: N(1) }), [IDX]: index([N(1)], [N(2), { fixes: N(1) }]) });
  const out = [];
  assert.equal(run(r.dir, ["HEAD", `--check=${OK}`], (l) => out.push(l)), 0, out.join("\n"));
  const rows = readFileSync(join(r.dir, IDX), "utf8").split("\n").filter((l) => l.startsWith("- id:"));
  assert.equal(rows[1], `- id:${N(2)} | severity:info | checkpoint:${N(2).slice(16)} | fixes:${N(1)} | pick:clean`);
  assert.equal(rows[0], rowFromNotice(notice(N(1))));
  assert.doesNotMatch(readFileSync(join(r.dir, F(N(2))), "utf8"), /^pick:/m);
});

test("run: 索引に行が無ければ書かずに exit 2", (t) => {
  const r = repo(t);
  r.commit({ ...PROJECT, "src/a.txt": "bug\n", [F(N(1))]: notice(N(1)) });
  r.commit({ "src/b.txt": "between\n" });
  r.commit({ "src/a.txt": "ok\n", [F(N(2))]: notice(N(2), { fixes: N(1) }) });
  const out = [];
  assert.equal(run(r.dir, ["HEAD", `--check=${OK}`], (l) => out.push(l)), 2);
  assert.match(out.join("\n"), /行が無い/);
  assert.doesNotMatch(readFileSync(join(r.dir, F(N(2))), "utf8"), /^pick:/m);
});

test("修正の修正: 前の修正の pick: は索引の行から読む", (t) => {
  const r = repo(t);
  const s = r.commit({ "src/a.txt": "bug\n", [F(N(1))]: notice(N(1)), [IDX]: index([N(1)]) });
  r.commit({ "src/b.txt": "between\n" });
  r.commit({ "src/a.txt": "almost\n", [F(N(2))]: notice(N(2), { fixes: N(1) }), [IDX]: index([N(1)], [N(2), { fixes: N(1), pick: "clean" }]) });
  r.commit({ "src/a.txt": "ok\n", [F(N(3))]: notice(N(3), { fixes: N(2) }) });
  const [res] = judge(r.dir, "HEAD", { checks: [OK] });
  assert.equal(res.verdict, "clean", res.reasons.join("\n"));
  assert.equal(res.base, s);
});


test("clean: 出荷索引の変更だけが衝突する修正(索引の無い土台・短い索引の土台)", (t) => {
  // 索引の無い土台: 修正元の後で索引ができ、修正が索引に行を足す(modify/delete)
  const r = repo(t);
  r.commit({ "src/a.txt": "bug\n", [F(N(1))]: notice(N(1)) });
  r.commit({ [IDX]: "- id:a\n" });
  r.commit({ "src/a.txt": "ok\n", [F(N(2))]: notice(N(2), { fixes: N(1) }), [IDX]: "- id:a\n- id:fix\n" });
  const [res] = judge(r.dir, "HEAD", { checks: [OK] });
  assert.equal(res.verdict, "clean", res.reasons.join("\n"));

  // 短い索引の土台: 間の commit が末尾に行を足し、修正も末尾に足す(同じ所の追記)
  const r2 = repo(t);
  r2.commit({ "src/a.txt": "bug\n", [IDX]: "- id:n1\n", [F(N(1))]: notice(N(1)) });
  r2.commit({ [IDX]: "- id:n1\n- id:between\n" });
  r2.commit({ "src/a.txt": "ok\n", [F(N(2))]: notice(N(2), { fixes: N(1) }), [IDX]: "- id:n1\n- id:between\n- id:fix\n" });
  const [res2] = judge(r2.dir, "HEAD", { checks: [OK] });
  assert.equal(res2.verdict, "clean", res2.reasons.join("\n"));
});

test("-: 索引のほかに本体のファイルも衝突するなら、そのパスを挙げて -", (t) => {
  const r = repo(t);
  r.commit({ "src/a.txt": "bug\n", [F(N(1))]: notice(N(1)) });
  r.commit({ "src/a.txt": "bug2\n", [IDX]: "- id:a\n" });
  r.commit({ "src/a.txt": "ok\n", [F(N(2))]: notice(N(2), { fixes: N(1) }), [IDX]: "- id:a\n- id:fix\n" });
  const [res] = judge(r.dir, "HEAD", { checks: [OK] });
  assert.equal(res.verdict, "-");
  assert.match(res.reasons.join("\n"), /衝突する.*src\/a\.txt/);
  assert.doesNotMatch(res.reasons.join("\n"), /shipped/);
});

// 別の notice の pick:clean の修正 G を先に載せる(stackedPicks)。N0 が b.txt を壊し、G が N0 を直す。F は N1 の修正
const FIXED = `node -e "process.exit(require('fs').readFileSync('src/b.txt','utf8').includes('fixed')?0:1)"`;

test("先に載せる: fork が壊れた地点までに取っている別の clean な修正を載せてから試す / G が pick:- なら今どおり -", (t) => {
  for (const pick of ["clean", "-", undefined]) {
    const r = repo(t);
    r.commit({ "src/b.txt": "brk\n", [F(N(1))]: notice(N(1)) });
    const b1 = r.commit({ "src/a.txt": "bug\n", [F(N(2))]: notice(N(2)) });
    const g = r.commit({ "src/b.txt": "fixed\n", [F(N(3))]: notice(N(3), { fixes: N(1), pick }) });
    r.commit({ "src/a.txt": "ok\n", [F(N(4))]: notice(N(4), { fixes: N(2) }) });
    const [res] = judge(r.dir, "HEAD", { checks: [OK, FIXED] });
    assert.equal(res.base, b1);
    if (pick === "clean") {
      assert.equal(res.verdict, "clean", res.reasons.join("\n"));
      assert.match(res.why, new RegExp(`修正 ${N(3)} を先に載せた`));
    } else {
      assert.equal(res.verdict, "-", `G pick:${pick}`);
      assert.doesNotMatch(res.why, new RegExp(N(3)));
    }
    assert.ok(g);
  }
});

test("先に載せない: G の土台が壊れた地点より後 / G が既に土台の祖先 / G が F より後に出荷", (t) => {
  // G の土台(N0 の区切り)が F の壊れた地点より後
  const r = repo(t);
  r.commit({ "src/a.txt": "bug\n", [F(N(2))]: notice(N(2)) });
  r.commit({ "src/b.txt": "brk\n", [F(N(1))]: notice(N(1)) });
  r.commit({ "src/b.txt": "fixed\n", [F(N(3))]: notice(N(3), { fixes: N(1), pick: "clean" }) });
  r.commit({ "src/a.txt": "ok\n", [F(N(4))]: notice(N(4), { fixes: N(2) }) });
  const [res] = judge(r.dir, "HEAD", { checks: [OK] });
  assert.equal(res.verdict, "clean", res.reasons.join("\n"));
  assert.doesNotMatch(res.why, new RegExp(N(3)));

  // G が壊れた地点の祖先(既に木にある)
  const r2 = repo(t);
  r2.commit({ "src/b.txt": "brk\n", [F(N(1))]: notice(N(1)) });
  r2.commit({ "src/b.txt": "fixed\n", [F(N(3))]: notice(N(3), { fixes: N(1), pick: "clean" }) });
  r2.commit({ "src/a.txt": "bug\n", [F(N(2))]: notice(N(2)) });
  r2.commit({ "src/a.txt": "ok\n", [F(N(4))]: notice(N(4), { fixes: N(2) }) });
  const [res2] = judge(r2.dir, "HEAD", { checks: [OK, FIXED] });
  assert.equal(res2.verdict, "clean", res2.reasons.join("\n"));
  assert.doesNotMatch(res2.why, new RegExp(N(3)));

  // G が F より後に出荷(F の出荷時には知りようがない)
  const r3 = repo(t);
  r3.commit({ "src/b.txt": "brk\n", [F(N(1))]: notice(N(1)) });
  r3.commit({ "src/a.txt": "bug\n", [F(N(2))]: notice(N(2)) });
  const fix = r3.commit({ "src/a.txt": "ok\n", [F(N(4))]: notice(N(4), { fixes: N(2) }) });
  r3.commit({ "src/b.txt": "fixed\n", [F(N(3))]: notice(N(3), { fixes: N(1), pick: "clean" }) });
  const [res3] = judge(r3.dir, fix, { checks: [OK, FIXED] });
  assert.equal(res3.verdict, "-");
  assert.doesNotMatch(res3.why, new RegExp(N(3)));
});

test("先に載せる G が壊れた地点に載らないなら -(G の sha を挙げる)", (t) => {
  const r = repo(t);
  r.commit({ "src/b.txt": "brk\n", [F(N(1))]: notice(N(1)) });
  r.commit({ "src/a.txt": "bug\n", [F(N(2))]: notice(N(2)) });
  r.commit({ "src/b.txt": "brk-between\n" });
  const g = r.commit({ "src/b.txt": "fixed\n", [F(N(3))]: notice(N(3), { fixes: N(1), pick: "clean" }) });
  r.commit({ "src/a.txt": "ok\n", [F(N(4))]: notice(N(4), { fixes: N(2) }) });
  const [res] = judge(r.dir, "HEAD", { checks: [OK] });
  assert.equal(res.verdict, "-");
  assert.match(res.reasons.join("\n"), new RegExp(`先に載せる修正 ${g.slice(0, 8)} が土台に載らない`));
});

test("先に載せる: 束 5 の形(修正を壊れた地点の脇の commit で出して merge)。G と F は互いの祖先でなく、先端の索引から G を見つける", (t) => {
  const r = repo(t);
  const g_ = (...a) => execFileSync("git", ["-C", r.dir, ...a], { encoding: "utf8" }).trim();
  const b0 = r.commit({ "src/b.txt": "brk\n", [F(N(1))]: notice(N(1)) });
  const b1 = r.commit({ "src/a.txt": "bug\n", [F(N(2))]: notice(N(2)) });
  r.commit({ "src/c.txt": "later\n" });
  // G: N0 の区切りの脇
  g_("switch", "-q", "-c", "g", b0);
  r.commit({ "src/b.txt": "fixed\n", [F(N(3))]: notice(N(3), { fixes: N(1), pick: "clean" }) });
  g_("switch", "-q", "main");
  g_("merge", "-q", "--no-ff", "-m", "merge g", "g");
  // F: N1 の区切りの脇(G を含まない)
  g_("switch", "-q", "-c", "f", b1);
  const fix = r.commit({ "src/a.txt": "ok\n", [F(N(4))]: notice(N(4), { fixes: N(2) }) });
  g_("switch", "-q", "main");
  g_("merge", "-q", "--no-ff", "-m", "merge f", "f");
  const [res] = judge(r.dir, fix, { checks: [OK, FIXED] });
  assert.equal(res.base, b1);
  assert.equal(res.verdict, "clean", res.reasons.join("\n"));
  assert.match(res.why, new RegExp(`修正 ${N(3)} を先に載せた`));
  // 先端が G の merge より前なら G は出荷前で載らない
  const [early] = judge(r.dir, fix, { checks: [OK, FIXED], at: "f" });
  assert.equal(early.verdict, "-");
});

test("既定の検査: 新しい入口が package.json にある木はそれで、無い再編の前の木は旧い名前で回す(検査が減らない)", () => {
  const now = { typecheck: "", test: "", check: "" };
  const old = { typecheck: "", "test:config-module-load": "", "registry:check": "", "test:core-rules": "" };
  assert.deepEqual(DEFAULT_CHECKS.map((c) => pickCommand(c, now)), ["pnpm typecheck", "pnpm test scripts/structure/config/moduleLoad.test.mjs", "pnpm check registry"]);
  assert.deepEqual(DEFAULT_CHECKS.map((c) => pickCommand(c, old)), ["pnpm typecheck", "pnpm test:config-module-load", "pnpm registry:check"]);
  assert.deepEqual(CHECKPOINT_CHECKS.map((c) => pickCommand(c, old)), ["pnpm typecheck", "pnpm test:config-module-load", "pnpm test:core-rules", "pnpm registry:check"]);
  assert.equal(pickCommand(CHECKPOINT_CHECKS[2], now), "pnpm check rules");
  assert.equal(pickCommand("pnpm lint", old), "pnpm lint");
  // どちらも無い木: 新しい入口の名前で「無い」と書いて飛ばす
  assert.deepEqual(runChecks("/nowhere", [DEFAULT_CHECKS[2]], {}).skipped, ["pnpm check registry(その木の package.json に無い)"]);
});
