// scripts/workflow/rules/lib.ruleCoverage.mjs
// paths の覆いの部品(純粋な関数): 書く場所が、どれかの決まりのファイル(上流の core のファイルと札)の paths に当たるか。
// 照合は Claude Code の実際の読み込みと同じ(lib.rulePaths の matchesLoad: ** と * は点で始まる名・フォルダにも当たる、D225)。
import { matchesLoad } from "./lib.rulePaths.mjs";
import { LEDGER_DIR } from "../../../src/lib/forkOwnership/forkIds.mjs";
import { PERMITS_DIR } from "../../../src/lib/forkOwnership/permits.mjs";

// fork にだけある場所(上流の木には無いが、所有の道具が名前を決めている): ここの glob は paths に置いてよい
export const FORK_ONLY_PLACES = [`${PERMITS_DIR}/`, `${LEDGER_DIR}/`];

/** glob の代表のパス(** と * を x に替える。近似: 拡張子で絞る glob には当たらないことがある = 厳しい側) */
export const representativePath = (glob) => glob.replace(/\*\*/g, "x").replace(/\*/g, "x").replace(/\{[^}]*\}/g, "x");

/** 決まりの要らない場所の一覧(1 行 = `<glob>  # <理由>`)。理由の無い行は失敗 */
export function parseUncovered(text) {
  return text
    .split("\n")
    .map((l, i) => ({ l: l.trim(), n: i + 1 }))
    .filter(({ l }) => l && !l.startsWith("#"))
    .map(({ l, n }) => {
      const [glob, ...rest] = l.split("#");
      const reason = rest.join("#").trim();
      if (!reason) throw new Error(`uncovered ${n} 行目: 理由(# の後)が要る`);
      return { glob: glob.trim(), reason };
    });
}

/** 書き場所の一覧(intake.txt)の行: { kind, glob }(! の行と注釈を除く) */
export function parseIntakeRows(text) {
  return text
    .split("\n")
    .map((l) => l.split("#")[0].trim())
    .filter((l) => l && !l.startsWith("!"))
    .map((l) => {
      const [kind, glob] = l.split(/\s+/);
      return { kind, glob };
    });
}

const hit = (path, globs) => globs.some((g) => matchesLoad(path, g));

/**
 * 覆いの穴
 * @param {{ files: string[], intake: {kind:string, glob:string}[], rulePaths: string[], uncovered: string[] }} input
 * @returns {{ files: string[], intake: string[] }} 当たらない追跡中のファイルと、当たらない書き場所の一覧の行
 */
export function coverageGaps({ files, intake, rulePaths, uncovered }) {
  const covered = (p) => hit(p, rulePaths) || hit(p, uncovered);
  return {
    files: files.filter((f) => !covered(f)),
    intake: intake.filter((r) => !covered(r.glob) && !covered(representativePath(r.glob))).map((r) => `${r.kind} ${r.glob}`),
  };
}

/** paths の glob が、上流の木に無くても置いてよい場所(fork にだけある場所か、書き場所の一覧の場所)か */
export function isForkPlace(glob, intake) {
  if (FORK_ONLY_PLACES.some((p) => glob.startsWith(p))) return true;
  const rep = representativePath(glob);
  return intake.some((r) => r.glob === glob || matchesLoad(rep, r.glob));
}

/**
 * 覆いの検査の出し方(D223): Tier1 は穴で止める / fork は知らせるだけ / fork で基準の版が読めない時は全部を数えず 1 行
 * @param {{ isTier1: boolean, baseNote: string | null, gaps: { files: string[], intake: string[] } }} input
 * @returns {{ exitCode: 0 | 1, level: "fail" | "notify" | "unverified" | "ok", lines: string[] }}
 */
export function coverageVerdict({ isTier1, baseNote, gaps }) {
  if (!isTier1 && baseNote) return { exitCode: 0, level: "unverified", lines: [`覆いを確かめられない(${baseNote})`] };
  const lines = [...gaps.files.map((f) => `${f} にどの決まりのファイルの paths も当たらない`), ...gaps.intake.map((r) => `書き場所の一覧の ${r} にどの決まりのファイルの paths も当たらない`)];
  if (lines.length === 0) return { exitCode: 0, level: "ok", lines };
  return isTier1 ? { exitCode: 1, level: "fail", lines } : { exitCode: 0, level: "notify", lines };
}
