// src/featureGate/checks/alwaysOnEntries.mjs
// 常時実行の入口の閉じ漏れの判定(D17・D30・D20 K4)。字面で読むだけの純関数(Node 組み込みも使わない)。
//
// 機能を閉じる規則(features を持つもの)の機能が無効なら、その表は db:push で作られない。それでも常に動く処理が
// その機能のフォルダを import していたら、無効なときに無い表を読む。そこで常時実行の入口ごとに「閉じられるか」を見る:
// - cron の task.ts(種類 cronTask): タスクの住所 /api/cron/<name> を、import した機能のフォルダを features に持つ規則の全部が
//   pathPatterns で覆う(読み手は withCoveredPatterns で規則のドメインの導出の住所を足して渡す。住所は生成器が task の import から cronTasks・cronPaths に導く。閉じた機能のタスクは route・pnpm task・pnpm generate cron が住所で飛ばす。enabled は見ない)
// - 宣言の alwaysOn: true の点の項目(後片付け・照合、種類 alwaysOnItem): enabled(config を読む同期関数)がある(式の中身までは見ない)
// - 生成された plugs の点の一覧(種類 plugsList): 使う時に門番の gate.plugs が閉じたドメインの項目を外す
// - それ以外(常に読み込まれる結線など、種類 wiring): 閉じうるドメインを import したら止める。例外表は無い(D22・注文 36: ゲートの無い地区は点から読む)
// 限界: 直接の import だけを見る(別のモジュールを経由した到達は見ない)。型だけの import は数えない。
// 使い手: scripts/structure/proxies/featureGate.test.mjs(実リポ)、scripts/structure/proxies/proxyFrame.test.mjs(fixture)

import { matchesPath } from "../../lib/pathPattern/index.mjs";

/** 機能のフォルダ(src/domains からの相対)を import 元の印に。core は `@/domains/core/<x>/` と `@/domains/<x>/` の両方 */
export function folderSourcePattern(folder) {
  const escaped = folder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const alias = folder.startsWith("core/") ? `|${folder.slice("core/".length).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}` : "";
  return new RegExp(`^@/domains/(?:${escaped}${alias})(?:/|$)`);
}

const STATIC_IMPORT = /import\s+(type\s+)?([\s\S]*?)\s+from\s+["']([^"']+)["']/g;
const DYNAMIC_IMPORT = /import\(\s*["']([^"']+)["']\s*\)/g;

/**
 * ファイルの中の、機能のフォルダへの値 import を集める
 * @param {string} text
 * @param {RegExp[]} patterns folderSourcePattern の結果
 * @returns {{ source: string, names: string[] | null }[]} names = 取り出した名前(null = 動的 import・namespace・default で名前を問わない)
 */
export function gatedImports(text, patterns) {
  const hits = [];
  for (const match of text.matchAll(STATIC_IMPORT)) {
    const [, typeOnly, clause, source] = match;
    if (typeOnly || !patterns.some((p) => p.test(source))) continue;
    const named = /^\{([\s\S]*)\}$/.exec(clause.trim());
    if (!named) {
      hits.push({ source, names: null });
      continue;
    }
    const names = named[1]
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part && !part.startsWith("type "))
      .map((part) => part.split(/\s+as\s+/).pop().trim());
    if (names.length > 0) hits.push({ source, names });
  }
  for (const match of text.matchAll(DYNAMIC_IMPORT)) {
    if (patterns.some((p) => p.test(match[1]))) hits.push({ source: match[1], names: null });
  }
  return hits;
}

/** alwaysOn の点の項目: 値に enabled があるか(字面) */
export const itemHasEnabled = (text) => /\benabled\s*:/.test(text);

/** cron の task.ts のパス(…/api/cron/<name>/task.ts)からタスクの住所 /api/cron/<name> */
export function cronTaskPathOf(file) {
  const name = /(?:^|\/)api\/cron\/([^/]+)\/task\.ts$/.exec(file)?.[1];
  return name ? `/api/cron/${name}` : null;
}

