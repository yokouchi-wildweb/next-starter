// scripts/notices/hotfixCheck.mjs
// 緊急修正(hotfix)が、遅れた fork の木で前提にしているものを持っているかを、出荷の前に確かめる(/ship hotfix)。
// fork は間の変更を飛ばしてこの commit だけを cherry-pick するので、間で届くはずのパス・スクリプトに頼ると、
// fork の検査(例: test:core-rules の paths:)や notice の手順がその木では通らない。
//
// 実行: pnpm notices:hotfix-check <commit> [--base=<sha> ...] [--fleet-conf=<path>]
//   commit / base は呼んだリポで完全な sha に解決してから使う(HEAD・HEAD~1 等の相対 ref も可)
//   base = 遅れた fork の位置(上流の commit)。省くと fleet.conf の各 fork の merge-base(上流からは fork の位置が見えないため)
//     + その fork の台帳 .notices/applied/<name>.md(fork の HEAD の版)の picked:(先に取った修正)のうち merge-base の祖先でないもの
//   各 base の上に picks を順に載せ、その上に commit を cherry-pick した木(一時の複製、作業ツリーには触れない)で見るもの:
//     1. commit が足した・変えたパス指定ルール(.claude/rules/**/*.md)の paths: の各 glob が、その木のファイルに当たるか
//     2. commit の notice の required_actions / verify / manual_steps にある `pnpm <script>` が、その木の package.json にあるか
//     3. その notice が名指すリポのパス(`…` と refs:)が、その木にあるか
//   exit 0 = 見つからない | 1 = 見つかった(一覧) | 2 = 確かめられない(base が無い・commit が無い)
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parsePaths, unmatchedPaths } from "../claude-rules/rulePaths.mjs";
import { pickDroppingIndex } from "./pickDroppingIndex.mjs";

// pnpm の組み込みコマンド(package.json の scripts ではない)
const PNPM_BUILTIN = new Set(["install", "i", "add", "remove", "rm", "up", "update", "exec", "dlx", "run", "why", "list", "ls", "store", "env"]);
const PATH_ROOTS = /^(src|scripts|docs|servers|public|\.claude|\.notices|\.fork-ownership)\//;

/** notice の欄のうち、fork が手順として実行するもの(required_actions から refs: の前まで)と refs: の値 */
export function noticeSections(text) {
  const lines = text.split("\n");
  const at = (k) => lines.findIndex((l) => l.startsWith(`${k}:`));
  const from = at("required_actions");
  const to = at("refs");
  const steps = from < 0 ? "" : lines.slice(from, to < 0 ? undefined : to).join("\n");
  const refs = to < 0 ? "" : lines[to].slice("refs:".length);
  return { steps, refs };
}

/** `pnpm <script>` の script 名(組み込みは除く。`pnpm run x` は x) */
export function pnpmScripts(text) {
  const out = new Set();
  for (const m of text.matchAll(/\bpnpm\s+(?:-s\s+|--silent\s+)?(run\s+)?([a-z][\w:.-]*)/g)) {
    if (!m[1] && PNPM_BUILTIN.has(m[2])) continue;
    out.add(m[2]);
  }
  return [...out];
}

