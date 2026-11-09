// 拡張の名前の決まりの唯一の元(git にもファイルにも触れない純関数の .mjs)。
// 読み手: scripts/structure/extensions(1 行スイッチ・枠の宣言・孤立・上書きの検査と受け口の一覧の生成)と
// src/lib/forkOwnership/who.mjs(pnpm workflow ownership who の型の答え)。who は scripts を読めない(lint src-no-scripts)のでここに置く。
//
// - 1 行スイッチ: 既定 <名前>.default.ts(x)(上流)の隣の素の名前 <名前>.ts(x) = 呼び手が import する口。
//   fork の実装 = <名前>.replace.ts(x)(丸ごと置き換え)。ほかの仕組みが名乗った .default の形(CLAIMED_DEFAULTS)はスイッチの既定でない
// - 一部の上書き: <対象>.override.ts(x)(最後の拡張子を .override.ts に: task.ts → task.override.ts、a.role.json → a.role.override.ts)
// - 枠の宣言: src/app の frame.ts(ルートを作ったリポ)と frame.override.ts(その下のリポ)。frame.default.ts は使わない
// 点つきの名前の分類(旧い fork の印を止める)は ./dottedNames.mjs

/** 1 行スイッチの既定 <名前>.default.ts(x)(1 = 名前、2 = 拡張子) */
export const DEFAULT_FILE = /^([A-Za-z][A-Za-z0-9]*)\.default\.(ts|tsx)$/;
/** 丸ごと置き換え <名前>.replace.ts(x)(1 = 名前、2 = 拡張子) */
export const REPLACE_FILE = /^(.+)\.replace\.(ts|tsx)$/;
/** 一部の上書き <対象>.override.ts(x)。素の override.ts は上書きでない(cron の旧名は src/lib/cron/discover.ts が止める) */
export const OVERRIDE_FILE = /^[A-Za-z_][\w.-]*\.override\.(ts|tsx)$/;

/** 枠の宣言: ルートを作ったリポ */
export const FRAME_FILE = "frame.ts";
/** 枠の宣言: その下のリポ(相手 = そのルート。ルートを作ったリポの宣言の上に重なる) */
export const FRAME_OVERRIDE_FILE = "frame.override.ts";
/** 枠の宣言の旧い名前(どの Tier でも失敗。frame.ts へ改名: pnpm check extensions -- frames-move) */
export const FRAME_DEFAULT_FILE = "frame.default.ts";
/** 枠の宣言を置く木 */
export const FRAME_SEARCH_ROOT = "src/app";

/**
 * ほかの仕組みが名乗る .default のファイルの形(.default = 作ったリポが出す既定の共通の印、D171)。1 行スイッチの検査はこれをスイッチの既定として扱わない。
 * 枠の宣言は .default を使わず frame.default.ts を失敗にする(名乗るのは、スイッチの検査が既定と取り違えてスイッチを求めないため)。
 * 形: { by: 持ち主, under: 走査の範囲(リポジトリ直下からの相対), name: ファイル名 | pattern: ファイル名の RegExp }
 * @type {readonly { by: string, under: string, name?: string, pattern?: RegExp }[]}
 */
export const CLAIMED_DEFAULTS = [{ by: "scripts/structure/extensions/frames.mjs(枠の宣言の既定)", under: FRAME_SEARCH_ROOT, name: FRAME_DEFAULT_FILE }];

const fileName = (path) => path.slice(path.lastIndexOf("/") + 1);
const dirName = (path) => path.slice(0, Math.max(path.lastIndexOf("/"), 0));

/** path(リポジトリ直下からの相対)がどれかの仕組みの名乗った .default の形か */
export function isClaimedDefault(path, claims = CLAIMED_DEFAULTS) {
  const name = fileName(path);
  return claims.some((c) => path.startsWith(`${c.under}/`) && (c.name !== undefined ? name === c.name : c.pattern.test(name)));
}

/**
 * 1 行スイッチの組。path が既定 <名前>.default.ts(x)・素の <名前>.ts(x)・置き換え <名前>.replace.ts(x) のどれかなら、その組の 3 つのパスの候補。
 * 拡張子は ts と tsx の両方を返す(どちらがあるかは呼び手が木で見る)。名乗った形と、そうでない名前は null
 * @param {string} path
 * @returns {{ name: string, dir: string, role: "default" | "switch" | "replace", defaults: string[], switches: string[], replaces: string[] } | null}
 */
export function switchSetOf(path, claims = CLAIMED_DEFAULTS) {
  if (isClaimedDefault(path, claims)) return null;
  const dir = dirName(path);
  const name = fileName(path);
  const of = (stem) => ["ts", "tsx"].map((ext) => `${dir}/${stem}.${ext}`);
  const set = (base, role) => ({ name: base, dir, role, defaults: of(`${base}.default`), switches: of(base), replaces: of(`${base}.replace`) });
  const asDefault = DEFAULT_FILE.exec(name);
  if (asDefault) return set(asDefault[1], "default");
  const asReplace = /^([A-Za-z][A-Za-z0-9]*)\.replace\.(ts|tsx)$/.exec(name);
  if (asReplace) return set(asReplace[1], "replace");
  const asSwitch = /^([A-Za-z][A-Za-z0-9]*)\.(ts|tsx)$/.exec(name);
  if (asSwitch) return set(asSwitch[1], "switch");
  return null;
}

/** 上書きのファイルか(<対象>.override.ts(x)。src/app の frame.override.ts は枠の宣言で、上書きの検査の対象でない) */
export function isOverridePath(path) {
  if (!OVERRIDE_FILE.test(fileName(path))) return false;
  return !(path.startsWith(`${FRAME_SEARCH_ROOT}/`) && /^frame\.override\.tsx?$/.test(fileName(path)));
}

/** 対象の glob → 隣の上書きの glob(最後の拡張子を .override.ts に: task.ts → task.override.ts、*.role.json → *.role.override.ts) */
export const overrideGlobOf = (glob) => glob.replace(/\.[A-Za-z]+$/, ".override.ts");

/** 対象のパス → 隣の上書きのパス(overrideGlobOf と同じ決まり) */
export const overridePathOfTarget = overrideGlobOf;

/**
 * 上書きのパス → 隣の対象のパス(最後の拡張子は対象の glob の物: task.override.ts → task.ts、user.role.override.ts → user.role.json)
 * @param {string} path <対象>.override.ts(x)
 * @param {string} targetGlob 上書きの対象の点の overrides(対象のファイルの glob)
 */
export const targetOfOverride = (path, targetGlob) => path.replace(/\.override\.tsx?$/, targetGlob.slice(targetGlob.lastIndexOf(".")));
