// scripts/workflow/notices/hotfixApply.mjs
// 緊急修正(hotfix:)の先取りを fork で行う(/flux の HOTFIX、.notices/README.md「緊急修正(hotfix)」)。
// どの fork でも止まらずに当たること(当たらない部分は飛ばして記録し、後の区間で届く)。止まるのは fork が手で変えたファイルの
// ぶつかりだけ。/flux・鉄道・艦隊はいつも上流の先端の版のこの道具で当てる(fork の木の版は使わない)。
// 元の commit が変えたファイルごとに決める(cherry-pick には頼らない)。人には聞かない:
//   - 道具が上流の先端を読むファイル(TIP_READ: .claude/skills/flux/ の下)→ 外す(left-out)。/flux も鉄道もその手順と
//     incoming.mjs を上流の先端の版で読むので、fork に先に入れる物ではない
//   - 出荷索引 .notices/shipped/(索引を外す前の commit だけが持つ)→ fork 側のまま(index)
//     sunset: 20261120-122554-notice-history(全部の fork が取り込んだら外す)
//   - (c) fork の木に有り、中身が上流のどれかの版(merge-base・元の commit の親・台帳の前の picked: の commit)と同じ
//     = fork が触っていない → 元の commit の版に置き換える(消す変更なら消す)(replaced)
//     fork が手で変えた → git merge-file で 3 方向(基 = 元の commit の親の版)。通れば採る(merged)、ぶつかれば全部取り消して止まる
//   - 足すファイルが fork に無い → 足す(added)
//   - 直す相手が fork の木に無い → 飛ばす(left-out)。後の区間で届く。上流で merge-base から元の commit の親までに名前が
//     変わった行(git diff -M の R の行で、そのパスを前か今に持つ物の全部)を候補として出す(rename-candidate)。道具は選ばず
//     書かない: 前の場所に手で当てるか区間で届くのを待つかは /flux のエージェントが決める(D476)
// 当てた後に fork の木で 4 つの確かめ(lib.hotfixGaps.mjs: 足した・変えたルールの paths: の当たり・notice の手順の pnpm の命令・
// 名指したパス・当てた・足したコードの相対 import 先と、そこから名前で取る物の export)を回し、足りない物を gap の行で出す(止めない)。
// 通れば 1 commit(元の題 + `(cherry picked from commit <sha>)`)。台帳の行と区間の検査は /flux の手順のまま(この道具は書かない)。
//
// 実行: node <上流の先端から出した>/scripts/workflow/notices/hotfixApply.mjs <元の commit> [--upstream=<ref>](fork の checkout で)
//   --upstream = 直接の親の ref(既定 upstream/main。merge-base を取る)。作業ツリーは綺麗であること
// 出力(1 行ずつ、タブ区切り): picked <新しい sha> / replaced <path> / merged <path> / added <path> /
//   left-out <path> / rename-candidate <path> <R の行> / index <path> / gap <rules|scripts|paths|imports> <物> / notes <台帳の notes に写す文>
//   (台帳の notes の語 moved-merged は D476 から出ない。読み手の数えは 0 のまま)
//   止まった時: conflict <path>(fork が手で変えたファイル)
//   exit 0 = 取れた | 1 = fork が手で変えたファイルでぶつかった(何も残さない) | 2 = 使い方・作業ツリー・commit の誤り
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { findGaps, importGaps } from "./lib.hotfixGaps.mjs";

/** 道具が上流の先端の版を読むファイルの置き場(緊急修正の先取りの対象にしない) */
export const TIP_READ = [".claude/skills/flux/"];
// sunset: 20261120-122554-notice-history (the index branch: remove once every fork has taken that notice)
const INDEX_DIR = ".notices/shipped/";