/** notice が名指すリポのパス: `…` の中と refs: の ` | ` 区切り。glob・<…>・空白を含むものは除く */
export function noticePaths(steps, refs) {
  const tokens = [...steps.matchAll(/`([^`\s]+)`/g)].map((m) => m[1]);
  tokens.push(...refs.split("|").map((s) => s.trim().split(/\s+/)[0]));
  return [...new Set(tokens.map((t) => t.replace(/[.,:;)]+$/, "")).filter((t) => PATH_ROOTS.test(t) && !/[*?<>{}[\]]/.test(t)))];
}

/** 1 つの木で見つかった依存: { rules: [{file, globs}], scripts: [], paths: [] } */
export function findGaps({ files, packageJson, rules, notice }) {
  const gaps = { rules: [], scripts: [], paths: [] };
  for (const { file, text } of rules) {
    const globs = parsePaths(text);
    if (!globs) continue;
    const miss = unmatchedPaths(globs, files);
    if (miss.length) gaps.rules.push({ file, globs: miss });
  }
  if (notice) {
    const { steps, refs } = noticeSections(notice);
    const scripts = packageJson?.scripts ?? {};
    gaps.scripts = pnpmScripts(steps).filter((s) => !(s in scripts));
    gaps.paths = noticePaths(steps, refs).filter((p) => !files.some((f) => f === p || f.startsWith(p.replace(/\/$/, "") + "/")));
  }
  return gaps;
}

export function hasGaps(g) {
  return g.rules.length + g.scripts.length + g.paths.length > 0;
}

/** 台帳(.notices/applied/<fork_id>.md)の picked: の sha を行の順に(重複は 1 回) */
export function ledgerPicks(text) {
  const out = [];
  for (const m of (text ?? "").matchAll(/^- id:.*\|\s*picked:([0-9a-f]{7,40})\b/gm)) if (!out.includes(m[1])) out.push(m[1]);
  return out;
}

/** fork の HEAD の台帳から、base の祖先でない picked:(先に取った修正。台帳が無い・読めない = 空) */
export function forkPicks(path, name, base) {
  let text;
  try {
    text = execFileSync("git", ["-C", path, "show", `HEAD:.notices/applied/${name}.md`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return [];
  }
  return ledgerPicks(text).filter((sha) => {
    try {
      execFileSync("git", ["-C", path, "merge-base", "--is-ancestor", sha, base], { stdio: "ignore" });
      return false;
    } catch {
      return true;
    }
  });
}

/** fleet.conf の各 fork の位置(`git merge-base HEAD upstream/<main|master>`)と台帳の picks。読めない fork は理由つき */
export function fleetBases(confPath) {
  if (!existsSync(confPath)) return { bases: [], skipped: [`${confPath} がない`] };
  const bases = [];
  const skipped = [];
  for (const line of readFileSync(confPath, "utf8").split("\n")) {
    const [name, raw] = line.trim().split(/\s+/);
    if (!name || name.startsWith("#") || !raw) continue;
    const path = raw.replace(/^~(?=\/)/, homedir());
    const ref = ["upstream/main", "upstream/master"].find((r) => {
      try {
        execFileSync("git", ["-C", path, "rev-parse", "--verify", "-q", r], { stdio: "ignore" });
        return true;
      } catch {
        return false;
      }
    });
    if (!ref) {
      skipped.push(`${name}: upstream の参照が無い(${path})`);
      continue;
    }
    const sha = execFileSync("git", ["-C", path, "merge-base", "HEAD", ref], { encoding: "utf8" }).trim();
    bases.push({ name, sha, picks: forkPicks(path, name, sha) });
  }
  return { bases, skipped };
}

function git(cwd, args, opts = {}) {
  return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts });
}

/** ref を repo で完全な sha に(一時の複製の中で解決すると HEAD 等が土台を指すため)。無ければ null */
export function resolveCommit(repo, ref) {
  try {
    return git(repo, ["rev-parse", "--verify", "-q", `${ref}^{commit}`]).trim();
  } catch {
    return null;
  }
}

/** base の上に picks(先に取った修正)を載せ、その上に commit を pick した木を一時の複製で作って調べる。
 *  載らない pick は { pickFailed: sha } */
export function checkOnBase(repo, commit, base, picks = []) {
  const sha = resolveCommit(repo, commit);
  const at = resolveCommit(repo, base);
  if (!sha || !at) throw new Error(`hotfix-check: ${sha ? base : commit} がこのリポに無い`);
  commit = sha;
  const dir = mkdtempSync(join(tmpdir(), "hotfix-check-"));
  try {
    execFileSync("git", ["clone", "-q", "--shared", "--no-checkout", repo, dir], { stdio: "ignore" });
    git(dir, ["switch", "-q", "--detach", at]);
    // 出荷索引の変更は捨てて載せる(fork の /flux も索引だけの衝突は fork 側を採る。pickDroppingIndex.mjs)
    for (const p of picks) {
      try {
        if (pickDroppingIndex(dir, p).conflicts.length) throw new Error("conflict");
        git(dir, ["-c", "user.name=hotfix-check", "-c", "user.email=hotfix-check@local", "commit", "-q", "--no-verify", "--allow-empty", "-m", `pick ${p}`]);
      } catch {
        return { pickFailed: p };
      }
    }
    const changed = git(repo, ["-c", "core.quotePath=false", "show", "--name-only", "--diff-filter=AMR", "--format=", commit]).split("\n").filter(Boolean);
    let conflict = false;
    let picked;
    try {
      picked = pickDroppingIndex(dir, commit);
    } catch {
      picked = { conflicts: ["?"] };
    }
    if (picked.conflicts.length) {
      // a conflict the fork solves by hand: look at the tree with the commit's side of every file it touches
      conflict = true;
      git(dir, ["reset", "-q", "--hard"]);
      git(dir, ["checkout", commit, "--", ...changed]);
    }
    const files = git(dir, ["-c", "core.quotePath=false", "ls-files"]).split("\n").filter(Boolean);
    const read = (f) => readFileSync(join(dir, f), "utf8");
    const rules = changed.filter((f) => /^\.claude\/rules\/.+\.md$/.test(f)).map((file) => ({ file, text: read(file) }));
    const nf = changed.find((f) => /^\.notices\/[^/]+\.md$/.test(f));
    const pj = files.includes("package.json") ? JSON.parse(read("package.json")) : null;
    return { conflict, gaps: findGaps({ files, packageJson: pj, rules, notice: nf ? read(nf) : "" }) };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** 本体(テストからは repo と log を渡す)。exit code を返す */
export function run(repo, argv, log = console.log) {
  const commitRef = argv.find((a) => !a.startsWith("--"));
  const given = argv.filter((a) => a.startsWith("--base=")).map((a, i) => ({ name: `base${i + 1}`, sha: a.slice(7), picks: [] }));
  const conf = argv.find((a) => a.startsWith("--fleet-conf="))?.slice(13) ?? join(process.env.TEAM_BASE || join(homedir(), ".team"), "fleet.conf");
  if (!commitRef) {
    console.error("usage: pnpm notices:hotfix-check <commit> [--base=<sha> ...] [--fleet-conf=<path>]");
    return 2;
  }
  const commit = resolveCommit(repo, commitRef);
  if (!commit) {
    log(`hotfix-check: ${commitRef} がない`);
    return 2;
  }
  const { bases, skipped } = given.length ? { bases: given, skipped: [] } : fleetBases(conf);
  for (const s of skipped) log(`hotfix-check: 未確認 — ${s}`);
  // 位置(相対 ref は呼んだリポで sha に)と picks が同じ fork はまとめて 1 回。上流が知らない位置・pick は確かめられない
  let unknown = false;
  const groups = new Map();
  for (const b of bases) {
    const sha = resolveCommit(repo, b.sha);
    if (!sha) {
      log(`hotfix-check: 未確認 — ${b.name}(${b.sha}): この位置がこのリポに無い`);
      unknown = true;
      continue;
    }
    const picks = b.picks.map((p) => resolveCommit(repo, p) ?? p);
    const key = [sha, ...picks].join(" ");
    const g = groups.get(key) ?? { sha, picks, names: [] };
    g.names.push(b.name);
    groups.set(key, g);
  }
  if (!groups.size) {
    if (!unknown) log("hotfix-check: 未確認 — 遅れた fork の位置が分からない(--base= か fleet.conf)");
    return 2;
  }
  let found = false;
  for (const { sha, picks, names } of groups.values()) {
    const who = `${names.join(", ")}(${sha.slice(0, 8)}${picks.length ? ` +picked ${picks.length}` : ""})`;
    if (picks.includes(commit)) {
      log(`hotfix-check: ${who}: この commit は先に取り済み`);
      continue;
    }
    const missing = picks.filter((p) => !resolveCommit(repo, p));
    if (missing.length) {
      log(`hotfix-check: 未確認 — ${who}: 先に取った修正 ${missing.map((p) => p.slice(0, 8)).join(", ")} がこのリポに無い`);
      unknown = true;
      continue;
    }
    const r = checkOnBase(repo, commit, sha, picks);
    if (r.pickFailed) {
      log(`hotfix-check: 未確認 — ${who}: 先に取った修正 ${r.pickFailed.slice(0, 8)} がこの位置に載らない(fork が手で衝突を解いた pick)`);
      unknown = true;
      continue;
    }
    if (r.conflict) log(`hotfix-check: ${who}: cherry-pick が衝突する(fork 側で手で解く。以下は commit 側を採った木で見た結果)`);
    if (!hasGaps(r.gaps)) {
      if (!r.conflict) log(`hotfix-check: ${who}: 依存なし`);
      found ||= r.conflict;
      continue;
    }
    found = true;
    log(`hotfix-check: ${who}: 間の変更で届くものに頼っている`);
    for (const { file, globs } of r.gaps.rules) log(`  - ${file} の paths: がその木のどのファイルにも当たらない: ${globs.join(", ")}`);
    for (const s of r.gaps.scripts) log(`  - notice の手順の pnpm ${s} がその木の package.json に無い`);
    for (const p of r.gaps.paths) log(`  - notice が名指す ${p} がその木に無い`);
  }
  return found ? 1 : unknown ? 2 : 0;
}

function main(argv) {
  return run(join(dirname(fileURLToPath(import.meta.url)), "../.."), argv);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exit(main(process.argv.slice(2)));
