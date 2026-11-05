// src/featureGate/checks/alwaysOnEntries.mjs
// 常時実行の入口の閉じ漏れの判定(D17・D30・D20 K4)。字面で読むだけの純関数(Node 組み込みも使わない)。
//
// 機能を閉じる規則(features を持つもの)の機能が無効なら、その表は db:push で作られない。それでも常に動く処理が
// その機能のフォルダを import していたら、無効なときに無い表を読む。そこで常時実行の入口ごとに「閉じられるか」を見る:
// - cron の task.ts(種類 cronTask): タスクの住所 /api/cron/<name> を、import した機能のフォルダを features に持つ規則の全部が
//   pathPatterns で覆う(閉じた機能のタスクは route・pnpm task・cron:generate が住所で飛ばす。enabled は見ない)
// - 宣言の alwaysOn: true の点の項目(後片付け・照合、種類 alwaysOnItem): enabled(config を読む同期関数)がある(式の中身までは見ない)
// - fork の手書きの登録表: import した名前の使い所(import 行以外)が全部 `...(<条件> ? [ ... ] : [])` の内側
// - それ以外(常に読み込まれる結線など): 理由付きの例外表にある
// 限界: 直接の import だけを見る(別のモジュールを経由した到達は見ない)。型だけの import は数えない。
// 使い手: src/featureGate/checks/featureGate.test.mjs(実リポ)、scripts/proxies/proxyFrame.test.mjs(fixture)

import { oldMarkerProblem } from "../../lib/forkOwnership/dottedNames.mjs";
import { matchesPath } from "../../lib/pathPattern/index.mjs";

/** 機能のフォルダ(src/features からの相対)を import 元の印に。core は `@/features/core/<x>/` と `@/features/<x>/` の両方 */
export function folderSourcePattern(folder) {
  const escaped = folder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const alias = folder.startsWith("core/") ? `|${folder.slice("core/".length).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}` : "";
  return new RegExp(`^@/features/(?:${escaped}${alias})(?:/|$)`);
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

const CONDITIONAL_SPREAD = /\.\.\.\(\s*[^?;]+\?\s*\[([^\]]*)\]\s*:\s*\[\s*\]\s*\)/g;

/** 登録表: 名前の使い所(import 文の外)が全部条件つき spread の内側か。外にある名前を返す */
export function namesOutsideConditionalSpread(text, names) {
  const withoutImports = text.replace(STATIC_IMPORT, (m) => " ".repeat(m.length));
  const ranges = [...withoutImports.matchAll(CONDITIONAL_SPREAD)].map((m) => [m.index, m.index + m[0].length]);
  return names.filter((name) => {
    const uses = [...withoutImports.matchAll(new RegExp(`(?<![\\w$.])${name.replace(/\$/g, "\\$")}(?![\\w$])`, "g"))];
    return uses.some((use) => !ranges.some(([start, end]) => use.index >= start && use.index < end));
  });
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
 * @param {string[]} sources import 元(@/features/…)
 * @param {{ name: string, features?: string[], pathPatterns: string[] }[]} rules
 */
export function rulesNotCoveringCronTask(taskPath, sources, rules) {
  const owners = rules.filter((rule) => (rule.features ?? []).some((folder) => sources.some((source) => folderSourcePattern(folder).test(source))));
  return owners.filter((rule) => !rule.pathPatterns.some((pattern) => matchesPath(taskPath, pattern))).map((rule) => rule.name);
}

// 規則のファイル(src/featureGate/rules/)が自分の機能のドメインの config(src/features/<d>/config.ts、入切の値だけ)を読むのは閉じ漏れでない
// (L1.18: 入切の値は各機能のドメインの config。dc:generate の closable のひな形がこの形を書く)。config が値以外に届くかは到達の検査
// (test:feature-gate:reach: 入口から services・drizzle・server-only に届かない)が見る
const RULE_FILE = /^src\/featureGate\/rules\//;
const DOMAIN_CONFIG = /^@\/features\/(?:core\/)?[^/]+\/config$/;
export const isRuleConfigImport = (path, source) => RULE_FILE.test(path) && DOMAIN_CONFIG.test(source);

/**
 * 入口の判定
 * @param {{ path: string, text: string, kind: "cronTask" | "alwaysOnItem" | "registry" | "wiring" }[]} entries
 * @param {{ name: string, features?: string[], pathPatterns: string[] }[]} rules 規則(features を持つものが対象。cronTask の住所の判定にも使う)
 * @param {Record<string, string>} exceptions 結線の例外表(path → 理由)
 * @returns {{ problems: string[], hits: string[], usedExceptions: string[] }} hits = 該当した入口(path: 種類)
 */
export function judgeAlwaysOnEntries(entries, rules, exceptions) {
  const folders = [...new Set(rules.flatMap((rule) => rule.features ?? []))];
  const patterns = folders.map(folderSourcePattern);
  const problems = [];
  const hits = [];
  const usedExceptions = [];
  for (const entry of entries) {
    const imports = gatedImports(entry.text, patterns).filter((i) => !isRuleConfigImport(entry.path, i.source));
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
          `${entry.path}: ${sources} を import するのに、規則 ${name} の pathPatterns が ${taskPath} を覆わない(src/featureGate/rules/${name}.ts の pathPatterns に "${taskPath}" を足す。閉じた機能のタスクは住所で飛ぶ)`,
        );
      }
      continue;
    }
    if (entry.kind === "alwaysOnItem") {
      if (!itemHasEnabled(entry.text)) problems.push(`${entry.path}: ${sources} を import するのに enabled が無い(拡張点の項目は値に書く)`);
      continue;
    }
    if (entry.kind === "registry") {
      const unnamed = imports.filter((i) => i.names === null);
      const outside = namesOutsideConditionalSpread(entry.text, imports.flatMap((i) => i.names ?? []));
      if (unnamed.length > 0 || outside.length > 0) {
        problems.push(
          `${entry.path}: ${[...outside, ...unnamed.map((i) => i.source)].join(", ")} が条件つき spread(...(<条件> ? [x] : []))の外で使われている`,
        );
      }
      continue;
    }
    if (entry.path in exceptions) usedExceptions.push(entry.path);
    else problems.push(`${entry.path}: ${sources} を import する常時の結線(閉じられない。理由を書いて例外表へ、または import をやめる)`);
  }
  for (const path of Object.keys(exceptions)) {
    if (!usedExceptions.includes(path)) problems.push(`${path}: 例外表の行が当たらない(実在しない・もう import していない → 行を消す)`);
  }
  return { problems, hits, usedExceptions };
}

