// .claude/skills/flux/incoming.test.mjs — 流入の発見と区間の組み立て(incoming.mjs)を一時の上流と fork で通す。実行: pnpm test .claude/skills/flux/incoming.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { forkIdOf, incoming, isBreak, normalizeUrl, parseRow, rowFromBody, run, summary } from "./incoming.mjs";
import { forkIdOfTexts } from "../../../src/lib/forkOwnership/node.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

function notice(id, fields = [], from = "up") {
  return [`# DOWNSTREAM NOTICE id:${id}`, `from: ${from}`, "severity: info", ...fields, "change: c", "required_actions: none", "verify: v", "refs: -", "notes: -", ""].join("\n");
}
const rowOf = (id, fields = []) => {
  const r = rowFromBody(notice(id, fields));
  return [`- id:${r.id}`, ...Object.entries(r.fields).map(([k, v]) => `${k}:${v}`)].join(" | ");
};

/** 小さなリポ: commit(files) / rm(paths) → sha、ship(id) で notice を出す */
function repo(t, name, forkId, from) {
  const dir = mkdtempSync(join(tmpdir(), `incoming-${name}-`));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const g = (...a) => execFileSync("git", ["-C", dir, ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  if (from) {
    rmSync(dir, { recursive: true, force: true });
    execFileSync("git", ["clone", "-q", from.dir, dir], { stdio: "ignore" });
    g("remote", "rename", "origin", "upstream");
  } else g("init", "-q", "-b", "main");
  g("config", "user.email", "t@t");
  g("config", "user.name", "t");
  const r = {
    dir,
    g,
    put(files) {
      for (const [f, text] of Object.entries(files)) {
        mkdirSync(dirname(join(dir, f)), { recursive: true });
        writeFileSync(join(dir, f), text);
      }
    },
    commit(files = {}, msg = "c") {
      r.put(files);
      g("add", "-A");
      g("commit", "-qm", msg, "--allow-empty");
      return g("rev-parse", "HEAD");
    },
    /** notice を出す(本文の from: = 自分の名前。一覧は履歴から作るので索引は書かない、D350) */
    ship(id, fields = [], extra = {}) {
      return r.commit({ [`.notices/${id}.md`]: notice(id, fields, forkId), ...extra });
    },
    rm(paths, msg = "rm") {
      g("rm", "-q", "-r", ...paths);
      g("commit", "-qm", msg);
      return g("rev-parse", "HEAD");
    },
    fetch() {
      g("fetch", "-q", "upstream");
    },
  };
  if (!from) r.commit({ "repo.json": `{"repo_id": "${forkId}", "tier": "root"}\n` }, "base");
  else r.commit({ "repo.json": `{"repo_id": "${forkId}", "tier": "middle"}\n`, [`.notices/applied/${forkId}.md`]: "" }, "fork: own name");
  return r;
}

const N = (k) => `20990101-00000${k}-n${k}`;
const ledger = (forkId, ...ids) => ({ [`.notices/applied/${forkId}.md`]: ids.map((id) => `- id:${id} | date:x | commit:- | upstream:x | notes:-\n`).join("") });

/** 2 段: 上流 up(n0 は fork 前)と fork f。n1 区切り / n2 - / n3 区切り / 区切りの後の commit */
function twoTier(t) {
  const up = repo(t, "up", "up");
  up.ship(N(0), ["checkpoint: zero"]);
  const f = repo(t, "f", "f", up);
  const p1 = up.ship(N(1), ["checkpoint: one"]);
  up.ship(N(2), ["checkpoint: -"]);
  const p3 = up.ship(N(3), ["checkpoint: three"]);
  up.commit({ "src/after.txt": "x" });
  f.fetch();
  return { up, f, p1, p3 };
}

test("rows: parseRow reads the old index line form (old histories); checkpoint absent = break, skip_checkpoint = not a break", () => {
  const row = parseRow(rowOf(N(1), ["checkpoint: a", "hotfix: reason", "fixes: x, commit:abc1234"]));
  assert.deepEqual(row, { id: N(1), fields: { severity: "info", checkpoint: "a", fixes: "x, commit:abc1234", hotfix: "yes" } });
  assert.equal(isBreak({ id: "a", fields: {} }, new Set()), true);
  assert.equal(isBreak({ id: "a", fields: { checkpoint: "-" } }, new Set()), false);
  assert.equal(isBreak({ id: "a", fields: { checkpoint: "a" } }, new Set(["a"])), false);
  assert.equal(normalizeUrl("git@github.com:Me/Repo.git"), normalizeUrl("https://github.com/me/repo/"));
});

test("segments: inherited and ledgered left out, closed right after a break, '-' rides to the next break, a tail for the rest", (t) => {
  const { f, p1, p3 } = twoTier(t);
  const r = incoming(f.dir, { upstream: "upstream/main" });
  assert.deepEqual(summary(r), [`1:${p1.slice(0, 8)}:${N(1)}`, `2:${p3.slice(0, 8)}:${N(2)},${N(3)}`, `3:${r.tip.slice(0, 8)}:`]);
  assert.match(r.segments[0].notices[0].body, new RegExp(`^${r.tip}:\\.notices/${N(1)}\\.md$`), "the body's last version: the tip's");
  f.commit(ledger("f", N(1)));
  assert.deepEqual(summary(incoming(f.dir, { upstream: "upstream/main" })).map((s) => s.split(":")[2]), [`${N(2)},${N(3)}`, ""]);
});

test("segment 0: a notice already merged but not in the ledger", (t) => {
  const { f, p1 } = twoTier(t);
  f.g("merge", "-q", "--no-edit", p1);
  const r = incoming(f.dir, { upstream: "upstream/main" });
  assert.equal(summary(r)[0], `0:tree:${N(1)}`);
  assert.equal(r.segments[1].n, 1);
});

test("skip_checkpoint on a later fix makes the named notice ride to the next break", (t) => {
  const { up, f, p3 } = twoTier(t);
  up.ship(N(4), ["checkpoint: four", `fixes: ${N(1)}`, `skip_checkpoint: ${N(1)}`, "pick: -"]);
  f.fetch();
  const r = incoming(f.dir, { upstream: "upstream/main" });
  assert.equal(summary(r)[0], `1:${p3.slice(0, 8)}:${N(1)},${N(2)},${N(3)}`);
  assert.equal(r.segments[0].notices[0].skipCheckpoint, true);
});

test("bodies deleted after their segments closed: the same segments (the list is the history), the body read at its last version before the delete", (t) => {
  const { up, f } = twoTier(t);
  const before = summary(incoming(f.dir, { upstream: "upstream/main" })).slice(0, -1);
  up.rm([`.notices/${N(1)}.md`, `.notices/${N(2)}.md`, `.notices/${N(3)}.md`]);
  f.fetch();
  const after = incoming(f.dir, { upstream: "upstream/main" });
  assert.deepEqual(summary(after).slice(0, -1), before);
  const body = after.segments[0].notices[0].body;
  assert.match(f.g("show", body), new RegExp(`id:${N(1)}`));
});

test("the body's last version: a body corrected after its adding commit is read (fields and body) at the tip (D350)", (t) => {
  const { up, f } = twoTier(t);
  up.commit({ [`.notices/${N(1)}.md`]: notice(N(1), ["checkpoint: one", "manual_steps: run the SQL"]).replace("severity: info", "severity: breaking") }, "correct n1");
  f.fetch();
  const r = incoming(f.dir, { upstream: "upstream/main" });
  const n1 = r.segments[0].notices[0];
  assert.equal(n1.fields.severity, "breaking");
  assert.match(f.g("show", n1.body), /severity: breaking/);
  assert.equal(n1.point, r.segments[0].target, "the point stays the adding commit");
});

test("a body added by a merge (a middle tier's relay) is in the list; a renamed body's old name is not", (t) => {
  const up = repo(t, "up", "up");
  up.ship(N(0), ["checkpoint: zero"]);
  const f = repo(t, "f", "f", up);
  up.g("checkout", "-q", "-b", "side");
  up.commit({ "side.txt": "s" }, "side");
  up.g("checkout", "-q", "main");
  up.commit({ "main.txt": "m" }, "main");
  up.g("merge", "-q", "--no-commit", "side");
  up.put({ [`.notices/${N(1)}.md`]: notice(N(1), ["checkpoint: relay"]) });
  up.g("add", "-A");
  up.g("commit", "-qm", "merge side with a relay body");
  const merged = up.g("rev-parse", "HEAD");
  up.ship(N(2), ["checkpoint: old-name"]);
  up.g("mv", `.notices/${N(2)}.md`, `.notices/${N(3)}.md`);
  up.put({ [`.notices/${N(3)}.md`]: notice(N(3), ["checkpoint: old-name"], "up") });
  up.g("add", "-A");
  up.g("commit", "-qm", "rename n2 to n3");
  f.fetch();
  const r = incoming(f.dir, { upstream: "upstream/main" });
  const ids = r.segments.flatMap((s) => s.notices.map((n) => n.id));
  assert.ok(ids.includes(N(1)), ids.join());
  assert.equal(r.segments.find((s) => s.notices.some((n) => n.id === N(1))).target, merged, "the merge is its adding commit");
  assert.ok(ids.includes(N(3)) && !ids.includes(N(2)), ids.join());
});

test("checkpoint_at: taken only after the adding commit, before the next notice's and on the tip's line; else the adding commit and a warning (D353)", (t) => {
  const up = repo(t, "up", "up");
  up.ship(N(0), ["checkpoint: zero"]);
  const f = repo(t, "f", "f", up);
  const p1 = up.ship(N(1), ["checkpoint: one"]);
  const fix = up.commit({ "src/x.txt": "fix" }, "the code n1's body was later written for");
  up.commit({ [`.notices/${N(1)}.md`]: notice(N(1), ["checkpoint: one", `checkpoint_at: ${fix}`]) }, "n1: checkpoint_at");
  const p2 = up.ship(N(2), ["checkpoint: two"]);
  f.fetch();
  let r = incoming(f.dir, { upstream: "upstream/main" });
  assert.equal(r.segments[0].target, fix);
  assert.equal(r.warnings.length, 0, r.warnings.join());
  up.commit({ [`.notices/${N(1)}.md`]: notice(N(1), ["checkpoint: one", `checkpoint_at: ${p2}`]) }, "n1: past the next notice");
  f.fetch();
  r = incoming(f.dir, { upstream: "upstream/main" });
  assert.equal(r.segments[0].target, p1);
  assert.match(r.warnings.join(), new RegExp(`${N(1)}: checkpoint_at: .* を採らない`));
  up.commit({ [`.notices/${N(1)}.md`]: notice(N(1), ["checkpoint: one", "checkpoint_at: 0000000000000000000000000000000000000000"]) }, "n1: unknown");
  f.fetch();
  assert.equal(incoming(f.dir, { upstream: "upstream/main" }).segments[0].target, p1);
});


test("3 tiers: a grandparent row's point is the commit the middle tier's ledger recorded it; covered ids ride with the covers side", (t) => {
  const t1 = repo(t, "t1", "t1");
  const t2 = repo(t, "t2", "t2", t1);
  t2.commit(ledger("t2"));
  const t3 = repo(t, "t3", "t3", t2);
  const g1 = t1.ship(N(1), ["checkpoint: g-one"]);
  t1.ship(N(2), ["checkpoint: g-two"]);
  t2.fetch();
  t2.g("merge", "-q", "--no-edit", "upstream/main");
  const rec1 = t2.commit(ledger("t2", N(1), N(2)), "t2 applied g1 g2");
  const r1 = t2.ship(N(5), ["checkpoint: relay", `covers: ${N(2)}`]);
  t3.fetch();
  const r = incoming(t3.dir, { upstream: "upstream/main" });
  assert.equal(r.mid, "t2");
  assert.equal(r.midIsTier, true);
  const s = summary(r);
  assert.equal(s[0], `1:${rec1.slice(0, 8)}:${N(1)}`);
  assert.equal(s[1], `2:${r1.slice(0, 8)}:${N(5)}[${N(2)}]`);
  assert.equal(r.segments[0].notices[0].grandparent, true);
  assert.notEqual(rec1, g1);
  // 中間 Tier の台帳に無い祖父の行 = 足した commit + 警告
  const g3 = t1.ship(N(3), ["checkpoint: g-three"]);
  t2.fetch();
  t2.g("merge", "-q", "--no-edit", "upstream/main");
  t3.fetch();
  const r2 = incoming(t3.dir, { upstream: "upstream/main" });
  assert.ok(r2.segments.some((x) => x.target === g3 && x.notices[0].id === N(3)));
  assert.ok(r2.segments.every((x) => !x.pattern && !x.rejoin), "中間 Tier が上流を merge した形は Rejoin ではない");
  assert.match(r2.warnings.join(), new RegExp(`${N(3)}: 中間 Tier t2 が未適用`));
});

test("stops: shallow clone (exit 2); an upstream with bodies only is read the same (no index any more)", (t) => {
  const { up, f } = twoTier(t);
  const shallow = mkdtempSync(join(tmpdir(), "incoming-shallow-"));
  t.after(() => rmSync(shallow, { recursive: true, force: true }));
  execFileSync("git", ["clone", "-q", "--depth=1", `file://${f.dir}`, shallow], { stdio: "ignore" });
  const out = [];
  assert.equal(run(shallow, ["--upstream=origin/main"], (l) => out.push(l)), 2);
  assert.match(out.join(), /浅い clone/);
  const bare = repo(t, "bare", "bare");
  bare.commit({ ".notices/20990101-000001-n1.md": notice(N(1)) });
  const g = repo(t, "g", "g", bare);
  bare.commit({ [`.notices/${N(2)}.md`]: notice(N(2), [], "bare") });
  g.fetch();
  const out3 = [];
  assert.equal(run(g.dir, ["--upstream=upstream/main"], (l) => out3.push(l)), 0);
  assert.match(out3.join("\n"), new RegExp(N(2)));
  assert.doesNotMatch(out3.join("\n"), new RegExp(N(1)), "inherited at the fork point");
});

test("self-contained: only node: imports, and a copy written elsewhere runs in the fork's cwd", (t) => {
  const src = readFileSync(join(HERE, "incoming.mjs"), "utf8");
  const imports = [...src.matchAll(/^import .* from "([^"]+)";$/gm)].map((m) => m[1]);
  assert.ok(imports.length && imports.every((m) => m.startsWith("node:")), imports.join(", "));
  const { f } = twoTier(t);
  const dir = mkdtempSync(join(tmpdir(), "incoming-copy-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, "incoming.mjs"), src);
  const res = spawnSync("node", [join(dir, "incoming.mjs"), "--upstream=upstream/main"], { cwd: f.dir, encoding: "utf8" });
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.match(res.stdout, new RegExp(`区間 1 → [0-9a-f]{8} one: ${N(1)}`));
});

test("--json through a pipe: the whole output arrives and parses (process.exit used to cut it at the pipe buffer)", (t) => {
  const up = repo(t, "up", "up");
  const f = repo(t, "f", "f", up);
  // 1 commit で notice を多数出して、JSON を数十 KB にする
  const ids = Array.from({ length: 300 }, (_, k) => `20990102-${String(k).padStart(6, "0")}-bulk`);
  const files = { ".notices/shipped/up.md": `# SHIPPED up\n\n${ids.map((id) => rowOf(id, ["checkpoint: bulk"])).join("\n")}\n` };
  for (const id of ids) files[`.notices/${id}.md`] = notice(id, ["checkpoint: bulk"]);
  up.commit(files);
  f.fetch();
  const res = spawnSync("node", [join(HERE, "incoming.mjs"), "--upstream=upstream/main", "--json"], { cwd: f.dir, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  assert.equal(res.status, 0, res.stderr);
  assert.ok(res.stdout.length > 65536, `output too small to exercise the pipe: ${res.stdout.length}`);
  const parsed = JSON.parse(res.stdout);
  assert.equal(parsed.segments.flatMap((s) => s.notices).length, ids.length);
});

test("脇の commit の区間(Backport の道): 本線の notice を名指す修正を脇で出して merge → Rejoin は名指しで決めず、fork が取っていなければ offLine と mainline / 取っていれば・直線なら印なし", (t) => {
  const up = repo(t, "up", "up");
  up.ship(N(0), ["checkpoint: zero"]);
  const f = repo(t, "f", "f", up);
  const p1 = up.ship(N(1), ["checkpoint: one"]);
  up.ship(N(2), ["checkpoint: two"]);
  // 修正 n3 を壊れた地点 p1 の脇の commit で出して --no-ff merge(束 5 の形)
  up.g("switch", "-q", "-c", "fix", p1);
  const side = up.ship(N(3), ["checkpoint: three", `fixes: ${N(2)}`], { "src/fix.txt": "fixed" });
  up.g("switch", "-q", "main");
  // 本線の索引は脇の行も持つ(/ship は merge で両方の行を残す)
  try {
    up.g("merge", "-q", "--no-ff", "-m", "merge fix", "fix");
  } catch {
    up.g("checkout", "--theirs", "--", ".notices/shipped/up.md");
    up.g("add", "-A");
    up.g("commit", "-qm", "merge fix");
  }
  const merge = up.g("rev-parse", "HEAD");
  up.ship(N(4), ["checkpoint: four"]);
  f.fetch();
  const segs = incoming(f.dir, { upstream: "upstream/main" }).segments;
  const offs = segs.filter((s) => s.offLine);
  assert.equal(offs.length, 1, summary({ segments: segs }).join("\n"));
  assert.ok(segs.some((s) => s.rejoin?.undecided && /名指す/.test(s.rejoin.why)), "名指しの縛りは今どおり止める");
  assert.equal(offs[0].target, side);
  assert.equal(offs[0].mainline, merge);
  const log = [];
  run(f.dir, ["--upstream=upstream/main"], (l) => log.push(l));
  assert.match(log.join("\n"), /脇の commit/);

  // fork が修正を取った(台帳に載る)なら、その区間は無く印も無い
  f.commit(ledger("f", N(3)));
  assert.ok(incoming(f.dir, { upstream: "upstream/main" }).segments.every((s) => !s.offLine));

  // 直線の履歴では印なし
  const { f: f2 } = twoTier(t);
  assert.ok(incoming(f2.dir, { upstream: "upstream/main" }).segments.every((s) => !s.offLine));
});

test("脇で出した修正と本線の両方に区切りがあり名指しが無ければ Rejoin: 本線が先・修正は合流の区間(脇にならない、止まらない)", (t) => {
  const build = () => {
    const up = repo(t, "up", "up");
    up.ship(N(0), ["checkpoint: zero"]);
    const f = repo(t, "f", "f", up);
    const p1 = up.ship(N(1), ["checkpoint: one"]);
    const p2 = up.ship(N(2), ["checkpoint: two"]);
    up.g("switch", "-q", "-c", "fix", p1);
    up.ship(N(3), ["checkpoint: three", `fixes: ${N(1)}`], { "src/fix.txt": "fixed" });
    up.g("switch", "-q", "main");
    up.g("merge", "-q", "--no-ff", "-m", "merge fix", "fix");
    const merge = up.g("rev-parse", "HEAD");
    f.fetch();
    return { f, p2, merge };
  };
  const { f, p2, merge } = build();
  const segs = incoming(f.dir, { upstream: "upstream/main" }).segments.filter((s) => s.target);
  assert.ok(segs.every((s) => !s.offLine && !s.rejoin?.undecided), summary({ segments: segs }).join("\n"));
  assert.equal(segs.find((s) => s.notices.some((n) => n.id === N(2))).target, p2);
  assert.equal(segs.find((s) => s.notices.some((n) => n.id === N(3))).rejoinMerge, merge);
});

test("名前の写し forkIdOf は forkIds.mjs の forkIdOfTexts と同じ答え(自己完結のための写し、規則は forkIds.mjs が正本)", () => {
  const CASES = [
    ['{"repo_id": "acme", "tier": "leaf"}', null],
    ['{"repo_id": "acme"}', null],
    ['{"repo_id": "Bad_Name", "tier": "leaf"}', null],
    ['{"repo_id": "-", "tier": "leaf"}', null],
    ['{"tier": "leaf"}', null],
    ["{broken", null],
    ['{"repo_id": "acme"}', "fork_id: other\n"],
    [null, "fork_id: acme\n"],
    [null, "fork_id: acme  # 注釈\n"],
    [null, "fork_id: -\n"],
    [null, "fork_id: Bad\n"],
    [null, "fork_id: a\nfork_id: b\n"],
    [null, "名前の行なし\n"],
    [null, null],
  ];
  for (const [repoJson, projectMd] of CASES) {
    assert.equal(forkIdOf(repoJson, projectMd), forkIdOfTexts({ repoJson, projectMd }).forkId, JSON.stringify({ repoJson, projectMd }));
  }
});

/** Rejoin の形: 分かれる点の後、本線に main 個・脇の線に side 個の区切り(fields で欄を足す)、--no-ff merge、その後に区切り 1 つ */
function split(t, { main, side, sideFields = () => [], extra = 0 }) {
  const up = repo(t, "up", "up");
  up.ship(N(0), ["checkpoint: zero"]);
  const f = repo(t, "f", "f", up);
  const fork = up.g("rev-parse", "HEAD");
  let k = 1;
  const id = () => `20990101-0001${String(k).padStart(2, "0")}-r${k++}`;
  const mainPts = [];
  for (let i = 0; i < main; i++) { const n = id(); mainPts.push({ id: n, sha: up.ship(n, [`checkpoint: m${i}`]) }); }
  up.g("switch", "-q", "-c", "side", fork);
  const sidePts = [];
  for (let i = 0; i < side; i++) { const n = id(); sidePts.push({ id: n, sha: up.ship(n, [`checkpoint: s${i}`, ...sideFields(mainPts, i)]) }); }
  const lines = [];
  for (let i = 0; i < extra; i++) { up.g("switch", "-q", "-c", `third${i}`, fork); const n = id(); lines.push({ id: n, sha: up.ship(n, [`checkpoint: t${i}`]) }); }
  up.g("switch", "-q", "main");
  // 本線の索引は脇の行も持つ(/ship は merge で両方の行を残す)。3 本目以降は続けて merge(重なった合流 = 3 本以上の線)
  const join = (head) => {
    try {
      up.g("merge", "-q", "--no-ff", "-m", `rejoin ${head}`, head);
    } catch {
      up.g("checkout", "--theirs", "--", ".notices/shipped/up.md");
      up.g("add", "-A");
      up.g("commit", "-qm", `rejoin ${head}`);
    }
  };
  join("side");
  const merge = up.g("rev-parse", "HEAD");
  lines.forEach((_, i) => join(`third${i}`));
  const after = id();
  up.ship(after, ["checkpoint: after"]);
  f.fetch();
  return { f, up, mainPts, sidePts, merge, after };
}

test("Rejoin: 区切りの多い線(3)を 1 つずつ先に、少ない線(1)は合流の merge を目標の区間 1 つに、その後は今どおり", (t) => {
  const { f, mainPts, sidePts, merge, after } = split(t, { main: 3, side: 1 });
  const r = incoming(f.dir, { upstream: "upstream/main" });
  const segs = r.segments.filter((s) => s.target);
  assert.deepEqual(segs.slice(0, 3).map((s) => s.target), mainPts.map((p) => p.sha), summary(r).join("\n"));
  assert.ok(segs.slice(0, 3).every((s) => s.pattern === "Rejoin" && !s.rejoinMerge && !s.rejoin));
  assert.equal(segs[3].target, merge);
  assert.equal(segs[3].rejoinMerge, merge);
  assert.deepEqual(segs[3].notices.map((n) => n.id), sidePts.map((p) => p.id));
  assert.ok(r.segments.every((s) => !s.offLine), "並べ直した区間は脇にならない");
  assert.equal(segs[4].notices[0].id, after);
  assert.equal(segs[4].pattern, undefined);
  const log = [];
  run(f.dir, ["--upstream=upstream/main"], (l) => log.push(l));
  assert.match(log.join("\n"), /Rejoin パターン: ほかの線を合流の merge/);
});

test("Rejoin: 長い線の一部を取った後も merge 全体で数える(本線 3・脇 2、本線の 1 つ目を取った後の残り 2 対 2 でも止まらない)", (t) => {
  const { f, mainPts, sidePts, merge } = split(t, { main: 3, side: 2 });
  f.g("merge", "-q", "--no-ff", "-m", "take m0", mainPts[0].sha);
  f.commit(ledger("f", mainPts[0].id));
  const segs = incoming(f.dir, { upstream: "upstream/main" }).segments.filter((s) => s.target);
  assert.ok(segs.every((s) => !s.rejoin?.undecided), "残りが同じ数でも決める");
  assert.deepEqual(segs.slice(0, 2).map((s) => s.target), mainPts.slice(1).map((p) => p.sha), "本線の残りを 1 つずつ先に");
  assert.equal(segs[2].rejoinMerge, merge);
  assert.deepEqual(segs[2].notices.map((n) => n.id), sidePts.map((p) => p.id), "脇は合流の merge で");
});

test("Rejoin: 多い側が脇の線でも同じ(脇 2 → 本線 1 は合流で)", (t) => {
  const { f, mainPts, sidePts, merge } = split(t, { main: 1, side: 2 });
  const segs = incoming(f.dir, { upstream: "upstream/main" }).segments.filter((s) => s.target);
  assert.deepEqual(segs.slice(0, 2).map((s) => s.target), sidePts.map((p) => p.sha));
  assert.equal(segs[2].rejoinMerge, merge);
  assert.deepEqual(segs[2].notices.map((n) => n.id), mainPts.map((p) => p.id));
});

test("Rejoin: 決めない形は片側の notice が他の側を名指す時だけ → 印だけで並びは履歴の順", (t) => {
  const { f } = split(t, { main: 2, side: 1, sideFields: (m) => [`fixes: ${m[0].id}`] });
  const r = incoming(f.dir, { upstream: "upstream/main" });
  const marked = r.segments.filter((s) => s.rejoin?.undecided);
  assert.ok(marked.length > 0);
  assert.match(marked[0].rejoin.why, /名指す/);
  assert.ok(r.segments.every((s) => !s.rejoinMerge));
});

test("Rejoin: 同じ数なら上流の first-parent の線を先に(止まらない)", (t) => {
  const { f, mainPts, sidePts, merge } = split(t, { main: 2, side: 2 });
  const segs = incoming(f.dir, { upstream: "upstream/main" }).segments.filter((s) => s.target);
  assert.ok(segs.every((s) => !s.rejoin?.undecided), "同じ数でも決める");
  assert.deepEqual(segs.slice(0, 2).map((s) => s.target), mainPts.map((p) => p.sha), "first-parent の本線を 1 つずつ先に");
  assert.equal(segs[2].rejoinMerge, merge);
  assert.deepEqual(segs[2].notices.map((n) => n.id), sidePts.map((p) => p.id));
});

test("Rejoin: 3 本以上の線でも決める(重なった合流で前に並べた区切りは並べ直さない、脇の線は合流の区間で)", (t) => {
  const { f, mainPts, sidePts, merge } = split(t, { main: 2, side: 1, extra: 1 });
  const r = incoming(f.dir, { upstream: "upstream/main" });
  const segs = r.segments.filter((s) => s.target);
  assert.ok(segs.every((s) => !s.rejoin?.undecided), summary(r).join("\n"));
  assert.deepEqual(segs.slice(0, 2).map((s) => s.target), mainPts.map((p) => p.sha));
  assert.equal(segs[2].rejoinMerge, merge);
  assert.deepEqual(segs[2].notices.map((n) => n.id), sidePts.map((p) => p.id));
});

test("Rejoin: 3 本の線で脇の 2 本が台帳済みなら残る線は 1 本 → 決まり(印なし、止まらない)", (t) => {
  const { f, sidePts } = split(t, { main: 2, side: 1, extra: 1 });
  // 脇の線と 3 本目の区切りを取り込み済みに(台帳と木)
  const third = f.g("rev-parse", "upstream/third0").trim();
  f.g("merge", "-q", "--no-ff", "-m", "take side", sidePts[0].sha);
  f.g("merge", "-q", "--no-ff", "-m", "take third", third);
  const thirdId = f.g("show", "--name-only", "--format=", third).split("\n").find((x) => x.startsWith(".notices/")).replace(/^\.notices\/|\.md$/g, "");
  f.commit(ledger("f", sidePts[0].id, thirdId));
  const r = incoming(f.dir, { upstream: "upstream/main" });
  assert.ok(r.segments.every((s) => !s.rejoin?.undecided), summary(r).join("\n"));
});

test("Rejoin: 分かれの無い履歴・片側にしか区切りの無い分かれは今と同じ(印なし)", (t) => {
  const { f } = twoTier(t);
  assert.ok(incoming(f.dir, { upstream: "upstream/main" }).segments.every((s) => !s.pattern && !s.rejoin));
  const { f: f2 } = split(t, { main: 2, side: 0 });
  assert.ok(incoming(f2.dir, { upstream: "upstream/main" }).segments.every((s) => !s.pattern && !s.rejoin));
});

test("own: --own names the repo when the work tree's repo.json is upstream's (a railroad track): without it every notice reads as own", (t) => {
  const { f, p1, p3 } = twoTier(t);
  f.put({ "repo.json": `{"repo_id": "up", "tier": "root"}\n` });   // the track's work tree: upstream's repo.json
  const wrong = incoming(f.dir, { upstream: "upstream/main" });
  assert.equal(wrong.own, "up");
  assert.equal(wrong.segments.length, 1, "upstream's notices read as own: only the tail");
  const r = incoming(f.dir, { upstream: "upstream/main", own: "f" });
  assert.equal(r.own, "f");
  assert.deepEqual(summary(r), [`1:${p1.slice(0, 8)}:${N(1)}`, `2:${p3.slice(0, 8)}:${N(2)},${N(3)}`, `3:${r.tip.slice(0, 8)}:`]);
  const lines = [];
  assert.equal(run(f.dir, ["--upstream=upstream/main", "--own=f"], (s) => lines.push(s)), 0);
  assert.match(lines[0], /自分 f /);
  assert.equal(run(f.dir, ["--upstream=upstream/main", "--own=Bad_Name"], (s) => lines.push(s)), 2);
  assert.match(lines.at(-1), /repo_id の形でない/);
});
