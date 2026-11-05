// .claude/skills/flux/incoming.test.mjs — 流入の発見と区間の組み立て(incoming.mjs)を一時の上流と fork で通す。実行: pnpm test:notices
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { incoming, isBreak, normalizeUrl, parseRow, rowFromBody, run, summary } from "./incoming.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

function notice(id, fields = []) {
  return [`# DOWNSTREAM NOTICE id:${id}`, "from: up", "severity: info", ...fields, "change: c", "required_actions: none", "verify: v", "refs: -", "notes: -", ""].join("\n");
}
const rowOf = (id, fields = []) => {
  const r = rowFromBody(notice(id, fields));
  return [`- id:${r.id}`, ...Object.entries(r.fields).map(([k, v]) => `${k}:${v}`)].join(" | ");
};

/** 小さなリポ: commit(files) / rm(paths) → sha。index(owner, rows) で索引を足す */
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
  const rows = new Map();
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
    /** notice と自分の索引の行を同じ commit で(/ship と同じ) */
    ship(id, fields = [], extra = {}) {
      const owner = forkId;
      rows.set(owner, [...(rows.get(owner) ?? []), rowOf(id, fields)]);
      return r.commit({ [`.notices/${id}.md`]: notice(id, fields), [`.notices/shipped/${owner}.md`]: `# SHIPPED ${owner}\n\n${rows.get(owner).join("\n")}\n`, ...extra });
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
  if (!from) r.commit({ ".claude/rules/project.md": `fork_id: ${forkId}\n` }, "base");
  else r.commit({ ".claude/rules/project.md": `fork_id: ${forkId}\n`, [`.notices/applied/${forkId}.md`]: "" }, "fork: own name");
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

test("rows: parseRow reads the same line as shippedIndex writes; checkpoint absent = break, skip_checkpoint = not a break", () => {
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
  assert.match(r.segments[0].notices[0].body, new RegExp(`^${p1}:\\.notices/${N(1)}\\.md$`));
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

test("bodies deleted after their segments closed: the same segments (index only, bodies read at the adding commit)", (t) => {
  const { up, f } = twoTier(t);
  const before = summary(incoming(f.dir, { upstream: "upstream/main" })).slice(0, -1);
  up.rm([`.notices/${N(1)}.md`, `.notices/${N(2)}.md`, `.notices/${N(3)}.md`]);
  f.fetch();
  const after = incoming(f.dir, { upstream: "upstream/main" });
  assert.deepEqual(summary(after).slice(0, -1), before);
  const body = after.segments[0].notices[0].body;
  assert.match(f.g("show", body), new RegExp(`id:${N(1)}`));
});

test("--from=bodies gives the same segments as the index (the method before the index)", (t) => {
  const { f } = twoTier(t);
  assert.deepEqual(summary(incoming(f.dir, { upstream: "upstream/main", from: "bodies" })), summary(incoming(f.dir, { upstream: "upstream/main" })));
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
  assert.match(r2.warnings.join(), new RegExp(`${N(3)}: 中間 Tier t2 が未適用`));
});

test("stops: shallow clone, a row without its adding commit (exit 2); no index at the tip (exit 3)", (t) => {
  const { up, f } = twoTier(t);
  const shallow = mkdtempSync(join(tmpdir(), "incoming-shallow-"));
  t.after(() => rmSync(shallow, { recursive: true, force: true }));
  execFileSync("git", ["clone", "-q", "--depth=1", `file://${f.dir}`, shallow], { stdio: "ignore" });
  const out = [];
  assert.equal(run(shallow, ["--upstream=origin/main"], (l) => out.push(l)), 2);
  assert.match(out.join(), /浅い clone/);
  up.commit({ ".notices/shipped/up.md": `${readFileSync(join(up.dir, ".notices/shipped/up.md"), "utf8")}- id:20990101-000009-ghost | severity:info\n` });
  f.fetch();
  const out2 = [];
  assert.equal(run(f.dir, ["--upstream=upstream/main"], (l) => out2.push(l)), 2);
  assert.match(out2.join(), /ghost: 索引に行があるのに/);
  const bare = repo(t, "bare", "bare");
  bare.commit({ ".notices/20990101-000001-n1.md": notice(N(1)) });
  const g = repo(t, "g", "g", bare);
  const out3 = [];
  assert.equal(run(g.dir, ["--upstream=upstream/main"], (l) => out3.push(l)), 3);
  assert.match(out3.join(), /索引 \.notices\/shipped\/ が無い/);
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

test("脇の commit の区間: 修正を壊れた地点の脇で出して merge、fork が取っていなければ offLine と mainline / 取っていれば・直線なら印なし", (t) => {
  const up = repo(t, "up", "up");
  up.ship(N(0), ["checkpoint: zero"]);
  const f = repo(t, "f", "f", up);
  const p1 = up.ship(N(1), ["checkpoint: one"]);
  up.ship(N(2), ["checkpoint: two"]);
  // 修正 n3 を壊れた地点 p1 の脇の commit で出して --no-ff merge(束 5 の形)
  up.g("switch", "-q", "-c", "fix", p1);
  const side = up.ship(N(3), ["checkpoint: three", `fixes: ${N(1)}`], { "src/fix.txt": "fixed" });
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
