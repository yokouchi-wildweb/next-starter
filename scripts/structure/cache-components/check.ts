// scripts/structure/cache-components/check.ts
// cacheComponents の検査の入口(門の対象)。説明は README.md。
// - 門 build:post(pnpm build の next build の後): build の成果物(.next)を見る。成果物が無い = exit 2(未検証、通過ではない)
// - それ以外(門 ship・手で pnpm check cache-components): next.config.ts の値を見る
// 問題あり = exit 1

import { checkBuild, checkConfig } from "./lib.mjs";

async function main() {
  if (process.env.GATE === "build:post") {
    const result = checkBuild(".next");
    if (!result) {
      console.error("未検証: .next に build の成果物(required-server-files.json・prerender-manifest.json)が無い(先に next build)");
      process.exit(2);
    }
    if (result.problems.length > 0) {
      console.error(`cacheComponents の build の検査:\n${result.problems.join("\n")}`);
      process.exit(1);
    }
    console.log(`✓ cacheComponents=true で build、/api の下に静的な route は無い(静的な route ${result.staticRoutes} 本)`);
    return;
  }
  const { default: config } = await import("../../../next.config");
  const problems = checkConfig(config as Record<string, unknown>);
  if (problems.length > 0) {
    console.error(`cacheComponents の設定の検査:\n${problems.join("\n")}`);
    process.exit(1);
  }
  console.log("✓ next.config: cacheComponents true・partialPrefetching 明示");
}

void main();
