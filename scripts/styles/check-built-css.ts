// scripts/styles/check-built-css.ts
//
// ビルド済み CSS に、global.css から @import で辿れる全ファイルが取り込まれているかを検査する。
// `pnpm build` の末尾(next build の直後)で走り、抜けがあればビルドを落とす(fail-closed)。
//
// 使い方:
//   pnpm styles:check-build                       # .next/static を検査
//   pnpm styles:check-build -- --dir <出力dir>     # 出力ディレクトリを指定
//   pnpm styles:check-build -- --verbose          # ファイルごとの宣言数を表示
//
// 背景・判定・限界は builtCss.ts 冒頭と src/styles/README.md「デプロイ後の確認(Vercel ビルドキャッシュ)」。

import { readFileSync } from "node:fs";
import path from "node:path";

import { checkBuiltCss, findCssFiles, resolveImportGraph } from "./builtCss";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const ENTRY = "src/styles/global.css";

const args = process.argv.slice(2);
const verbose = args.includes("--verbose");
const dirIndex = args.indexOf("--dir");
const outDir = path.resolve(repoRoot, dirIndex !== -1 && args[dirIndex + 1] ? args[dirIndex + 1] : ".next/static");

const sources = resolveImportGraph(path.resolve(repoRoot, ENTRY), repoRoot);
const cssFiles = findCssFiles(outDir);

if (cssFiles.length === 0) {
  console.error(`✗ styles:check-build: ビルド済み CSS が見つかりません: ${path.relative(repoRoot, outDir)}`);
  console.error("  next build の後に実行してください(pnpm build は自動で実行します)。");
  process.exit(1);
}

const builtCss = cssFiles.map((f) => readFileSync(f, "utf8")).join("\n");
const report = checkBuiltCss(sources, builtCss);

if (verbose) {
  for (const s of sources) {
    console.log(`  ${s.file}: ${s.names.length} 変数`);
  }
  console.log(`  出力: ${cssFiles.map((f) => path.relative(repoRoot, f)).join(", ")}`);
}

for (const file of report.unverifiable) {
  console.warn(
    `⚠ styles:check-build: ${file} は他のファイルにもある名前しか宣言していないため、抜けても検出できません。` +
      "fork 独自の変数を 1 つ宣言すると検査対象になります(src/styles/README.md)。",
  );
}

if (report.missing.length > 0) {
  console.error("✗ styles:check-build: ビルド済み CSS に取り込まれていない @import 先があります:");
  for (const m of report.missing) {
    console.error(`    ${m.file}: ${m.names.slice(0, 5).join(", ")}${m.names.length > 5 ? ` 他 ${m.names.length - 5}` : ""}`);
  }
  console.error(`
  典型的な原因: Vercel が古いビルドキャッシュを復元し、キャッシュ作成後に足された CSS ファイルを
  出力に反映できなかった(ローカルの next build は正常)。
  直し方: キャッシュを使わずに再デプロイする。
    - vercel CLI:  pnpm deploy:all -- --prod --force
    - ダッシュボード: Deployments → Redeploy で「Use existing Build Cache」を外す
    - 環境変数:  VERCEL_FORCE_NO_BUILD_CACHE=1 を一時的に設定して再デプロイし、成功後に外す
  ローカルで出た場合は .next を消して再ビルドする。詳細: src/styles/README.md
`);
  process.exit(1);
}

console.log(
  `✓ styles:check-build: ${sources.length} ファイル / ${report.checked} 変数が ${cssFiles.length} 個のビルド済み CSS に揃っています`,
);
