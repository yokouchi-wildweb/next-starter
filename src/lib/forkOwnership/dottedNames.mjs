// 受け口のファイル名の点つきの形の分類(共通の判定。Node 組み込みも使わない純関数の .mjs)。
// 受け口(拡張口の項目・1 行スイッチ・拡張点の宣言・src/wiring 直下・ドメインのタスク(src/features/<ドメイン>/scripts/{tasks,migrations})・常時実行の例外・_layout / _screen の隣)は
// 名前に fork の印を持たない。許す形は次だけで、それ以外の点つきの名前は旧い fork の名前の印として止める:
// - 印なし <名前>.<拡張子>                     plain
// - 既定 <名前>.default.<拡張子>              default(上流の既定。隣の素の名前がスイッチ)
// - 丸ごと置き換え <名前>.replace.<拡張子>     replace
// - 一部の上書き <対象>.override.<拡張子>      override(<対象> は user.role のように "." を含んでよい)
// - client の口 <名前>.client.<拡張子>         client
// - テスト <名前>.test|spec|d.<拡張子>         test(受け口の項目ではない)
// 所有(fork の物か上流の物か)は名前で見ない: git の分岐点で見る(./check.mjs の forkAddedFiles)。

/** 旧い印から移すときに案内する notice */
export const MARKER_MIGRATION_NOTICE = "共有の棚の印の移行の notice(the shared-shelf marker migration notice)";

const KNOWN = new Set(["default", "replace", "client"]);
const TEST_SUFFIX = new Set(["test", "spec", "d"]);

/**
 * ファイル名(ディレクトリを含まない)の点つきの形を分類する。拡張子は最後の "." の後ろ(フォルダ名は拡張子なしで渡す: { folder: true })
 * @param {string} fileName
 * @param {{ folder?: boolean }} [options]
 * @returns {{ base: string, kind: "plain" | "default" | "replace" | "override" | "client" | "test" | "marker", target?: string, marker?: string, ext: string }}
 *   base = 最初の "." の前、target = override の対象、marker = 旧い印の部分(kind "marker" のとき)
 */
export function classifyDottedName(fileName, { folder = false } = {}) {
  const lastDot = folder ? -1 : fileName.lastIndexOf(".");
  const stem = lastDot <= 0 ? fileName : fileName.slice(0, lastDot);
  const ext = lastDot <= 0 ? "" : fileName.slice(lastDot + 1);
  const segments = stem.split(".");
  const base = segments[0];
  const rest = segments.slice(1);
  if (rest.length === 0) return { base, kind: "plain", ext };
  const last = rest[rest.length - 1];
  if (last === "override") return { base, kind: "override", target: segments.slice(0, -1).join("."), ext };
  if (TEST_SUFFIX.has(last)) return { base, kind: "test", ext };
  if (rest.length === 1 && KNOWN.has(rest[0])) return { base, kind: rest[0], ext };
  return { base, kind: "marker", marker: rest.join("."), ext };
}

/**
 * 旧い印の名前を止めるときの文言
 * @param {string} label 表示する path
 * @param {string} fixed 改名の先(例 "alpha.ts")
 */
export const oldMarkerProblem = (label, fixed) =>
  `${label}: 名前に fork の印は付けない(印なしの ${fixed} に改名する。丸ごと置き換えは <名前>.replace、一部の上書きは <対象>.override。移し方は ${MARKER_MIGRATION_NOTICE})`;
