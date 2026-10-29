// scripts/styles/generate-frame-controls-css.ts
// 枠の部位一覧(src/components/AppFrames/User/controls/frameParts.ts)から src/styles/_base/frame-controls.generated.css を生成する。
//
// 使い方:
//   pnpm frame:generate            # CSS を書き出す(部位一覧を変えたら実行してコミットする)
//   pnpm frame:generate --check    # CSS が生成結果と一致するか検査する(ずれていれば exit 1。pnpm test:frame-controls も同じ検査をする)
//
// 方針(生成物コミット方式、前例 gradient:gen): 本番ビルドは生成済み CSS をそのまま使い、ビルド手順は変えない。

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { buildFrameControlsCss } from "@/components/AppFrames/User/controls/frameParts";

const OUTPUT_PATH = "src/styles/_base/frame-controls.generated.css";

const args = process.argv.slice(2).filter((arg) => arg !== "--");
const file = path.resolve(process.cwd(), OUTPUT_PATH);
const content = buildFrameControlsCss();

if (args.includes("--check")) {
  const current = existsSync(file) ? readFileSync(file, "utf8") : null;
  if (current !== content) {
    console.error(
      `✗ ${OUTPUT_PATH} が frameParts.ts からの生成結果と一致しません${current === null ? "(ファイルが無い)" : ""}。\n` +
        "  pnpm frame:generate で作り直してコミットしてください",
    );
    process.exit(1);
  }
  console.log(`✓ ${OUTPUT_PATH} は最新です`);
  process.exit(0);
}

writeFileSync(file, content);
console.log(`✓ ${OUTPUT_PATH} を生成しました`);
