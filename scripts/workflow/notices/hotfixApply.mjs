// scripts/workflow/notices/hotfixApply.mjs
// 緊急修正(hotfix:)の先取りを fork で行う(/flux の HOTFIX、.notices/README.md「緊急修正(hotfix)」)。
// 上流が hotfix: を宣言した notice の commit を cherry-pick し、ぶつかったファイルを次の順に決める。人には聞かない:
//   1. 出荷索引 .notices/shipped/ → fork 側(fork に無ければ消す)。索引は後の merge で届く
//   2. 道具が上流の先端を読むファイル(TIP_READ: .claude/skills/flux/ の下)→ 先取りから外す(fork の版のまま)。
//      /flux も鉄道もその手順と incoming.mjs を上流の先端の版で読むので、fork に先に入れる物ではない(ぶつからなくても外す)
//   3. fork が merge-base から一度も変えていない上流のファイル(git diff --quiet <merge-base> HEAD -- <path>)→ 元の commit の
//      時点の上流の版にファイルごと置き換える。間の上流の変更も一緒に入るが、上流の物なので所有の検査は「pick の時点の
//      上流の版と同じ中身」で通す(src/lib/forkOwnership/check.mjs の picked)。後の区間の merge ではそのファイルは上流の側
//   4. それ以外(fork が変えたファイルのぶつかり)→ 先取りを取り消して枝を元に戻し、exit 1 とそのファイルの一覧(今どおり止まる)
// 通れば 1 commit(元の題 + `(cherry picked from commit <sha>)`)を作り、台帳の notes に写す形で決めた事を出す。台帳の行と
// 区間の検査は /flux の手順のまま(この道具は書かない)。
//
// 実行: pnpm workflow notices hotfixApply <元の commit> [--upstream=<ref>]
//   --upstream = 直接の親の ref(既定 upstream/main。merge-base を取る)。作業ツリーは綺麗であること
// 出力(1 行ずつ): picked <新しい sha> / replaced <path> / left-out <path> / index <path> / notes <台帳の notes に写す文>
//   止まった時: conflict <path>(fork が変えたファイル)
//   exit 0 = 取れた | 1 = fork が変えたファイルでぶつかった(何も残さない) | 2 = 使い方・作業ツリー・commit の誤り
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** 道具が上流の先端の版を読むファイルの置き場(緊急修正の先取りの対象にしない) */
export const TIP_READ = [".claude/skills/flux/"];
const INDEX_DIR = ".notices/shipped/";

function git(cwd, args) {
  return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 });
}
function tryGit(cwd, args) {
  const r = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return { ok: r.status === 0, out: r.stdout ?? "", err: r.stderr ?? "" };
}
const lines = (text) => text.split("\n").filter(Boolean);
const isTipRead = (path) => TIP_READ.some((dir) => path.startsWith(dir));
const existsAt = (repo, rev, path) => tryGit(repo, ["cat-file", "-e", `${rev}:${path}`]).ok;

/** HEAD の版に戻す(HEAD に無ければ索引と作業ツリーから消す) */
function keepFork(repo, path) {
  if (existsAt(repo, "HEAD", path)) git(repo, ["checkout", "HEAD", "--", path]);
  else {
    tryGit(repo, ["rm", "-q", "--cached", "--ignore-unmatch", "--", path]);
    rmSync(join(repo, path), { force: true });
  }
}
/** 元の commit の時点の上流の版にする(その時点で無ければ消す) */
function takeUpstream(repo, sha, path) {
  if (existsAt(repo, sha, path)) git(repo, ["checkout", sha, "--", path]);
  else {
    tryGit(repo, ["rm", "-q", "--cached", "--ignore-unmatch", "--", path]);
    rmSync(join(repo, path), { force: true });
  }
}
function undo(repo) {
  if (tryGit(repo, ["rev-parse", "-q", "--verify", "CHERRY_PICK_HEAD"]).ok) tryGit(repo, ["cherry-pick", "--abort"]);
  else tryGit(repo, ["reset", "-q", "--merge"]);
}

/**
 * @param {string} repo  fork の作業ツリー
 * @param {string} sha   元の commit
 * @param {string} upstream 直接の親の ref
 * @returns {{ status: "picked" | "conflict" | "error", picked?: string, replaced: string[], leftOut: string[], index: string[], conflicts: string[], message?: string }}
 */
