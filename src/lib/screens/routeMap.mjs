// ルート地図: 全ページの「守りの鎖」を 1 ページ 1 行の構造化データ(JSON Lines)にした生成物(src/app/route-map.jsonl にコミット)。
// 主な読み手はエージェント(機械が読む)。人が見る形は pnpm routes:show。
// 生成: pnpm routes:map / ずれ検査: pnpm routes:map --check と pnpm test:route-map / 詳細の表示: pnpm routes:show
// 鎖 = page.tsx → 採用 Screen → 同じルートの loader → 最寄りの guard.ts → extend の親 → root(defineRootGuard)。
// 字面だけを読み、読めない鎖は生成失敗(problems に行と理由)。解析は checks.mjs(test:screens と共有)。
// ここは純粋関数だけ(ファイルの読み込みは呼び出し側が read を渡す)。発見は routeTree.mjs と共有。設計: src/lib/screens/README.md §13
import {
  barrelTarget,
  checkScreenLoaderCall,
  layoutCallsGuard,
  parseGuardFile,
  parseLoaderGuard,
  parseSwitchLayout,
  parseSwitchPage,
  resolveImportFile,
  stripComments,
} from "./checks.mjs";
import { patternCoversRoute } from "../../proxies/pathPattern.mjs";

import { APP_DIR, discoverRoutes } from "./routeTree.mjs";

/** 地図に書き出すファイル(repo 相対) */
export const ROUTE_MAP_FILE = "src/app/route-map.jsonl";

/** 行の状態。鎖を字面で辿れた行だけが地図に載る(読めない行は生成失敗) */
export const ROUTE_STATE_VERIFIED = "verified";

/** guard.ts のファイル名(範囲の方針。layout の隣) */
export const GUARD_FILE = "guard.ts";

/** layout が直接呼んではいけない旧方式のガード(範囲の守りは隣の guard.ts の guard() だけ) */
export const LEGACY_GUARD_CALLS = [
  "authGuard",
  "requireCurrentUser",
  "getSessionUser",
  "requireAdmin",
  "requireAuthenticated",
  "principalGuard",
  "deviceGuard",
];

const appRelative = (dir) => (dir === APP_DIR ? "/" : dir.slice(APP_DIR.length + 1));
const dirOf = (file) => file.slice(0, file.lastIndexOf("/"));

/** ページの dir から上へ最初の guard.ts(repo 相対)。無ければ null */
export function findNearestGuard(dir, fileSet) {
  for (let d = dir; d.startsWith(APP_DIR); d = d === APP_DIR ? "" : dirOf(d)) {
    const candidate = `${d}/${GUARD_FILE}`;
    if (fileSet.has(candidate)) return candidate;
    if (d === APP_DIR) break;
  }
  return null;
}

/** page.tsx の採用 Screen を実ファイルに解決する(barrel は 1 段だけ辿る)。見つからなければ null */
function resolveScreen(pageDir, target, fileSet, read) {
  const base = `${pageDir}/${target.screenDir}/${target.file}`;
  const found = [`${base}.tsx`, `${base}.ts`, `${base}/index.tsx`, `${base}/index.ts`].find((c) => fileSet.has(c));
  if (!found) return null;
  const inner = barrelTarget(read(found), target.name);
  if (inner) {
    const innerBase = `${dirOf(found)}/${inner}`;
    const innerFound = [`${innerBase}.tsx`, `${innerBase}.ts`, `${innerBase}/index.tsx`].find((c) => fileSet.has(c));
    if (innerFound) return innerFound;
  }
  return found;
}

/**
 * guard.ts から root まで親を辿る。各段 = { kind: "guard", file, policy }(近い順)。
 * @returns {{ stages: Array<{ kind: "guard", file: string, policy: Record<string, unknown> }>, problems: string[] }}
 */
