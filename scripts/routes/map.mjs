#!/usr/bin/env node
// scripts/routes/map.mjs
// ルート地図(src/app/route-map.jsonl。1 ページ 1 行の守りの鎖)を src/app から生成する。読めない鎖は生成失敗(行と理由、exit 1)。
//
// 使い方:
//   pnpm routes:map            # 地図を書き出す(ページ・loader・guard.ts を変えたら実行してコミットする)
//   pnpm routes:map --check    # 地図が生成結果と一致するか検査する(ずれていれば exit 1。pnpm test:route-map も同じ検査をする)
//   pnpm routes:show [<URL>] [--view= --scope= --access= --state= --file=]
//                              # 地図を絞り込んで描く(既定 = 段ごとの鎖。tree / table / mermaid / jsonl)。pnpm routes:show --help
//
// fork の merge で地図が衝突したら、どちらの版も採らずに pnpm routes:map で作り直す。
// 詳細: src/lib/screens/README.md §13

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { ROUTE_MAP_FILE, buildRouteMap, formatRouteMap } from "../../src/lib/screens/routeMap.mjs";
import { SHOW_USAGE, filterRows, parseRouteMapJsonl, parseShowArgs, renderRouteMap } from "../../src/lib/screens/routeMapView.mjs";
import { listAppFiles } from "../../src/lib/screens/routeTree.mjs";
import { featureGateRules } from "../../src/proxies/extensions/featureGateRules.ts";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const args = process.argv.slice(2).filter((arg) => arg !== "--");
const read = (rel) => readFileSync(path.join(repoRoot, rel), "utf8");

// show の引数は地図を作る前に読む(--file なら src/app から作り直さない)
const show = args[0] === "show" ? parseShowArgs(args.slice(1)) : null;
if (show && !show.ok) {
  console.error(`✗ ${show.error}\n`);
  process.stderr.write(SHOW_USAGE);
  process.exit(2);
}
if (show?.opts.help) {
  process.stdout.write(SHOW_USAGE);
  process.exit(0);
}
if (show?.opts.file) {
  const rows = parseRouteMapJsonl(readFileSync(path.resolve(process.cwd(), show.opts.file), "utf8"));
  process.stdout.write(renderRouteMap(filterRows(rows, show.opts), show.opts.view));
  process.exit(0);
}

// 止めているルート(機能を閉じる規則のうち無効なもの)は state を gated-off にする。規則の .ts を読むので tsx で動かす
const { rows, problems } = buildRouteMap({ files: listAppFiles(repoRoot), read, gateRules: featureGateRules });
if (problems.length > 0) {
  for (const problem of problems) console.error(`✗ ${problem}`);
  process.exit(1);
}

if (show) {
  // src/app から作り直した行を描く(コミット前の変更も映る)。コミットされた地図とずれていれば 1 行知らせる
  const committed = path.join(repoRoot, ROUTE_MAP_FILE);
  if (!existsSync(committed) || readFileSync(committed, "utf8") !== formatRouteMap(rows)) {
    console.error(`! 地図が古い: ${ROUTE_MAP_FILE} が src/app と一致しない(表示は src/app から作り直した値)。pnpm routes:map で作り直す`);
  }
  process.stdout.write(renderRouteMap(filterRows(rows, show.opts), show.opts.view));
  process.exit(0);
}

const content = formatRouteMap(rows);
const file = path.join(repoRoot, ROUTE_MAP_FILE);

if (args.includes("--check")) {
  const current = existsSync(file) ? readFileSync(file, "utf8") : null;
  if (current !== content) {
    console.error(
      `✗ ${ROUTE_MAP_FILE} が src/app からの生成結果と一致しません${current === null ? "(ファイルが無い)" : ""}。\n` +
        "  pnpm routes:map で作り直し、差分(方針の変化)を確かめてコミットしてください",
    );
    process.exit(1);
  }
  console.log(`✓ ${ROUTE_MAP_FILE} は最新です(${rows.length} ページ)`);
  process.exit(0);
}

writeFileSync(file, content);
console.log(`✓ ${ROUTE_MAP_FILE} を生成しました(${rows.length} ページ)`);
