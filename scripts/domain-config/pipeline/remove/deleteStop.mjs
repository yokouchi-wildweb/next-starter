// dc:delete を止める判定: 主と従属の組を壊す削除と、他のドメインの domain.json から関連で指されているドメインの削除と、
// 消さずに残るコード（src 配下）から import されているドメインの削除を止める。
// 読むだけで何も消さない。消すドメイン自身の関連（外向き）は数えない。指されたまま消すと、参照元の生成物が消えたドメインを import し続け、後で tsc / db:push が離れた場所で落ちる
// 見えないもの: 外部キーを張らない素の id 列（宣言にもコードにも参照が出ない）、文字列でドメイン名を渡す参照（serviceRegistry 経由など）、src の外（servers/ など）

import fs from "node:fs";
import path from "node:path";

import { toCamelCase } from "../../../../src/utils/stringCase.mjs";
import { resolvePairs } from "../pairs.mjs";

/** 指されていれば止める関連の種類。belongsToMany は includeRelationTable: false の逆側も含む（生成物が相手を import する） */
const REFERENCE_TYPES = new Set(["belongsTo", "belongsToMany", "hasMany", "hasOne"]);

/**
 * ドメインを指している関連の一覧（自己参照は除く）。ファイルを読まない純関数
 * @param {Map<string, object | null>} configs フォルダ名 → domain.json の中身（読めなければ null）
 * @param {string} folder 消すドメインのフォルダ名（camelCase）
 * @returns {{ domain: string, fieldName: string | undefined, relationType: string }[]}
 */
export function inboundReferences(configs, folder) {
  const references = [];
  for (const [domain, config] of configs) {
    if (domain === folder) continue;
    for (const relation of config?.relations ?? []) {
      if (!REFERENCE_TYPES.has(relation?.relationType) || toCamelCase(relation.domain) !== folder) continue;
      references.push({ domain, fieldName: relation.fieldName, relationType: relation.relationType });
    }
  }
  return references;
}

/** 走査するコードの拡張子 */
const CODE_FILE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;

/** 走査しない場所（src 相対）: 生成物の一覧（pnpm registry:generate が残ったドメインから作り直す） */
const SKIPPED_PREFIXES = ["src/registry/"];

/** 静的 import / export from / 動的 import() / require の from 先 */
function importSources(text) {
  const body = text.replace(/^[ \t]*\/\/[^\n]*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const sources = [];
  for (const m of body.matchAll(/^\s*(?:import|export)\s[^;]*?from\s*["']([^"']+)["']/gm)) sources.push(m[1]);
  for (const m of body.matchAll(/^\s*import\s*["']([^"']+)["']/gm)) sources.push(m[1]);
  for (const m of body.matchAll(/\b(?:import|require)\(\s*["']([^"']+)["']\s*\)/g)) sources.push(m[1]);
  return sources;
}

/**
 * from 先が消すドメインのフォルダを指すか。@/features/<folder>・@/features/core/<folder>（core は core/ を省いて書く）と、
 * 解決するとそのフォルダに入る相対パス
 * @param {string} file リポジトリ相対（posix）
 * @param {string} source
 * @param {string} featureRel 消すドメインのフォルダ（リポジトリ相対の posix。例 src/features/coupon・src/features/core/coupon）
 */
function pointsAt(file, source, featureRel) {
  const folder = path.posix.basename(featureRel);
  if (source.startsWith("@/")) {
    const target = `src/${source.slice(2)}`;
    return [featureRel, `src/features/${folder}`].some((dir) => target === dir || target.startsWith(`${dir}/`));
  }
  if (!source.startsWith(".")) return false;
  const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), source));
  return target === featureRel || target.startsWith(`${featureRel}/`);
}

/**
 * 消さずに残るコードからの import（ファイルを読まない純関数）
 * @param {{ path: string, text: string }[]} files リポジトリ相対（posix）のパスと中身
 * @param {string} featureRel 消すドメインのフォルダ（リポジトリ相対の posix）
 * @param {string[]} [excludedDirs] 一緒に消すディレクトリ（リポジトリ相対の posix。ドメインのフォルダは常に除く）
 * @returns {{ file: string, source: string }[]}
 */
