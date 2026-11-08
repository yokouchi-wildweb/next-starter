// scripts/workflow/notices/lib.pickDroppingIndex.mjs
// 修正・緊急修正の commit を一時の木へ cherry-pick するとき、出荷索引(.notices/shipped/)の変更だけを捨てる(pick-check・hotfix-check が使う)。
// /ship は notice の索引の行を本体と同じ commit に入れるが、索引は追記だけの上流の帳簿で、索引が無い・短い土台では必ず衝突する。
// fork は pick の時点で上流の索引を要らない(未適用の判定は上流の先端の索引を読む。索引は後の merge で届く)ので、
// /flux も同じく索引だけの衝突は fork 側を採って続ける(.claude/skills/flux/SKILL.md・.notices/README.md「修正(fixes)」)。
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
