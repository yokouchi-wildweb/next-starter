// 型 5 self の検査(各リポが自分の版を持つ 3 つのファイル)。中身は見ない: 見るのは 4 つだけ
//   1 self-missing   ファイルが無い
//   2 self-rows      受け口の一覧の self の行が決まった 3 行ちょうどでない
//   3 self-parent    取り込み(親の版を基準にした merge)で親の版が入り、今もそのまま
//   4 self-overview  Tier1 でないリポの project.md(概要)が直接の親の今の版と同じまま
// 既定は切る(SELF_CHECK_DEFAULT)。pnpm workflow ownership check --self で走る。既定で入れるのは文脈の書き直しの最後の切り替え。
// git から入力を集めるのは check.mjs(collectSelf)、ここは純な判定だけ。仕様: ./README.md「受け口の一覧(intake.txt)」

export const SELF_FILES = [".claude/rules/project.md", ".claude/rules/behavior.md", "repo.json"];
export const SELF_OVERVIEW_FILE = ".claude/rules/project.md";
export const SELF_CHECK_DEFAULT = false;

/** 空白の違いだけは同じと見る(行末の空白・空行の数・末尾の改行) */
const normalize = (text) =>
  text
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line !== "")
    .join("\n");

/**
 * @param {{
 *   isTier1: boolean,
 *   selfRows: string[] | null,        受け口の一覧の self の行の glob(Tier1 = 自分の一覧、fork = 基準の一覧)。一覧が読めなければ null
 *   head: Record<string, string | null>,   今の中身(SELF_FILES ごと、無ければ null)
 *   merge: { found: boolean, before: Record<string, string | null>, base: Record<string, string | null> } | null,
 *                                     基準を親に持つ最新の merge の前(fork の前の版)と基準(親の取り込んだ版)の中身。Tier1 は null
 *   parentNow: string | null,         直接の親の今の project.md(Tier1 は null)
 * }} input
 * @returns {{ problems: { kind: string, path: string, message: string }[], unverified: string[] }}
 */
export function selfProblems({ isTier1, selfRows, head, merge, parentNow }) {
  const problems = [];
  const unverified = [];

  for (const path of SELF_FILES) {
    if (head[path] == null) problems.push({ kind: "self-missing", path, message: `${path} が無い(各リポが自分の版を持つ)` });
  }

  if (selfRows === null || (!isTier1 && selfRows.length === 0)) {
    unverified.push("受け口の一覧に self の行が無い(この検査を含む版をまだ取り込んでいない)");
  } else {
    const rows = [...selfRows].sort();
    const expected = [...SELF_FILES].sort();
    if (rows.join("\n") !== expected.join("\n")) {
      const extra = rows.filter((row) => !expected.includes(row));
      const missing = expected.filter((path) => !rows.includes(path));
      const detail = [extra.length ? `余分: ${extra.join(", ")}` : "", missing.length ? `足りない: ${missing.join(", ")}` : ""].filter(Boolean).join(" / ");
      problems.push({ kind: "self-rows", path: "src/lib/forkOwnership/intake.txt", message: `self の行が決まった 3 行でない(${detail})` });
    }
  }

  if (isTier1) return { problems, unverified };

  if (!merge?.found) {
    unverified.push("基準を親に持つ merge が無い(merge でない取り込み): 親の版が入ったかは見ていない");
  } else {
    for (const path of SELF_FILES) {
      const now = head[path];
      const before = merge.before[path];
      const base = merge.base[path];
      if (now == null || before == null || base == null) continue;
      if (normalize(before) !== normalize(base) && normalize(now) === normalize(base)) {
        problems.push({ kind: "self-parent", path, message: `${path} に取り込みで親の版が入ったまま(自分の版に戻し、採る所は別のコミットで写す)` });
      }
    }
  }

  const overview = head[SELF_OVERVIEW_FILE];
  if (overview != null && parentNow != null && normalize(overview) === normalize(parentNow)) {
    problems.push({ kind: "self-overview", path: SELF_OVERVIEW_FILE, message: `${SELF_OVERVIEW_FILE} が直接の親の版と同じまま(自分の概要に書き直す)` });
  }
  return { problems, unverified };
}