export function walkGuards(guardFile, fileSet, read) {
  const stages = [];
  const problems = [];
  const seen = new Set();
  let file = guardFile;
  while (file) {
    if (seen.has(file)) {
      problems.push(`${file}: extend の親が循環している`);
      break;
    }
    seen.add(file);
    const parsed = parseGuardFile(read(file));
    for (const p of parsed.problems) problems.push(`${file}: ${p}`);
    if (!parsed.policy) break;
    stages.push({ kind: "guard", file, policy: parsed.policy });
    if (parsed.root) break;
    const parent = parsed.parentImport ? resolveImportFile(file, parsed.parentImport, fileSet) : null;
    if (!parent || !parent.endsWith(`/${GUARD_FILE}`)) {
      problems.push(`${file}: extend の親(${parsed.parentImport})が guard.ts に解決できない`);
      break;
    }
    // 親は自分より上の範囲の guard.ts(自分の dir の外側)でなければならない
    if (!dirOf(file).startsWith(`${dirOf(parent)}/`)) problems.push(`${file}: extend の親 ${parent} が祖先の範囲でない`);
    file = parent;
  }
  return { stages, problems };
}

/** layout(とスイッチ先)の守りの検査: 旧ガードの直接呼び出しは不可、隣に public でない guard.ts があれば guard() を呼ぶ */
function checkLayout(layoutFile, fileSet, read) {
  const problems = [];
  const source = read(layoutFile);
  const sources = [[layoutFile, source]];
  const { problems: switchProblems, target } = parseSwitchLayout(source);
  if (switchProblems.length === 0 && target) {
    const base = `${dirOf(layoutFile)}/${target.screenDir}/${target.file}`;
    const switchTarget = [`${base}.tsx`, `${base}.ts`, `${base}/index.tsx`].find((c) => fileSet.has(c));
    if (switchTarget) sources.push([switchTarget, read(switchTarget)]);
  }
  for (const [file, src] of sources) {
    const code = stripComments(src);
    for (const name of LEGACY_GUARD_CALLS) {
      if (new RegExp(`\\b${name}\\s*\\(`).test(code)) {
        problems.push(`${file}: layout が旧方式のガード ${name}() を直接呼んでいる(範囲の守りは隣の guard.ts の guard() の 1 行)`);
      }
    }
  }
  const guardFile = `${dirOf(layoutFile)}/${GUARD_FILE}`;
  if (fileSet.has(guardFile)) {
    const { policy } = parseGuardFile(read(guardFile));
    const needsCall = policy && policy.access !== "public";
    if (needsCall && !sources.some(([, src]) => layoutCallsGuard(src))) {
      problems.push(`${layoutFile}: 隣の guard.ts があるのに guard() を呼んでいない(await guard() の 1 行)`);
    }
  }
  return problems;
}

/**
 * 地図の元データを作る。
 * @param {{ files: string[], read: (path: string) => string, gateRules?: Array<{ pathPatterns: string[], enabled: () => boolean }> }} input
 *   files = repo 相対のファイル一覧(listAppFiles の結果)、read = repo 相対パスの中身を返す関数、
 *   gateRules = 機能を閉じる規則(生成一覧 src/proxies/extensions/featureGateRules.ts)。無効な規則に当たるルートに gatedOff を付ける
 * @returns {{ rows: Array<RouteMapRow>, problems: string[] }} problems が空でなければ生成失敗(読めない鎖)
 */