export function codeReferences(files, featureRel, excludedDirs = []) {
  const excluded = [featureRel, ...excludedDirs];
  const inside = (file, dir) => file === dir || file.startsWith(`${dir}/`);
  const references = [];
  for (const { path: file, text } of files) {
    if (!CODE_FILE.test(file)) continue;
    if (excluded.some((dir) => inside(file, dir)) || SKIPPED_PREFIXES.some((prefix) => file.startsWith(prefix))) continue;
    for (const source of new Set(importSources(text))) {
      if (pointsAt(file, source, featureRel)) references.push({ file, source });
    }
  }
  return references;
}

/** src 配下のコードファイル（リポジトリ相対の posix と中身） */
function readSourceFiles(rootDir) {
  const files = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (CODE_FILE.test(entry.name)) files.push({ path: path.relative(rootDir, full).split(path.sep).join("/"), text: fs.readFileSync(full, "utf8") });
    }
  };
  walk(path.join(rootDir, "src"));
  return files;
}

/**
 * import の参照で止める理由（無ければ null）
 * @param {import("../../domain/workspace.mjs").Workspace} workspace
 * @param {string} featureDir 消すドメインのフォルダ（絶対パス）
 * @param {string[]} [excludedDirs] 一緒に消すディレクトリ（絶対パス）
 */
export function codeReferenceStopMessage(workspace, featureDir, excludedDirs = []) {
  const rel = (dir) => path.relative(workspace.rootDir, dir).split(path.sep).join("/");
  const featureRel = rel(featureDir);
  const references = codeReferences(readSourceFiles(workspace.rootDir), featureRel, excludedDirs.map(rel));
  if (references.length === 0) return null;
  return [
    `${path.basename(featureDir)} は消さずに残るコードから import されているため削除できません:`,
    ...references.map(({ file, source }) => `  - ${file}: ${source}`),
    "消すなら、先にその import を外してください（参照元が別のドメインなら、そのドメインのコード・関連を先に直す）。一緒に消すルートのディレクトリは --extra で選ぶと数えません",
  ].join("\n");
}

/** 組を壊す削除の理由（無ければ message: null）と、文面に出した残っている従属（remaining）を返す */
function pairStop(workspace, folder, pairs) {
  // 主: domain.json が残っている従属があれば止める（まだ書き出していない従属は残っていない）
  const remaining = (pairs.childrenOf.get(folder) ?? []).filter((child) => workspace.exists(workspace.configPath(child)));
  if (remaining.length > 0) {
    const fields = remaining.map((child) => `"${pairs.fieldOf.get(child)}"`).join(", ");
    return {
      remaining,
      message:
        `${folder} は集まりの従属（${remaining.join(", ")}）を持っているため削除できません。` +
        `消すなら、先に ${folder}/domain.json の集まりの項目 ${fields} を外し、従属を dc:delete --remove-config してから ${folder} を消してください`,
    };
  }
  // 従属: 主が集まりの項目を宣言している間は止める（残すと次の生成で雛形がまた書き出される）
  const owner = pairs.ownerOf.get(folder);
  if (owner) {
    return { remaining, message: `${folder} は ${owner} の集まりの従属です。先に ${owner}/domain.json の集まりの項目 "${pairs.fieldOf.get(folder)}" を外してください` };
  }
  return { remaining, message: null };
}

/**
 * @param {import("../../domain/workspace.mjs").Workspace} workspace
 * @param {string} folder 消すドメインのフォルダ名（camelCase）
 * @param {import("../pairs.mjs").PairIndex} [pairs]
 * @returns {string | null} 止める理由（null = 止めない）
 */
export function deleteStopMessage(workspace, folder, pairs = resolvePairs(workspace)) {
  const { remaining, message } = pairStop(workspace, folder, pairs);
  const configs = new Map(workspace.listDomains().map((domain) => [domain, workspace.readConfigLenient(workspace.configPath(domain))]));
  // 組の文面に出した従属は重ねて出さない（直すものは 1 回の実行で全部見せる）
  const references = inboundReferences(configs, folder).filter((reference) => !remaining.includes(reference.domain));
  const lines = message ? [message] : [];
  if (references.length > 0) {
    lines.push(
      `${folder} は他のドメインから参照されているため削除できません:`,
      ...references.map(({ domain, fieldName, relationType }) => `  - ${domain}: ${fieldName ?? "(fieldName なし)"}（${relationType}）`),
      "消すなら、先に参照元の domain.json からその関連を外すか、参照元を dc:delete --remove-config してください（domain.json を残すと宣言が残るので止まり続けます）",
    );
  }
  return lines.length > 0 ? lines.join("\n") : null;
}