function git(cwd, args, input) {
  return execFileSync("git", ["-C", cwd, "-c", "core.quotePath=false", ...args], { encoding: "utf8", input, stdio: ["pipe", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 });
}
function tryGit(cwd, args) {
  const r = spawnSync("git", ["-C", cwd, "-c", "core.quotePath=false", ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return { ok: r.status === 0, out: r.stdout ?? "", err: r.stderr ?? "" };
}
const lines = (text) => text.split("\n").filter(Boolean);
const isTipRead = (path) => TIP_READ.some((dir) => path.startsWith(dir));
/** <rev>:<path> の blob の id(無ければ null) */
const blobAt = (repo, rev, path) => {
  const r = tryGit(repo, ["rev-parse", "-q", "--verify", `${rev}:${path}`]);
  return r.ok ? r.out.trim() : null;
};
const showAt = (repo, rev, path) => git(repo, ["show", `${rev}:${path}`]);

/** 台帳(.notices/applied/*.md の HEAD の版)の picked: の sha(この木にある commit だけ) */
export function ledgerPickedShas(repo) {
  const out = [];
  for (const f of lines(tryGit(repo, ["ls-tree", "--name-only", "HEAD", ".notices/applied/"]).out)) {
    const text = tryGit(repo, ["show", `HEAD:${f}`]).out;
    for (const m of text.matchAll(/^- id:.*\|\s*picked:([0-9a-f]{7,40})\b/gm)) {
      const c = tryGit(repo, ["rev-parse", "-q", "--verify", `${m[1]}^{commit}`]);
      if (c.ok && !out.includes(c.out.trim())) out.push(c.out.trim());
    }
  }
  return out;
}

/** 台帳(.notices/applied/*.md の HEAD の版)で picked: の付いた行の notice id(先取りした緊急修正・先に取った修正) */
export function ledgerPickedIds(repo) {
  const out = [];
  for (const f of lines(tryGit(repo, ["ls-tree", "--name-only", "HEAD", ".notices/applied/"]).out)) {
    const text = tryGit(repo, ["show", `HEAD:${f}`]).out;
    for (const m of text.matchAll(/^- id:(\S+?)\s*\|.*\|\s*picked:[0-9a-f]{7,40}\b/gm)) {
      if (!out.includes(m[1])) out.push(m[1]);
    }
  }
  return out;
}

/** 3 方向: ours に base → theirs の差分を当てる。{ ok, text } */
export function mergeText(ours, base, theirs) {
  const dir = mkdtempSync(join(tmpdir(), "hotfix-apply-"));
  try {
    const [o, b, t] = ["ours", "base", "theirs"].map((n) => join(dir, n));
    writeFileSync(o, ours);
    writeFileSync(b, base);
    writeFileSync(t, theirs);
    const r = spawnSync("git", ["merge-file", "-p", o, b, t], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    return r.status === 0 ? { ok: true, text: r.stdout } : { ok: false };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** 上流で base から to までに名前が変わった行のうち、paths のどれかを前か今に持つ物: [{ path, line, from, to, score }](選ばない) */
export function renameCandidates(repo, base, to, paths) {
  if (!paths.length) return [];
  const rows = lines(tryGit(repo, ["diff", "-M", "--name-status", "--diff-filter=R", base, to]).out).map((line) => {
    const [st, from, dest] = line.split("\t");
    return { line, from, to: dest, score: st };
  });
  return paths.flatMap((path) => rows.filter((r) => r.from === path || r.to === path).map((r) => ({ path, ...r })));
}

/**
 * 決める(作業ツリーには書かない)。actions = [{ kind, path, from?, text? }]
 * kind: replace(元の commit の版)/ delete / write(text)/ keep
 */
export function plan(repo, orig, base) {
  const parent = `${orig}^`;
  const versions = (path) => new Set([base, parent, ...ledgerPickedShas(repo)].map((rev) => blobAt(repo, rev, path)).filter(Boolean));
  const r = { replaced: [], merged: [], added: [], leftOut: [], renameCandidates: [], index: [], conflicts: [], actions: [] };
  for (const l of lines(git(repo, ["diff-tree", "--no-commit-id", "-r", "--no-renames", "--name-status", orig]))) {
    const [st, path] = l.split("\t");
    const status = st[0];
    if (isTipRead(path)) {
      r.leftOut.push(path);
      continue;
    }
    if (path.startsWith(INDEX_DIR)) {
      r.index.push(path);
      continue;
    }
    const head = blobAt(repo, "HEAD", path);
    const want = status === "D" ? null : blobAt(repo, orig, path);
    if (head) {
      if (head === want) continue; // 既に同じ
      if (versions(path).has(head)) {
        r.actions.push({ kind: status === "D" ? "delete" : "replace", path });
        r.replaced.push(path);
        continue;
      }
      // fork が手で変えた: 3 方向(消す変更・基の無い足しは 3 方向にならないので止まる)
      const baseText = blobAt(repo, parent, path) ? showAt(repo, parent, path) : null;
      const m = status !== "D" && baseText !== null ? mergeText(showAt(repo, "HEAD", path), baseText, showAt(repo, orig, path)) : { ok: false };
      if (m.ok) {
        r.actions.push({ kind: "write", path, text: m.text });
        r.merged.push(path);
      } else r.conflicts.push(path);
      continue;
    }
    if (status === "D") continue; // 消す相手が無い
    if (status === "A") {
      r.actions.push({ kind: "replace", path });
      r.added.push(path);
      continue;
    }
    // 直す相手が無い: 飛ばす(名前の変わった候補は下で並べるだけ)
    r.leftOut.push(path);
  }
  r.renameCandidates = renameCandidates(repo, base, parent, r.leftOut.filter((x) => !isTipRead(x)));
  return r;
}

/** 当てた後の fork の木(作業ツリー + index)で 4 つの確かめ。[{ kind, item }]。applied = 当てた・足したファイル(無ければ元の commit が変えた物で木にある物) */
export function treeGaps(repo, orig, applied) {
  const files = lines(git(repo, ["ls-files"]));
  const changed = lines(git(repo, ["diff-tree", "--no-commit-id", "-r", "--name-only", "--diff-filter=AMR", orig]));
  const read = (f) => (existsSync(join(repo, f)) ? readFileSync(join(repo, f), "utf8") : null);
  const rules = changed.filter((f) => /^\.claude\/rules\/.+\.md$/.test(f) && files.includes(f)).map((file) => ({ file, text: read(file) }));
  const nf = changed.find((f) => /^\.notices\/[^/]+\.md$/.test(f));
  const notice = nf ? (read(nf) ?? showAt(repo, orig, nf)) : "";
  const pjText = read("package.json");
  const g = findGaps({ files, packageJson: pjText ? JSON.parse(pjText) : null, rules, notice });
  const imports = importGaps({ files, changed: applied ?? changed.filter((f) => files.includes(f)), read }).map((x) =>
    x.all ? { kind: "imports", item: `${x.file}: 先取りしても動かない(import 先が fork に無い: ${x.targets.join(", ")})` } : { kind: "imports", item: `${x.file} -> ${x.target}` },
  );
  return [...g.rules.map((x) => ({ kind: "rules", item: `${x.file}: ${x.globs.join(", ")}` })), ...g.scripts.map((s) => ({ kind: "scripts", item: s })), ...g.paths.map((p) => ({ kind: "paths", item: p })), ...imports];
}

/**
 * @param {string} repo  fork の作業ツリー
 * @param {string} sha   元の commit
 * @param {string} upstream 直接の親の ref
 */
export function hotfixApply(repo, sha, upstream = "upstream/main") {
  const empty = { status: "error", replaced: [], merged: [], added: [], leftOut: [], renameCandidates: [], index: [], conflicts: [], gaps: [] };
  const full = tryGit(repo, ["rev-parse", "--verify", `${sha}^{commit}`]);
  if (!full.ok) return { ...empty, message: `commit がありません: ${sha}` };
  const orig = full.out.trim();
  if (lines(git(repo, ["status", "--porcelain", "--untracked-files=no"])).length > 0) return { ...empty, message: "作業ツリーに未コミットの変更があります" };
  const mb = tryGit(repo, ["merge-base", "HEAD", upstream]);
  if (!mb.ok) return { ...empty, message: `merge-base を取れません(${upstream})` };
  const p = plan(repo, orig, mb.out.trim());
  const result = { ...empty, ...p };
  delete result.actions;
  if (p.conflicts.length > 0) return { ...result, status: "conflict" };
  for (const a of p.actions) {
    if (a.kind === "replace") git(repo, ["checkout", orig, "--", a.path]);
    else if (a.kind === "delete") git(repo, ["rm", "-q", "--", a.path]);
    else {
      writeFileSync(join(repo, a.path), a.text);
      git(repo, ["add", "--", a.path]);
    }
  }
  result.gaps = treeGaps(repo, orig, [...p.replaced, ...p.merged, ...p.added]);
  const subject = git(repo, ["log", "-1", "--format=%B", orig]).trimEnd();
  const c = tryGit(repo, ["commit", "-q", "--allow-empty", "--no-verify", "-m", `${subject}\n\n(cherry picked from commit ${orig})`]);
  if (!c.ok) {
    tryGit(repo, ["reset", "-q", "--merge"]);
    return { ...result, status: "error", message: `commit できません: ${c.err.trim()}` };
  }
  return { ...result, status: "picked", picked: git(repo, ["rev-parse", "HEAD"]).trim() };
}

/** 台帳の notes に写す文 */
export function ledgerNotes(r) {
  const parts = ["hotfix pick"];
  if (r.replaced.length) parts.push(`replaced: ${r.replaced.join(",")}`);
  if (r.merged.length) parts.push(`merged: ${r.merged.join(",")}`);
  if (r.added.length) parts.push(`added: ${r.added.join(",")}`);
  if (r.leftOut.length) parts.push(`left-out: ${r.leftOut.join(",")}`);
  if (r.gaps.length) parts.push(`gap: ${r.gaps.map((g) => g.item).join(",")}`);
  if (r.renameCandidates.length) parts.push(`rename-candidate: ${r.renameCandidates.map((c) => `${c.from}->${c.to}(${c.score})`).join(",")}`);
  return parts.join("; ");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const sha = args.find((a) => !a.startsWith("--"));
  const upstream = (args.find((a) => a.startsWith("--upstream=")) ?? "--upstream=upstream/main").slice("--upstream=".length);
  if (!sha) {
    console.error("使い方: node <上流の先端から出した>/scripts/workflow/notices/hotfixApply.mjs <元の commit> [--upstream=<ref>]");
    process.exit(2);
  }
  const repo = git(process.cwd(), ["rev-parse", "--show-toplevel"]).trim();
  const r = hotfixApply(repo, sha, upstream);
  for (const p of r.replaced) console.log(`replaced\t${p}`);
  for (const p of r.merged) console.log(`merged\t${p}`);
  for (const p of r.added) console.log(`added\t${p}`);
  for (const p of r.leftOut) console.log(`left-out\t${p}`);
  for (const c of r.renameCandidates) console.log(`rename-candidate\t${c.path}\t${c.line}`);
  for (const p of r.index) console.log(`index\t${p}`);
  if (r.status === "picked") {
    for (const g of r.gaps) console.log(`gap\t${g.kind}\t${g.item}`);
    console.log(`picked\t${r.picked}`);
    console.log(`notes\t${ledgerNotes(r)}`);
    process.exit(0);
  }
  if (r.status === "conflict") {
    for (const p of r.conflicts) console.log(`conflict\t${p}`);
    console.error("hotfixApply: fork が手で変えたファイルでぶつかりました。何も変えていません(/flux の 3 つの選択へ)");
    process.exit(1);
  }
  console.error(`hotfixApply: ${r.message}`);
  process.exit(2);
}
