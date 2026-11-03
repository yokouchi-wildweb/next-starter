// scripts/notices/pickCheck.test.mjs — pnpm notices:pick-check の判定を小さなリポで通す。実行: pnpm test:notices
// 検査(既定 typecheck・test:config-module-load)は --check の口で「src/a.txt が ok を含む」に差し替える
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { judge, parseFixes, writePick } from "./pickCheck.mjs";

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
