// scripts/notices/hotfixCheck.mjs
// 緊急修正(hotfix)が、遅れた fork の木で前提にしているものを持っているかを、出荷の前に確かめる(/ship hotfix)。
// fork は間の変更を飛ばしてこの commit だけを cherry-pick するので、間で届くはずのパス・スクリプトに頼ると、
// fork の検査(例: test:core-rules の paths:)や notice の手順がその木では通らない。
//
// 実行: pnpm notices:hotfix-check <commit> [--base=<sha> ...] [--fleet-conf=<path>]
//   base = 遅れた fork の位置(上流の commit)。省くと fleet.conf の各 fork の merge-base(上流からは fork の位置が見えないため)
//   各 base の上に commit を cherry-pick した木(一時の複製、作業ツリーには触れない)で見るもの:
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

/** fleet.conf の各 fork の位置(`git merge-base HEAD upstream/<main|master>`)。読めない fork は理由つき */
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
    bases.push({ name, sha: execFileSync("git", ["-C", path, "merge-base", "HEAD", ref], { encoding: "utf8" }).trim() });
  }
  return { bases, skipped };
}

function git(cwd, args, opts = {}) {
  return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts });
}

/** base の上に commit を pick した木を一時の複製で作って調べる */
export function checkOnBase(repo, commit, base) {
  const dir = mkdtempSync(join(tmpdir(), "hotfix-check-"));
  try {
    execFileSync("git", ["clone", "-q", "--shared", "--no-checkout", repo, dir], { stdio: "ignore" });
    git(dir, ["switch", "-q", "--detach", base]);
    const changed = git(repo, ["-c", "core.quotePath=false", "show", "--name-only", "--diff-filter=AMR", "--format=", commit]).split("\n").filter(Boolean);
    let conflict = false;
    try {
      git(dir, ["cherry-pick", "-n", commit]);
    } catch {
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

function main(argv) {
  const repo = join(dirname(fileURLToPath(import.meta.url)), "../..");
  const commit = argv.find((a) => !a.startsWith("--"));
  const given = argv.filter((a) => a.startsWith("--base=")).map((a, i) => ({ name: `base${i + 1}`, sha: a.slice(7) }));
  const conf = argv.find((a) => a.startsWith("--fleet-conf="))?.slice(13) ?? join(process.env.TEAM_BASE || join(homedir(), ".team"), "fleet.conf");
  if (!commit) {
    console.error("usage: pnpm notices:hotfix-check <commit> [--base=<sha> ...] [--fleet-conf=<path>]");
    return 2;
  }
  try {
    git(repo, ["rev-parse", "--verify", "-q", `${commit}^{commit}`]);
  } catch {
    console.log(`hotfix-check: ${commit} がない`);
    return 2;
  }
  const { bases, skipped } = given.length ? { bases: given, skipped: [] } : fleetBases(conf);
  for (const s of skipped) console.log(`hotfix-check: 未確認 — ${s}`);
  // 同じ位置の fork はまとめて 1 回。上流が知らない位置は確かめられない
  const byBase = new Map();
  for (const b of bases) byBase.set(b.sha, [...(byBase.get(b.sha) ?? []), b.name]);
  if (!byBase.size) {
    console.log("hotfix-check: 未確認 — 遅れた fork の位置が分からない(--base= か fleet.conf)");
    return 2;
  }
  let found = false;
  let unknown = false;
  for (const [sha, names] of byBase) {
    const who = `${names.join(", ")}(${sha.slice(0, 8)})`;
    try {
      git(repo, ["rev-parse", "--verify", "-q", `${sha}^{commit}`]);
    } catch {
      console.log(`hotfix-check: 未確認 — ${who}: この位置がこのリポに無い`);
      unknown = true;
      continue;
    }
    const r = checkOnBase(repo, commit, sha);
    if (r.conflict) console.log(`hotfix-check: ${who}: cherry-pick が衝突する(fork 側で手で解く。以下は commit 側を採った木で見た結果)`);
    if (!hasGaps(r.gaps)) {
      if (!r.conflict) console.log(`hotfix-check: ${who}: 依存なし`);
      found ||= r.conflict;
      continue;
    }
    found = true;
    console.log(`hotfix-check: ${who}: 間の変更で届くものに頼っている`);
    for (const { file, globs } of r.gaps.rules) console.log(`  - ${file} の paths: がその木のどのファイルにも当たらない: ${globs.join(", ")}`);
    for (const s of r.gaps.scripts) console.log(`  - notice の手順の pnpm ${s} がその木の package.json に無い`);
    for (const p of r.gaps.paths) console.log(`  - notice が名指す ${p} がその木に無い`);
  }
  return found ? 1 : unknown ? 2 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exit(main(process.argv.slice(2)));