export function hotfixApply(repo, sha, upstream = "upstream/main") {
  const result = { status: "error", replaced: [], leftOut: [], index: [], conflicts: [] };
  const full = tryGit(repo, ["rev-parse", "--verify", `${sha}^{commit}`]);
  if (!full.ok) return { ...result, message: `commit がありません: ${sha}` };
  const orig = full.out.trim();
  if (lines(git(repo, ["status", "--porcelain", "--untracked-files=no"])).length > 0) return { ...result, message: "作業ツリーに未コミットの変更があります" };
  const mb = tryGit(repo, ["merge-base", "HEAD", upstream]);
  if (!mb.ok) return { ...result, message: `merge-base を取れません(${upstream})` };
  const base = mb.out.trim();
  const changed = lines(git(repo, ["diff-tree", "--no-commit-id", "--name-only", "-r", orig]));
  tryGit(repo, ["-c", "merge.conflictStyle=merge", "cherry-pick", "--no-commit", orig]);
  const unmerged = new Set(lines(git(repo, ["diff", "--name-only", "--diff-filter=U"])));
  // 2. 先端を読むファイルは、ぶつかっても・ぶつからなくても外す
  for (const path of changed.filter(isTipRead)) {
    keepFork(repo, path);
    unmerged.delete(path);
    result.leftOut.push(path);
  }
  for (const path of [...unmerged]) {
    if (path.startsWith(INDEX_DIR)) {
      keepFork(repo, path);
      result.index.push(path);
    } else if (existsAt(repo, base, path) && tryGit(repo, ["diff", "--quiet", base, "HEAD", "--", path]).ok) {
      takeUpstream(repo, orig, path);
      result.replaced.push(path);
    } else result.conflicts.push(path);
  }
  if (result.conflicts.length > 0) {
    undo(repo);
    return { ...result, status: "conflict" };
  }
  const subject = git(repo, ["log", "-1", "--format=%B", orig]).trimEnd();
  const msg = `${subject}\n\n(cherry picked from commit ${orig})`;
  const c = tryGit(repo, ["-c", "core.editor=true", "commit", "-q", "--allow-empty", "--no-verify", "-m", msg]);
  if (!c.ok) {
    undo(repo);
    return { ...result, message: `commit できません: ${c.err.trim()}` };
  }
  tryGit(repo, ["cherry-pick", "--quit"]);
  return { ...result, status: "picked", picked: git(repo, ["rev-parse", "HEAD"]).trim() };
}

/** 台帳の notes に写す文 */
export function ledgerNotes(r) {
  const parts = ["hotfix pick"];
  if (r.replaced.length) parts.push(`replaced: ${r.replaced.join(",")}`);
  if (r.leftOut.length) parts.push(`left-out: ${r.leftOut.join(",")}`);
  return parts.join("; ");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const sha = args.find((a) => !a.startsWith("--"));
  const upstream = (args.find((a) => a.startsWith("--upstream=")) ?? "--upstream=upstream/main").slice("--upstream=".length);
  if (!sha) {
    console.error("使い方: pnpm workflow notices hotfixApply <元の commit> [--upstream=<ref>]");
    process.exit(2);
  }
  const repo = git(process.cwd(), ["rev-parse", "--show-toplevel"]).trim();
  if (!existsSync(repo)) process.exit(2);
  const r = hotfixApply(repo, sha, upstream);
  for (const p of r.replaced) console.log(`replaced\t${p}`);
  for (const p of r.leftOut) console.log(`left-out\t${p}`);
  for (const p of r.index) console.log(`index\t${p}`);
  if (r.status === "picked") {
    console.log(`picked\t${r.picked}`);
    console.log(`notes\t${ledgerNotes(r)}`);
    process.exit(0);
  }
  if (r.status === "conflict") {
    for (const p of r.conflicts) console.log(`conflict\t${p}`);
    console.error("hotfixApply: fork が変えたファイルでぶつかりました。先取りは取り消し、枝は元のままです(/flux の 3 つの選択へ)");
    process.exit(1);
  }
  console.error(`hotfixApply: ${r.message}`);
  process.exit(2);
}