/**
 * cron のタスクの住所を、import した機能のフォルダを持つ規則が全部閉じるか。覆わない規則の名前を返す
 * @param {string} taskPath /api/cron/<name>
 * @param {string[]} sources import 元(@/domains/…)
 * @param {{ name: string, domains?: string[], pathPatterns: string[] }[]} rules
 */
export function rulesNotCoveringCronTask(taskPath, sources, rules) {
  const owners = rules.filter((rule) => (rule.domains ?? []).some((folder) => sources.some((source) => folderSourcePattern(folder).test(source))));
  return owners.filter((rule) => !rule.pathPatterns.some((pattern) => matchesPath(taskPath, pattern))).map((rule) => rule.name);
}

// 規則の when が指したドメインの config.ts(最上位の真偽の値だけ)を読む生成物 src/featureGate/extensions/whenInputs.ts は閉じ漏れでない
// (入切でない条件の値、例 決済の自社振込が選べるか。規則は値を import しない、D28。入切そのものは規則の defaultEnabled と switches.config.ts、D35)。
// config が値以外に届くかは到達の検査(pnpm test src/featureGate/checks/reachability.test.mjs: 入口から services・drizzle・server-only に届かない)が見る
const WHEN_INPUTS_FILE = "src/featureGate/extensions/whenInputs.ts";
const DOMAIN_CONFIG = /^@\/domains\/(?:core\/)?[^/]+\/config$/;
export const isWhenConfigImport = (path, source) => path === WHEN_INPUTS_FILE && DOMAIN_CONFIG.test(source);

/**
 * 入口の判定
 * @param {{ path: string, text: string, kind: "cronTask" | "alwaysOnItem" | "plugsList" | "wiring" }[]} entries
 *   plugsList = 生成された plugs の点の一覧(src/wiring/<lib>.ts・src/proxies/extensions/<点>.ts など。項目 { domain, requires, plug } を全部 import し、使う時に門番の gate.plugs が
 *   閉じたドメインの項目を外す、D26。点の持ち主の lib は空の一覧で既定に戻る、D53)は閉じ漏れでない
 * @param {{ name: string, domains?: string[], pathPatterns: string[] }[]} rules 規則(features を持つものが対象。cronTask の住所の判定にも使う)
 * @returns {{ problems: string[], hits: string[] }} hits = 該当した入口(path: 種類)
 */
export function judgeAlwaysOnEntries(entries, rules) {
  const folders = [...new Set(rules.flatMap((rule) => rule.domains ?? []))];
  const patterns = folders.map(folderSourcePattern);
  const problems = [];
  const hits = [];
  for (const entry of entries) {
    const imports = gatedImports(entry.text, patterns).filter((i) => !isWhenConfigImport(entry.path, i.source));
    if (imports.length === 0) continue;
    const sources = [...new Set(imports.map((i) => i.source))].join(", ");
    hits.push(`${entry.path}: ${entry.kind}`);
    if (entry.kind === "cronTask") {
      const taskPath = cronTaskPathOf(entry.path);
      if (!taskPath) {
        problems.push(`${entry.path}: cron の task.ts のパス(…/api/cron/<name>/task.ts)でない`);
        continue;
      }
      for (const name of rulesNotCoveringCronTask(taskPath, imports.map((i) => i.source), rules)) {
        problems.push(
          `${entry.path}: ${sources} を import するのに、規則 ${name} の pathPatterns が ${taskPath} を覆わない(住所は生成器が task の import から規則の cronPaths に導く: pnpm generate extensions。閉じた機能のタスクは住所で飛ぶ)`,
        );
      }
      continue;
    }
    if (entry.kind === "alwaysOnItem") {
      if (!itemHasEnabled(entry.text)) problems.push(`${entry.path}: ${sources} を import するのに enabled が無い(拡張点の項目は値に書く)`);
      continue;
    }
    if (entry.kind === "plugsList") continue;
    problems.push(`${entry.path}: ${sources} を import する常時の結線(閉じられない。ゲートの無い地区はドメインを読まず、地区が宣言した点の項目として受け取る、D22)`);
  }
  return { problems, hits };
}
