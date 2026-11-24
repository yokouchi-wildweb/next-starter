// 型 5 self の検査(各リポが自分の版を持つファイル: 必ず持つ 8 つ + 持たなくてよい vercel.json、D295・D299・D311)。中身は見ない: 落とすのは 3 つだけ
//   1 self-missing   必ず持つファイルが無い(持たなくてよい物は無くてよい = Vercel にデプロイしないリポ)
//   2 self-rows      受け口の一覧の self の行が決まった 9 行ちょうどでない
//   3 self-overview  Tier1 でないリポの project.md(概要)が直接の親の今の版と同じまま
// 落とさず聞く物(asks、/flux が人に聞く。D280):
//   self-parent-lost 取り込みの前は自分の版(前に取り込んだ親の版と違う)だったのに、取り込みで親の版と同じになった
//                    → 親の版に従う / 自分の行を戻す。取り込みの前から親の版のまま(親の版をそのまま使う、正式な選び方)は何も言わない
// 既定は入(SELF_CHECK_DEFAULT)。pnpm workflow ownership check がいつも走らせる。--no-self で外す(調べる時だけ)。
// git から入力を集めるのは check.mjs(collectSelf)、ここは純な判定だけ。仕様: ./README.md「受け口の一覧(intake.txt)」

/**
 * 必ず持つ self。直下のコードの設定 3 本(D299)は Tier1 の本体 <道具>.config.core.<拡張子> を読み、足す・包む・外す
 * (playwright は読まなくてよい)。Tier1 の版は本体をそのまま使う。backend-selection.json = バックエンドの選択表(口 → 実装の名前)、
 * 書くのは pnpm workflow backend-selection fill / set(Tier1 の版は {})
 */
export const SELF_REQUIRED = [".claude/rules/project.md", ".claude/rules/behavior.md", ".claude/rules/shortcuts.md", "repo.json", "next.config.ts", "eslint.config.mjs", "playwright.config.ts", "backend-selection.json"];
/**
 * 持たなくてよい self(持つなら自分の版)。vercel.json = Vercel にデプロイするリポだけ、crons は pnpm generate cron の出力
 */
export const SELF_OPTIONAL = ["vercel.json"];
/** self の全部(受け口の一覧の self の行・取り込みで親の版になったかの問い・中継の対象外はこれを読む) */
export const SELF_FILES = [...SELF_REQUIRED, ...SELF_OPTIONAL];
export const SELF_OVERVIEW_FILE = ".claude/rules/project.md";
export const SELF_CHECK_DEFAULT = true;

/** @typedef {{ kind: string, path: string, message: string }} SelfProblem */

/** 空白の違いだけは同じと見る(行末の空白・空行の数・末尾の改行) */
const normalize = (/** @type {string} */ text) =>
  text
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line !== "")
    .join("\n");

/**
 * @param {{
 *   isTier1: boolean,
 *   selfRows: string[] | null,
 *   head: Record<string, string | null>,
 *   merge: { found: boolean, before: Record<string, string | null>, base: Record<string, string | null>, prevBase?: Record<string, string | null> } | null,
 *   parentNow: string | null,
 * }} input selfRows = 受け口の一覧の self の行の glob(Tier1 = 自分の一覧、fork = 基準の一覧。一覧が読めなければ null)、
 *   head = 今の中身(SELF_FILES ごと、無ければ null)、merge = 基準を親に持つ最新の merge の前(fork の前の版)・基準(親の取り込んだ版)・
 *   その前に取り込んだ親の版(merge の前と基準の分岐点。読めなければ null)の中身(Tier1 は null)、parentNow = 直接の親の今の project.md(Tier1 は null)
 * @returns {{ problems: SelfProblem[], asks: SelfProblem[], unverified: string[] }}
 */
export function selfProblems({ isTier1, selfRows, head, merge, parentNow }) {
  /** @type {SelfProblem[]} */
  const problems = [];
  /** @type {SelfProblem[]} */
  const asks = [];
  /** @type {string[]} */
  const unverified = [];

  for (const path of SELF_REQUIRED) {
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
      problems.push({ kind: "self-rows", path: "src/lib/forkOwnership/intake.txt", message: `self の行が決まった ${SELF_FILES.length} 行でない(${detail})` });
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

/**
 * @typedef {{ path: string, action: "restore" | "remove" | "keep-new" | "same", required: boolean }} SelfKeepStep
 *   restore = 取り込みの前の自分の版に戻す / remove = 取り込みの前に持っていなかった持たなくてよい self を消す(自分の版 = 無い) /
 *   keep-new = 取り込みの前に持っていなかった必ず持つ self(親の版を最初の自分の版にする) / same = 前の版のまま(何もしない)
 */

/**
 * 区間の merge の後、型 5 self を自分の版に戻す計画(純、D314: 衝突したかどうかによらずいつも自分の版を残す)。
 * 区間の上流の差分に入った self のパスだけを見る。gitから集めるのは selfKeep.mjs
 * @param {{ paths: string[], required: string[], pre: Record<string, string | null>, now: Record<string, string | null> }} input
 *   paths = 区間の上流の差分に入った self のパス / required = 必ず持つ self / pre = merge の前の版(無い = null) / now = 作業ツリー(無い = null)
 * @returns {SelfKeepStep[]}
 */
export function planSelfKeep({ paths, required, pre, now }) {
  return paths.map((path) => {
    const isRequired = required.includes(path);
    const before = pre[path] ?? null;
    const current = now[path] ?? null;
    if (before === null) {
      if (current === null) return { path, action: "same", required: isRequired };
      return { path, action: isRequired ? "keep-new" : "remove", required: isRequired };
    }
    return { path, action: current === before ? "same" : "restore", required: isRequired };
  });
}
