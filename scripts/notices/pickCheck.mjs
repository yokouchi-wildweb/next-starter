// scripts/notices/pickCheck.mjs
// 修正(fixes:)の notice が「先に取れる」かを、出荷の前に機械で判定する(/ship。欄 pick: clean | -)。
// /flux は pick: clean の修正を、修正元の区間を取り込んだ直後に cherry-pick する。そこで試す土台は fork の位置ではなく
// 壊れた地点(修正元の区切りのコミット)で、その上に修正のコミットだけを載せた一時の木で次を全部満たすときだけ clean:
//   1. 機械で決まる hotfix の条件: notice と本体が同じ 1 commit / pnpm-lock.yaml・src/app/route-map.jsonl を含まない /
//      required_actions 〜 manual_steps が、壊れた地点より後の notice を名指さない
//   2. cherry-pick が衝突しない(出荷索引 .notices/shipped/ の変更は捨てて載せる: pickDroppingIndex.mjs)
//   3. 載せた木で検査が通る(既定 pnpm typecheck と pnpm test:config-module-load。その木の package.json に無い script は未実行と書いて飛ばす)
//   4. 遅れた fork 向けの前提の検査(hotfixCheck.mjs の findGaps: paths:・pnpm <script>・名指すパス)が何も挙げない
// notices:hotfix-check は存在の検査だけで型・merge の成立を見ないので、ここでは 4 の部品として呼ぶだけで、clean の根拠は 1〜4 の全部。
//
// 修正元(fixes: の各項目)→ 壊れた地点:
//   notice id = その notice の追加 commit、commit:<sha> = その commit。そこから履歴を進んで最初に来る区切りの notice
//   (checkpoint: がラベル、または欄なし)の追加 commit が壊れた地点。修正の commit の前に区切りが無ければ、修正元と修正は
//   同じ区間で届く(先に取る意味が無い)ので -。修正元が複数なら最も古い壊れた地点を土台にする。
//   修正元が修正(fixes: を持つ notice)のとき(修正の修正): その修正の pick: が clean なら、その修正の土台の上にその修正を
//   載せた木を土台にする(fork はそこで先に取っているため)。clean でなければ連鎖を試さず -。
//   別の notice の pick:clean の修正も、fork が壊れた地点までに先に取っているもの(その修正の土台が壊れた地点かその祖先で、
//   出荷済み(--at、既定 HEAD の祖先)で修正の後の履歴にないもの)は履歴順に先に載せてから試す(stackedPicks。土台 + 先に載せた修正 = fork の実際の木)。
//
// 実行: pnpm notices:pick-check <commit> [--dry-run] [--at=<ref>] [--check=<cmd> ...]
//   commit = 修正の notice を足した commit。--dry-run 以外は判定を自分の索引 .notices/shipped/<fork_id>.md のその notice の行の
//   pick: に書く(作業ツリー。本文には書かない。行が無ければ書かずに exit 2: 先に shippedIndex.mjs add で行を足して commit する)。
//   --at = 出荷する先端(既定 HEAD)。先に載せる別の clean な修正はこの祖先から選ぶ(脇の commit の修正は merge の後の先端で)
//   --check = 3 の検査を差し替える(繰り返し可。テスト用)
//   exit 0 = 全部 clean | 1 = - がある | 2 = 判定できない(fixes: の notice が無い・修正元が見つからない・依存を入れられない)
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { findGaps, hasGaps, noticeSections } from "./hotfixCheck.mjs";
import { pickDroppingIndex } from "./pickDroppingIndex.mjs";
import { indexPath, ownForkId, parseIndex, SHIPPED_DIR, writeRowPick } from "./shippedIndex.mjs";

export const FORBIDDEN = ["pnpm-lock.yaml", "src/app/route-map.jsonl"];
export const DEFAULT_CHECKS = ["pnpm typecheck", "pnpm test:config-module-load"];
const NOTICE_FILE = /^\.notices\/(?:done\/)?(\d{8}-\d{6}-[^/]+)\.md$/;
const NOTICE_ID = /\b\d{8}-\d{6}-[a-z0-9][a-z0-9-]*\b/g;

function git(cwd, args, opts = {}) {
  return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024, ...opts });
}

function isAncestor(repo, a, b) {
  try {
    git(repo, ["merge-base", "--is-ancestor", a, b]);
    return true;
  } catch {
    return false;
  }
}

