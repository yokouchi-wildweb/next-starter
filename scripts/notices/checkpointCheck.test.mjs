// scripts/notices/checkpointCheck.test.mjs — 範囲の途中の区切りを fork の木で検査する(checkpointCheck.mjs)を小さなリポで通す。実行: pnpm test:notices
// 検査は --check の口で差し替える: OK = src/a.txt が bug を含まない、NEEDS_LIB = src/lib.txt がある
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { check, checkpointsIn, run } from "./checkpointCheck.mjs";

const OK = `node -e "process.exit(require('fs').readFileSync('src/a.txt','utf8').includes('bug')?1:0)"`;
const NEEDS_LIB = `node -e "const fs=require('fs');process.exit(!fs.readFileSync('src/a.txt','utf8').includes('uses-lib')||fs.existsSync('src/lib.txt')?0:1)"`;

const notice = (id, { checkpoint = id.slice(16), skip, fixes, pick } = {}) =>
  [`# DOWNSTREAM NOTICE id:${id}`, "severity: info", `checkpoint: ${checkpoint}`, ...(fixes ? [`fixes: ${fixes}`] : []), ...(pick ? [`pick: ${pick}`] : []), ...(skip ? [`skip_checkpoint: ${skip}`] : []), "change: c", "why: w", "required_actions:", "none", "verify: v", "manual_steps: -", "refs: -", "notes: -", ""].join("\n");
const N = (k) => `20990101-00000${k}-n${k}`;
const F = (id) => `.notices/${id}.md`;

function repo(t) {
  const dir = mkdtempSync(join(tmpdir(), "cp-test-"));
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
  const base = commit({ "src/a.txt": "start\n", "src/b.txt": "b\n" }, "base");
  return { dir, g, commit, base };
}

const ids = (res) => res.results.map((r) => `${r.id}:${r.status}`);

test("直線: 途中の区切りが壊れていれば、そこで止めて挙げる(先端は直っていても)", (t) => {
  const r = repo(t);
  r.commit({ "src/b.txt": "1\n", [F(N(1))]: notice(N(1)) });
  r.commit({ "src/a.txt": "bug\n", [F(N(2))]: notice(N(2)) });
  r.commit({ "src/a.txt": "fixed\n", [F(N(3))]: notice(N(3)) });
  const res = check(r.dir, r.base, "HEAD", { checks: [OK] });
  assert.deepEqual(ids(res), [`${N(1)}:ok`, `${N(2)}:broken`]);
  assert.deepEqual(ids(check(r.dir, r.base, "HEAD", { checks: [OK], all: true })), [`${N(1)}:ok`, `${N(2)}:broken`, `${N(3)}:ok`]);
});

test("脇のブランチ: main 先行の木で衝突する区切りは壊れたと数え、パスを挙げる / 索引だけの衝突は数えない", (t) => {
  const r = repo(t);
  r.g("switch", "-q", "-c", "side");
  r.commit({ "src/a.txt": "side\n", ".notices/shipped/up.md": "- id:side\n", [F(N(2))]: notice(N(2)) });
  r.g("switch", "-q", "main");
  r.commit({ "src/a.txt": "main\n", ".notices/shipped/up.md": "- id:main\n", [F(N(1))]: notice(N(1)) });
  // 上流は手で解いて merge した
  try {
    r.g("merge", "-q", "--no-ff", "-m", "merge side", "side");
  } catch {
    writeFileSync(join(r.dir, "src/a.txt"), "both\n");
    writeFileSync(join(r.dir, ".notices/shipped/up.md"), "- id:main\n- id:side\n");
    r.g("add", "-A");
    r.g("commit", "-qm", "merge side");
  }
  const order = checkpointsIn(r.dir, r.base, "HEAD").map((c) => c.id);
  const res = check(r.dir, r.base, "HEAD", { checks: [OK] });
  const broken = res.results.find((x) => x.status === "broken");
  assert.ok(broken, ids(res).join(","));
  assert.equal(broken.id, order[1]);
  assert.match(broken.reasons.join("\n"), /merge が衝突する: src\/a\.txt/);
  assert.doesNotMatch(broken.reasons.join("\n"), /shipped/);

  // 索引だけが衝突する脇のブランチは通る
  const r2 = repo(t);
  r2.g("switch", "-q", "-c", "side");
  r2.commit({ "src/c.txt": "side\n", ".notices/shipped/up.md": "- id:side\n", [F(N(2))]: notice(N(2)) });
  r2.g("switch", "-q", "main");
  r2.commit({ "src/b.txt": "main\n", ".notices/shipped/up.md": "- id:main\n", [F(N(1))]: notice(N(1)) });
  try {
    r2.g("merge", "-q", "--no-ff", "-m", "merge side", "side");
  } catch {
    writeFileSync(join(r2.dir, ".notices/shipped/up.md"), "- id:main\n- id:side\n");
    r2.g("add", "-A");
    r2.g("commit", "-qm", "merge side");
  }
  assert.ok(check(r2.dir, r2.base, "HEAD", { checks: [OK] }).results.every((x) => x.status === "ok"));
});