export function buildRouteMap({ files, read, gateRules = [] }) {
  const disabledRules = gateRules.filter((rule) => !rule.enabled());
  const { routes, problems } = discoverRoutes(files);
  const fileSet = new Set(files.map((f) => f.replace(/\\/g, "/")));
  const checkedLayouts = new Map();
  const rows = [];
  for (const route of routes) {
    const rowProblems = [];
    const where = `${route.key}(${route.page})`;
    for (const layout of route.layouts) {
      if (!checkedLayouts.has(layout)) checkedLayouts.set(layout, checkLayout(layout, fileSet, read));
      rowProblems.push(...checkedLayouts.get(layout));
    }
    const chain = [{ kind: "page", file: route.page }];
    const page = parseSwitchPage(read(route.page));
    const screenFile = page.problems.length === 0 && page.target ? resolveScreen(route.dir, page.target, fileSet, read) : null;
    if (!screenFile) {
      rowProblems.push(`${where}: page.tsx の 1 行スイッチから Screen を解決できない`);
    } else {
      chain.push({ kind: "screen", file: screenFile, name: page.target.name });
      const call = checkScreenLoaderCall(read(screenFile), page.target.name);
      for (const p of call.problems) rowProblems.push(`${screenFile}: ${p}`);
      const loaderFile = call.loaderImport ? resolveImportFile(screenFile, call.loaderImport, fileSet) : null;
      if (call.problems.length === 0 && !loaderFile) rowProblems.push(`${screenFile}: loader(${call.loaderImport})が見つからない`);
      if (loaderFile) {
        if (dirOf(dirOf(loaderFile)) !== route.dir) rowProblems.push(`${screenFile}: 同じルートの loader でない(${loaderFile})`);
        const loader = parseLoaderGuard(read(loaderFile));
        for (const p of loader.problems) rowProblems.push(`${loaderFile}: ${p}`);
        const guardFile = loader.guardImport ? resolveImportFile(loaderFile, loader.guardImport, fileSet) : null;
        const nearest = findNearestGuard(route.dir, fileSet);
        if (loader.problems.length === 0) {
          chain.push({
            kind: "loader",
            file: loaderFile,
            access: loader.access,
            ...(loader.allowStatuses !== null ? { allowStatuses: loader.allowStatuses } : {}),
          });
          if (!guardFile) rowProblems.push(`${loaderFile}: createLoader の import 元(${loader.guardImport})が guard.ts に解決できない`);
          else if (guardFile !== nearest) rowProblems.push(`${loaderFile}: 最寄りの guard.ts(${nearest})でない ${guardFile} の createLoader を使っている`);
          else {
            const walked = walkGuards(guardFile, fileSet, read);
            rowProblems.push(...walked.problems);
            chain.push(...walked.stages);
          }
        }
      }
    }
    const segments = route.key.split(" ")[0].split("/").filter(Boolean);
    const gated = disabledRules.find((rule) => rule.pathPatterns.some((pattern) => patternCoversRoute(pattern, segments)));
    if (rowProblems.length > 0) {
      problems.push(...rowProblems.map((p) => (p.startsWith(route.key) ? p : `${route.key}: ${p}`)));
      continue;
    }
    rows.push({
      path: route.url,
      slot: route.slots.length > 0 ? route.slots.join(",") : null,
      state: ROUTE_STATE_VERIFIED,
      gatedOff: gated ? gated.pathPatterns[0] : null,
      chain,
    });
  }
  return { rows, problems: [...new Set(problems)] };
}

/** 地図ファイルの中身(1 ページ 1 行の JSON、キーの順は固定、行は path → slot の順) */
export function formatRouteMap(rows) {
  const sorted = [...rows].sort((a, b) => (a.path === b.path ? String(a.slot ?? "").localeCompare(String(b.slot ?? "")) : a.path < b.path ? -1 : 1));
  return sorted.map((r) => JSON.stringify({ path: r.path, slot: r.slot, state: r.state, gatedOff: r.gatedOff, chain: r.chain })).join("\n") + "\n";
}

/** access の短い表示(routes:show 用) */
export function formatAccess(access) {
  if (typeof access === "string") return access;
  if (access && typeof access === "object" && "registry" in access) return `registry:${access.registry}`;
  return JSON.stringify(access);
}

/** routes:show の表示(コミットしない。人が読む形) */
export function formatRouteDetails(rows) {
  const out = [];
  for (const r of rows) {
    out.push(`${r.path}${r.slot ? ` ${r.slot}` : ""}  [${r.state}${r.gatedOff ? ` gated-off(${r.gatedOff})` : ""}]`);
    for (const stage of r.chain) {
      if (stage.kind === "page" || stage.kind === "screen") out.push(`    ${stage.kind.padEnd(6)} ${stage.file}`);
      else if (stage.kind === "loader") {
        const statuses = stage.allowStatuses ? `  allowStatuses=${JSON.stringify(stage.allowStatuses)}` : "";
        out.push(`    loader ${stage.file}  access=${formatAccess(stage.access)}${statuses}`);
      } else {
        const { access, ...rest } = stage.policy;
        const more = Object.keys(rest).length > 0 ? `  ${JSON.stringify(rest)}` : "";
        out.push(`    guard  ${appRelative(dirOf(stage.file))}  access=${formatAccess(access)}${more}`);
      }
    }
  }
  return `${out.join("\n")}\n`;
}

/**
 * @typedef {{ kind: "page", file: string }
 *   | { kind: "screen", file: string, name: string }
 *   | { kind: "loader", file: string, access: unknown, allowStatuses?: unknown }
 *   | { kind: "guard", file: string, policy: Record<string, unknown> }} RouteMapStage
 * @typedef {{ path: string, slot: string | null, state: string, gatedOff: string | null, chain: RouteMapStage[] }} RouteMapRow
 */