/** 欄の 1 行目の値(notices.test.mjs の parseNotice と同じ読み方) */
export function field(text, key) {
  const m = text.match(new RegExp(`^${key}:\\s?(.*)$`, "m"));
  return m ? m[1].trim() : undefined;
}

/** `fixes:` の値 → [{ id } | { commit }] */
export function parseFixes(value) {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((t) => {
      const c = t.match(/^commit:([0-9a-f]{7,40})$/);
      return c ? { commit: c[1] } : { id: t };
    });
}

/** notice 本文の pick: を value にする(あれば置き換え、無ければ fixes: の直後に足す)。
 *  索引 .notices/shipped/ の導入後は判定を行に書く(writeRowPick)。これは本文に pick: を持つ古い notice を読む側のためだけに残す */
export function writePick(text, value) {
  if (/^pick:.*$/m.test(text)) return text.replace(/^pick:.*$/m, `pick: ${value}`);
  return text.replace(/^(fixes:.*)$/m, `$1\npick: ${value}`);
}

/**
 * 修正の commit の木にある notice の索引: id → { path, add(最初に足した commit), checkpoint, fixes, pick }
 * checkpoint・fixes・pick は修正の commit の版で読む(/flux は上流の先端の版の checkpoint で区間を組む)
 * pick はその commit の索引(.notices/shipped/*.md)の行を先に、無ければ本文を読む
 */
export function noticeIndex(repo, commit) {
  const add = new Map();
  // 新しい順に出るので、最後に見た(= 最も古い)追加が元の追加。done/ への移動も --no-renames で A に出る
  const log = git(repo, ["-c", "core.quotePath=false", "log", "--no-renames", "--diff-filter=A", "--name-only", "--format=@%H", commit, "--", ".notices/"]);
  let cur = null;
  for (const line of log.split("\n")) {
    if (line.startsWith("@")) cur = line.slice(1);
    else {
      const m = line.match(NOTICE_FILE);
      if (m && cur) add.set(m[1], cur);
    }
  }
  const rowPick = new Map();
  const tree = git(repo, ["-c", "core.quotePath=false", "ls-tree", "-r", "--name-only", commit, "--", ".notices/"]).split("\n");
  for (const path of tree.filter((p) => p.startsWith(`${SHIPPED_DIR}/`) && p.endsWith(".md"))) {
    for (const r of parseIndex(git(repo, ["show", `${commit}:${path}`]))) if ("pick" in r.fields) rowPick.set(r.id, r.fields.pick);
  }
  const index = new Map();
  for (const path of tree) {
    const m = path.match(NOTICE_FILE);
    if (!m) continue;
    const text = git(repo, ["show", `${commit}:${path}`]);
    index.set(m[1], { path, text, add: add.get(m[1]) ?? null, checkpoint: field(text, "checkpoint"), fixes: field(text, "fixes"), pick: rowPick.get(m[1]) ?? field(text, "pick") });
  }
  return index;
}

/** 区切り(checkpoint がラベルか欄なし)の notice を足した commit の集合 */
function checkpointCommits(index) {
  return new Set([...index.values()].filter((n) => n.add && n.checkpoint !== "-").map((n) => n.add));
}

/** 修正元の commit から進んで、修正の commit より前で最初の区切りの commit(無ければ null) */
export function breakPoint(repo, source, fix, cps) {
  const range = git(repo, ["rev-list", "--reverse", "--topo-order", `${fix}^`, `^${source}^@`]).split("\n").filter(Boolean);
  for (const c of range) if (cps.has(c) && isAncestor(repo, source, c)) return c;
  return null;
}

/**
 * 修正元 1 つの土台: { base, picks: [先に載せる修正の commit], why } か { fail: 理由 } か { unknown: 理由 }
 * 修正元が修正(fixes: を持つ)なら連鎖をたどる
 */