test("脇のブランチ: 各区切りは単独では通るが、先に並ぶ側を merge 済みの fork の木で壊れる(main 先行・脇先行のどちらでも 2 つ目)", (t) => {
  const r = repo(t);
  r.commit({ "src/lib.txt": "lib\n" }, "lib exists at the branch point");
  const from = r.g("rev-parse", "HEAD");
  r.g("switch", "-q", "-c", "side");
  const s = r.commit({ "src/a.txt": "uses-lib\n", [F(N(2))]: notice(N(2)) });
  r.g("switch", "-q", "main");
  r.g("rm", "-q", "src/lib.txt");
  const m = r.commit({ "src/b.txt": "lib removed\n", [F(N(1))]: notice(N(1)) });
  r.g("merge", "-q", "--no-ff", "-m", "merge side", "side");
  // 単独ではどちらも通る(上流のどの commit も壊れていない)
  for (const c of [s, m]) assert.equal(check(r.dir, from, c, { checks: [NEEDS_LIB] }).results.at(-1).status, "ok");
  const order = checkpointsIn(r.dir, from, "HEAD").map((c) => c.id);
  assert.equal(order.length, 2);
  const res = check(r.dir, from, "HEAD", { checks: [NEEDS_LIB], all: true });
  assert.deepEqual(ids(res), [`${order[0]}:ok`, `${order[1]}:broken`]);
});

test("区切りが無い範囲・checkpoint: - と skip_checkpoint: は区切りにしない / run の exit", (t) => {
  const r = repo(t);
  r.commit({ "src/a.txt": "bug\n", [F(N(1))]: notice(N(1), { checkpoint: "-" }) });
  r.commit({ "src/a.txt": "bug2\n", [F(N(2))]: notice(N(2)) });
  r.commit({ "src/a.txt": "ok\n", [F(N(3))]: notice(N(3), { skip: N(2) }) });
  assert.deepEqual(checkpointsIn(r.dir, r.base, "HEAD").map((c) => c.id), [N(3)]);
  const log = [];
  assert.equal(run(r.dir, [`${r.base}..HEAD`, `--check=${OK}`], (l) => log.push(l)), 0);
  r.commit({ "src/a.txt": "bug3\n", [F(N(4))]: notice(N(4)) });
  r.commit({ "src/a.txt": "ok2\n", [F(N(5))]: notice(N(5)) });
  const log2 = [];
  assert.equal(run(r.dir, [`${r.base}..HEAD`, `--check=${OK}`], (l) => log2.push(l)), 1);
  assert.match(log2.join("\n"), new RegExp(`最初に壊れた区切り = ${N(4)}`));
  assert.equal(run(r.dir, ["HEAD..HEAD", `--check=${OK}`], () => {}), 0);
  assert.equal(run(r.dir, ["nowhere..HEAD"], () => {}), 2);
});

test("先取り: 途中の区切りが壊れても、fork が直後に取る後の clean な修正(脇の commit)を取った木で通る / pick:- なら壊れた / --at が修正の前なら壊れた", (t) => {
  for (const pick of ["clean", "-"]) {
    const r = repo(t);
    const b1 = r.commit({ "src/a.txt": "bug\n", [F(N(1))]: notice(N(1)) });
    r.commit({ "src/b.txt": "2\n", [F(N(2))]: notice(N(2)) });
    // 修正 n3 を壊れた地点 b1 の脇の commit で出して --no-ff merge
    r.g("switch", "-q", "-c", "fix", b1);
    const fix = r.commit({ "src/a.txt": "fixed\n", [F(N(3))]: notice(N(3), { fixes: N(1), pick }) });
    r.g("switch", "-q", "main");
    r.g("merge", "-q", "--no-ff", "-m", "merge fix", "fix");
    const res = check(r.dir, r.base, "HEAD", { checks: [OK], all: true });
    if (pick === "clean") {
      assert.deepEqual(ids(res), [`${N(1)}:ok`, `${N(2)}:ok`, `${N(3)}:picked`]);
      assert.deepEqual(res.results[0].took, [N(3)]);
      // 修正より前を先端にすると(修正が出荷前)壊れた
      assert.equal(check(r.dir, r.base, "HEAD", { checks: [OK], at: b1 }).results[0].status, "broken");
      // --no-picks 相当
      assert.equal(check(r.dir, r.base, "HEAD", { checks: [OK], stack: false }).results[0].status, "broken");
    } else {
      assert.equal(res.results[0].status, "broken");
    }
    assert.ok(fix);
  }
});

test("先取り: 取る修正が今の木に載らなければ、その区切りを壊れたと数え修正を挙げる", (t) => {
  const r = repo(t);
  const b1 = r.commit({ "src/a.txt": "bug\n", [F(N(1))]: notice(N(1)) });
  r.commit({ "src/a.txt": "bug2\n" });
  r.commit({ "src/a.txt": "fixed\n", [F(N(3))]: notice(N(3), { fixes: N(1), pick: "clean" }) });
  const res = check(r.dir, r.base, b1, { checks: [OK] });
  assert.equal(res.results[0].status, "broken");
  assert.match(res.results[0].reasons.join("\n"), new RegExp(`先に取る修正 ${N(3)}`));
});