// ── fork の口(L1.24) ──
// fork は自分の常時の登録表と、常に読み込む結線の例外を、門番の受け口
// src/featureGate/alwaysOnExceptions/<名前>.ts に 1 項目 1 ファイルで理由つきで足す(上流の表は編集しない。名前に fork の印は付けない):
//   export const exception: AlwaysOnException = { file: "src/wiring/foo.ts", reason: "<閉じなくてよい理由>" };
//   または export const registry: AlwaysOnException = { file: "src/registry/fooCleanup.ts", reason: "<常に読まれる理由>" };
// どちらか 1 つ(生成器が止める)、reason は必須(空は失敗)、縮む表の規則(当たらない例外の行は失敗)は fork の行にも掛かる。
// 生成一覧: src/featureGate/extensions/alwaysOnExceptions.ts・alwaysOnRegistries.ts。
// 旧い置き場(scripts/proxies/alwaysOnExceptions/<名前>.mjs と scripts/proxies/alwaysOnExceptions.<fork ID>.mjs)は止めて移し方を案内する。

export const ALWAYS_ON_DIR = "alwaysOnExceptions";
const NEW_PLACE = "src/featureGate/alwaysOnExceptions/<名前>.ts";

/**
 * 旧い置き場のファイルを止める
 * @param {string[]} rootNames scripts/proxies 直下の名前(ファイルとフォルダ)
 * @param {string[]} oldItems 旧い受け口 scripts/proxies/alwaysOnExceptions/ 直下の名前
 * @returns {string[]} problems
 */
export function staleAlwaysOnFiles(rootNames, oldItems = []) {
  return [
    ...rootNames
      .filter((name) => name.startsWith(`${ALWAYS_ON_DIR}.`))
      .map((name) => `${oldMarkerProblem(`scripts/proxies/${name}`, `${ALWAYS_ON_DIR}/<名前>.mjs`)}。行ごとに 1 ファイル(export const exception か registry)に分け、置き場は ${NEW_PLACE}`),
    ...oldItems.map((name) => `scripts/proxies/${ALWAYS_ON_DIR}/${name}: 置き場が ${NEW_PLACE} に移った(中身は同じ、拡張子を .ts にして型 AlwaysOnException を付け、pnpm extensions:generate)`),
  ];
}

/**
 * 受け口の生成一覧から、例外と登録表を集める(reason の空を止める)
 * @param {{ exceptions: { file: string, reason: string }[], registries: { file: string, reason: string }[] }} lists
 * @returns {{ exceptions: Record<string, string>, registries: string[], problems: string[] }}
 */
export function readForkAlwaysOn({ exceptions: exceptionRows, registries: registryRows }) {
  const exceptions = {};
  const registries = [];
  const problems = [];
  const valid = (row) => row && typeof row.file === "string" && row.file.length > 0 && typeof row.reason === "string" && row.reason.trim().length > 0;
  for (const [kind, rows] of [["exception", exceptionRows], ["registry", registryRows]]) {
    for (const row of rows) {
      if (!valid(row)) {
        problems.push(`src/featureGate/${ALWAYS_ON_DIR}(${row?.file ?? "?"}): ${kind} は { file, reason }(reason は空でない)`);
        continue;
      }
      if (kind === "exception") exceptions[row.file] = row.reason;
      else registries.push(row.file);
    }
  }
  return { exceptions, registries, problems };
}