export function baseFor(repo, ref, fix, index, cps, seen = new Set()) {
  if (ref.commit) {
    let sha;
    try {
      sha = git(repo, ["rev-parse", "--verify", "-q", `${ref.commit}^{commit}`]).trim();
    } catch {
      return { unknown: `fixes: commit:${ref.commit} が履歴に無い` };
    }
    const bp = breakPoint(repo, sha, fix, cps);
    return bp ? { base: bp, picks: [], why: `commit:${ref.commit} の区切り ${bp.slice(0, 8)}` } : { fail: `commit:${ref.commit} と修正が同じ区間で届く(先に取る意味が無い)` };
  }
  const n = index.get(ref.id);
  if (!n || !n.add) return { unknown: `fixes: ${ref.id} の notice が履歴に無い` };
  if (n.fixes !== undefined && !seen.has(ref.id)) {
    if (n.pick !== "clean") return { fail: `修正元 ${ref.id} は修正で pick: ${n.pick ?? "(なし)"}(連鎖を試さない)` };
    const inner = sourcesBase(repo, parseFixes(n.fixes), n.add, index, cps, new Set([...seen, ref.id]));
    if (!inner.base) return inner;
    return { base: inner.base, picks: [...inner.picks, n.add], why: `${inner.why} + 修正 ${ref.id} を先に載せた木` };
  }
  const bp = breakPoint(repo, n.add, fix, cps);
  return bp ? { base: bp, picks: [], why: `${ref.id} の区切り ${bp.slice(0, 8)}` } : { fail: `${ref.id} と修正が同じ区間で届く(先に取る意味が無い)` };
}

/** 修正元が複数: 最も古い土台(他の土台の祖先)を採る */
export function sourcesBase(repo, refs, fix, index, cps, seen = new Set()) {
  if (!refs.length) return { unknown: "fixes: が空" };
  const bases = [];
  for (const ref of refs) {
    const b = baseFor(repo, ref, fix, index, cps, seen);
    if (!b.base) return b;
    bases.push(b);
  }
  return bases.reduce((a, b) => (isAncestor(repo, b.base, a.base) && b.base !== a.base ? b : a));
}

/**
 * fork が土台 b.base に着いた時点で既に取っている、別の notice の pick:clean の修正を b に足す(土台 + picks = fork の実際の木)。
 * /flux は clean な修正を修正元の区間の直後に履歴順で取るので、対象 = 出荷済み(at = 出荷する先端、既定 HEAD の祖先)で fix より後の
 * 履歴にない(fix の子孫でない)修正のうち、土台の祖先でなく、その修正の土台が b.base か b.base の祖先であるもの(その連鎖の picks ごと)。
 * 修正を壊れた地点の脇の commit で出す形(fix と G が互いの祖先でない)もあるので、候補は fix の木ではなく at の索引から読む。
 * 戻り値 = { ...b, picks: 履歴順, stacked: [載せた修正の notice id] }
 */
export function stackedPicks(repo, fix, b, { at = "HEAD" } = {}) {
  const tip = git(repo, ["rev-parse", "--verify", "-q", `${at}^{commit}`]).trim();
  const index = noticeIndex(repo, tip);
  const cps = checkpointCommits(index);
  const want = new Set(b.picks);
  const stacked = [];
  for (const [id, g] of index) {
    if (!g.add || g.add === fix || g.fixes === undefined || g.pick !== "clean" || want.has(g.add)) continue;
    if (!isAncestor(repo, g.add, tip) || isAncestor(repo, fix, g.add) || isAncestor(repo, g.add, b.base)) continue;
    const gb = sourcesBase(repo, parseFixes(g.fixes), g.add, index, cps);
    if (!gb.base || !isAncestor(repo, gb.base, b.base)) continue;
    for (const p of [...gb.picks, g.add]) if (!isAncestor(repo, p, b.base)) want.add(p);
    stacked.push(id);
  }
  if (!stacked.length) return { ...b, stacked };
  const order = git(repo, ["rev-list", "--reverse", "--topo-order", tip, fix, `^${b.base}`]).split("\n").filter((c) => want.has(c));
  return { ...b, picks: order, stacked, why: `${b.why}${stacked.map((id) => ` + 修正 ${id} を先に載せた`).join("")}` };
}

/** commit の中身から決まる条件(土台に依らない) */
export function commitConditions(files, noticePath) {
  const out = [];
  if (!files.includes(noticePath)) out.push("notice と本体が同じ 1 commit でない(notice をこの commit で足していない)");
  if (!files.some((f) => !f.startsWith(".notices/"))) out.push("commit に本体が無い");
  for (const f of FORBIDDEN) if (files.includes(f)) out.push(`fork ごとに中身が違う ${f} を含む`);
  return out;
}

