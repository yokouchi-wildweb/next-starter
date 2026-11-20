// scripts/workflow/notices/lib.pickDroppingIndex.mjs
// 修正の commit を一時の木へ cherry-pick するとき、出荷索引(.notices/shipped/)の変更だけを捨てる(pick-check が使う)。
// 索引は外した(.notices/README.md「お知らせの一覧と本文の読み方(履歴)」)が、外す前の修正の commit は索引の行の変更を持ち、
// 索引の無い・短い土台では必ず衝突する。/flux も同じく索引だけの衝突は上流の側を採って続ける。
// sunset: 20261120-122554-notice-history(この部品ごと: 全部の fork が取り込んだら外し、pickCheck は素の cherry-pick に)
// 判定・判定の材料はどちらも「索引を除いた中身が載るか」で、索引の変更は木に残さない(衝突しなくても土台の索引のまま)。
import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { join } from "node:path";

export const SHIPPED_PREFIX = ".notices/shipped/";

const isIndex = (f) => f.startsWith(SHIPPED_PREFIX);

function git(cwd, args) {
  return execFileSync("git", ["-C", cwd, "-c", "core.quotePath=false", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 });
}

const lines = (s) => s.split("\n").filter(Boolean);

/**
 * dir(作業ツリーのある一時の木)で `git cherry-pick -n <commit>` を行い、索引の変更を土台(HEAD)の状態へ戻す。
 * 戻り値 conflicts = 索引以外で衝突したパス(空 = 載った)。衝突があっても木はそのまま返す(呼び手が始末する)。
 */
export function pickDroppingIndex(dir, commit) {
  let failed = false;
  try {
    git(dir, ["cherry-pick", "-n", commit]);
  } catch {
    failed = true;
  }
  const unmerged = failed ? [...new Set(lines(git(dir, ["diff", "--name-only", "--diff-filter=U"])))] : [];
  if (failed && unmerged.length === 0) throw new Error(`cherry-pick ${commit.slice(0, 8)} が衝突以外の理由で失敗した`);
  const conflicts = unmerged.filter((f) => !isIndex(f));
  if (conflicts.length) return { conflicts };
  const atBase = new Set(lines(git(dir, ["ls-tree", "-r", "--name-only", "HEAD", "--", SHIPPED_PREFIX])));
  const touched = new Set([...unmerged, ...lines(git(dir, ["diff", "--name-only", "HEAD", "--", SHIPPED_PREFIX]))]);
  for (const f of touched) {
    if (atBase.has(f)) {
      git(dir, ["checkout", "HEAD", "--", f]);
    } else {
      git(dir, ["rm", "-q", "-f", "--cached", "--ignore-unmatch", "--", f]);
      rmSync(join(dir, f), { force: true });
    }
  }
  return { conflicts: [] };
}
