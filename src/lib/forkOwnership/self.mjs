// 型 5 self の検査(各リポが自分の版を持つ 3 つのファイル)。中身は見ない: 落とすのは 3 つだけ
//   1 self-missing   ファイルが無い
//   2 self-rows      受け口の一覧の self の行が決まった 3 行ちょうどでない
//   3 self-overview  Tier1 でないリポの project.md(概要)が直接の親の今の版と同じまま
// 落とさず聞く物(asks、/flux が人に聞く。D280):
//   self-parent-lost 取り込みの前は自分の版(前に取り込んだ親の版と違う)だったのに、取り込みで親の版と同じになった
//                    → 親の版に従う / 自分の行を戻す。取り込みの前から親の版のまま(親の版をそのまま使う、正式な選び方)は何も言わない
// 既定は入(SELF_CHECK_DEFAULT)。pnpm workflow ownership check がいつも走らせる。--no-self で外す(調べる時だけ)。
// git から入力を集めるのは check.mjs(collectSelf)、ここは純な判定だけ。仕様: ./README.md「受け口の一覧(intake.txt)」

export const SELF_FILES = [".claude/rules/project.md", ".claude/rules/behavior.md", "repo.json"];
export const SELF_OVERVIEW_FILE = ".claude/rules/project.md";
export const SELF_CHECK_DEFAULT = true;

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
 *   merge: { found: boolean, before: Record<string, string | null>, base: Record<string, string | null>, prevBase?: Record<string, string | null> } | null,
 *                                     基準を親に持つ最新の merge の前(fork の前の版)・基準(親の取り込んだ版)・その前に取り込んだ親の版
 *                                     (merge の前と基準の分岐点。読めなければ null)の中身。Tier1 は null
 *   parentNow: string | null,         直接の親の今の project.md(Tier1 は null)
 * }} input
 * @returns {{ problems: { kind: string, path: string, message: string }[], asks: { kind: string, path: string, message: string }[], unverified: string[] }}
 */
export function selfProblems({ isTier1, selfRows, head, merge, parentNow }) {
  const problems = [];
  const asks = [];
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

  if (isTier1) return { problems, asks, unverified };

  if (!merge?.found) {
    unverified.push("基準を親に持つ merge が無い(merge でない取り込み): 親の版が入ったかは見ていない");
  } else {
    for (const path of SELF_FILES) {
      const now = head[path];
      const before = merge.before[path];
      const base = merge.base[path];
      const prevBase = merge.prevBase?.[path] ?? null;
      if (now == null || before == null || base == null) continue;
      if (normalize(now) !== normalize(base) || normalize(before) === normalize(base)) continue;
      // 取り込みの前から親の版のまま = 親の版をそのまま使っている(何も言わない)
      if (prevBase != null && normalize(before) === normalize(prevBase)) continue;
      asks.push({ kind: "self-parent-lost", path, message: `${path} の自分の行が取り込みで消え、親の版と同じになった(親の版に従う / 自分の行を戻す: git show <merge>^1:${path})` });
    }
  }

  const overview = head[SELF_OVERVIEW_FILE];
  if (overview != null && parentNow != null && normalize(overview) === normalize(parentNow)) {
    problems.push({ kind: "self-overview", path: SELF_OVERVIEW_FILE, message: `${SELF_OVERVIEW_FILE} が直接の親の版と同じまま(自分の概要に書き直す)` });
  }
  return { problems, asks, unverified };
}