function runChecks(dir, checks, scripts) {
  const out = { failed: [], skipped: [] };
  for (const cmd of checks) {
    const m = cmd.match(/^pnpm\s+(?:run\s+)?([\w:.-]+)/);
    if (m && scripts && !(m[1] in scripts)) {
      out.skipped.push(`${cmd}(その木の package.json に無い)`);
      continue;
    }
    const r = spawnSync(cmd, { cwd: dir, shell: true, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    if (r.status !== 0) out.failed.push(`${cmd} が落ちる: ${`${r.stdout}\n${r.stderr}`.trim().split("\n").slice(-3).join(" / ")}`);
  }
  return out;
}

/** 依存: 土台の lock が repo の lock と同じなら node_modules を借り、違えば一時の木に入れる */
function provideDeps(repo, dir) {
  if (!existsSync(join(dir, "package.json"))) return null;
  const lockHere = join(dir, "pnpm-lock.yaml");
  const lockRepo = join(repo, "pnpm-lock.yaml");
  const same = existsSync(lockHere) && existsSync(lockRepo) && readFileSync(lockHere, "utf8") === readFileSync(lockRepo, "utf8");
  if (same && existsSync(join(repo, "node_modules"))) {
    symlinkSync(join(repo, "node_modules"), join(dir, "node_modules"), "dir");
    return null;
  }
  if (!existsSync(lockHere)) return null; // lock の無い木(テストの小さなリポ)は依存を入れない
  const r = spawnSync("pnpm", ["install", "--frozen-lockfile", "--prefer-offline", "--ignore-scripts", "--reporter=silent"], { cwd: dir, encoding: "utf8" });
  return r.status === 0 ? null : `依存を入れられない(pnpm install): ${(r.stderr || r.stdout).trim().split("\n").slice(-2).join(" / ")}`;
}

/** 土台 + picks + 修正の commit を載せた一時の木で 2〜4 を見る */
export function tryOnBase(repo, commit, { base, picks }, { checks = DEFAULT_CHECKS, noticePath } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "pick-check-"));
  try {
    execFileSync("git", ["clone", "-q", "--shared", "--no-checkout", repo, dir], { stdio: "ignore" });
    git(dir, ["switch", "-q", "--detach", base]);
    // 出荷索引の変更は捨てて載せる(索引の無い・短い土台で必ず衝突するため。pickDroppingIndex.mjs)
    for (const p of picks) {
      try {
        if (pickDroppingIndex(dir, p).conflicts.length) throw new Error("conflict");
        git(dir, ["-c", "user.name=pick-check", "-c", "user.email=pick-check@local", "commit", "-q", "--no-verify", "--allow-empty", "-m", `pick ${p}`]);
      } catch {
        return { failed: [`先に載せる修正 ${p.slice(0, 8)} が土台に載らない`], skipped: [] };
      }
    }
    try {
      const { conflicts } = pickDroppingIndex(dir, commit);
      if (conflicts.length) return { failed: [`cherry-pick が衝突する(土台 ${base.slice(0, 8)}: ${conflicts.join(", ")})`], skipped: [] };
    } catch {
      return { failed: [`cherry-pick が衝突する(土台 ${base.slice(0, 8)})`], skipped: [] };
    }
    const depErr = provideDeps(repo, dir);
    if (depErr) return { unknown: depErr };
    const files = git(dir, ["-c", "core.quotePath=false", "ls-files"]).split("\n").filter(Boolean);
    const read = (f) => readFileSync(join(dir, f), "utf8");
    const pj = files.includes("package.json") ? JSON.parse(read("package.json")) : null;
    const res = runChecks(dir, checks, pj?.scripts ?? null);
    const changed = git(repo, ["-c", "core.quotePath=false", "show", "--name-only", "--diff-filter=AMR", "--format=", commit]).split("\n").filter(Boolean);
    const rules = changed.filter((f) => /^\.claude\/rules\/.+\.md$/.test(f) && files.includes(f)).map((file) => ({ file, text: read(file) }));
    const gaps = findGaps({ files, packageJson: pj, rules, notice: noticePath && files.includes(noticePath) ? read(noticePath) : "" });
    if (hasGaps(gaps)) {
      for (const { file, globs } of gaps.rules) res.failed.push(`前提: ${file} の paths: がその木に当たらない: ${globs.join(", ")}`);
      for (const s of gaps.scripts) res.failed.push(`前提: notice の手順の pnpm ${s} がその木に無い`);
      for (const p of gaps.paths) res.failed.push(`前提: notice が名指す ${p} がその木に無い`);
    }
    return res;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** 修正の commit が足した fixes: 付きの notice ごとの判定: [{ id, path, verdict: "clean" | "-" | null, reasons, base, skipped }] */
export function judge(repo, commit, opts = {}) {
  const sha = git(repo, ["rev-parse", "--verify", "-q", `${commit}^{commit}`]).trim();
  const files = git(repo, ["-c", "core.quotePath=false", "show", "--name-only", "--format=", sha]).split("\n").filter(Boolean);
  const index = noticeIndex(repo, sha);
  const cps = checkpointCommits(index);
  const targets = [...index.entries()].filter(([, n]) => n.add === sha && n.fixes !== undefined);
  return targets.map(([id, n]) => {
    const reasons = commitConditions(files, n.path);
    const sb = sourcesBase(repo, parseFixes(n.fixes), sha, index, cps);
    const b = sb.base ? stackedPicks(repo, sha, sb, { at: opts.at }) : sb;
    if (b.unknown) return { id, path: n.path, verdict: null, reasons: [b.unknown], base: null, skipped: [] };
    if (b.fail) return { id, path: n.path, verdict: "-", reasons: [...reasons, b.fail], base: null, skipped: [] };
    // 3 つ目の条件: 手順が壊れた地点より後の notice を名指さない
    const { steps } = noticeSections(n.text);
    const stepsOnly = steps.split("\n").filter((l) => !/^refs:/.test(l)).join("\n");
    for (const ref of new Set(stepsOnly.match(NOTICE_ID) ?? [])) {
      const r = index.get(ref);
      if (r?.add && ref !== id && !b.picks.includes(r.add) && !isAncestor(repo, r.add, b.base)) reasons.push(`手順が壊れた地点より後の notice ${ref} を名指す`);
    }
    if (reasons.length) return { id, path: n.path, verdict: "-", reasons, base: b.base, why: b.why, skipped: [] };
    const t = tryOnBase(repo, sha, b, { ...opts, noticePath: n.path });
    if (t.unknown) return { id, path: n.path, verdict: null, reasons: [t.unknown], base: b.base, why: b.why, skipped: [] };
    return { id, path: n.path, verdict: t.failed.length ? "-" : "clean", reasons: t.failed, base: b.base, why: b.why, skipped: t.skipped };
  });
}

/** 本体(テストからは repo と log を渡す)。exit code を返す */
export function run(repo, argv, log = console.log) {
  const commit = argv.find((a) => !a.startsWith("--"));
  const dryRun = argv.includes("--dry-run");
  const checks = argv.filter((a) => a.startsWith("--check=")).map((a) => a.slice(8));
  const at = argv.find((a) => a.startsWith("--at="))?.slice(5);
  if (!commit) {
    console.error("usage: pnpm notices:pick-check <commit> [--dry-run] [--at=<ref>] [--check=<cmd> ...]");
    return 2;
  }
  try {
    git(repo, ["rev-parse", "--verify", "-q", `${commit}^{commit}`]);
  } catch {
    log(`pick-check: ${commit} がない`);
    return 2;
  }
  let shipped;
  try {
    shipped = indexPath(repo, ownForkId(repo));
  } catch (e) {
    log(`pick-check: ${e.message}`);
    return 2;
  }
  const started = Date.now();
  const results = judge(repo, commit, { ...(checks.length ? { checks } : {}), ...(at ? { at } : {}) });
  if (!results.length) {
    log(`pick-check: ${commit} は fixes: の notice を足していない(判定するものなし)`);
    return 2;
  }
  let code = 0;
  for (const r of results) {
    const label = r.verdict ?? "未確認";
    log(`pick-check: ${r.id}: ${label}${r.why ? `(土台 = ${r.why})` : ""}`);
    for (const x of r.reasons) log(`  - ${x}`);
    for (const s of r.skipped) log(`  - 未実行: ${s}`);
    if (r.verdict === null) code = Math.max(code, 2);
    else if (r.verdict === "-") code = Math.max(code, 1);
    if (r.verdict && !dryRun) {
      const next = existsSync(shipped) ? writeRowPick(readFileSync(shipped, "utf8"), r.id, r.verdict) : null;
      if (next === null) {
        log(`  → 索引 ${SHIPPED_DIR} に ${r.id} の行が無い(先に node scripts/notices/shippedIndex.mjs add <notice> で行を足して commit する)`);
        code = 2;
        continue;
      }
      writeFileSync(shipped, next);
      log(`  → 索引の ${r.id} の行に pick:${r.verdict} を書いた`);
    }
  }
  log(`pick-check: ${((Date.now() - started) / 1000).toFixed(1)} 秒`);
  return code === 2 ? 2 : code;
}

function main(argv) {
  return run(join(dirname(fileURLToPath(import.meta.url)), "../.."), argv);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exit(main(process.argv.slice(2)));
