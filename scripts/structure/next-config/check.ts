// scripts/structure/next-config/check.ts
// next の設定の検査の入口(段階の対象)。説明は README.md。
// - 段階 build:post(pnpm build の next build の後): build の成果物(.next)を見る(設定・/api の静的な route・殻に入れない範囲の殻と会員の枠)。
//   成果物が無い = exit 2(未検証、通過ではない)
// - それ以外(段階 build・ship・手で pnpm check next-config): 素の next.config.ts を Next と同じ手順で解き、上流の約束を見る。
//   git は読まない(.git の無い Vercel の build でも回る。名前は repo.json、段階は env)
// 問題あり = exit 1

import { readFileSync } from "node:fs";

import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { defaultConfig } from "next/dist/server/config-shared";

import { getAppEnv } from "@/lib/appEnv";
import { readForkIdentity } from "@/lib/forkOwnership/node.mjs";

import { ROUTE_MAP_FILE, parseRouteMapJsonl } from "../../../src/lib/screens/node.mjs";

import { checkBuild, checkConfig, checkShells, resolveConfig } from "./lib.mjs";

async function main() {
  if (process.env.PHASE === "build:post") {
    const result = checkBuild(".next");
    if (!result) {
      console.error("未検証: .next に build の成果物(required-server-files.json・prerender-manifest.json)が無い(先に next build)");
      process.exit(2);
    }
    if (result.problems.length > 0) {
      console.error(`next の設定の build の検査:\n${result.problems.join("\n")}`);
      process.exit(1);
    }
    console.log(`✓ cacheComponents=true で build、/api の下に静的な route は無い(静的な route ${result.staticRoutes} 本)`);
    const shells = checkShells(".next", parseRouteMapJsonl(readFileSync(ROUTE_MAP_FILE, "utf8")));
    if (!shells) {
      console.error("未検証: .next/server/app に殻の HTML が無い(先に next build)");
      process.exit(2);
    }
    if (shells.problems.length > 0) {
      console.error(`殻の検査(D50・D55・D57: 管理・ログイン必須・debug の見える中身は殻に入れない、公開の会員の枠は殻に入る):\n${shells.problems.join("\n")}`);
      process.exit(1);
    }
    console.log(`✓ 殻: 殻に入れない範囲 ${shells.holePages} ページに見える文字・メニューなし、公開の会員の枠のページ ${shells.framedPages} 本の殻に枠あり`);
    return;
  }
  const plain = (await import("../../../next.config")) as { default: unknown };
  const core = (await import("../../../next.config.core")) as { imageRemotePatterns: Record<string, unknown>[] };
  const config = await resolveConfig(plain.default, { phase: PHASE_PRODUCTION_BUILD, defaultConfig: defaultConfig as Record<string, unknown> });
  const call = async (fn: unknown) => (typeof fn === "function" ? await (fn as () => unknown)() : undefined);
  const problems = checkConfig(config, {
    tier1: readForkIdentity(process.cwd()).isTier1,
    appEnv: getAppEnv(),
    corePatterns: core.imageRemotePatterns,
    rewrites: await call(config.rewrites),
    buildId: await call(config.generateBuildId),
  });
  if (problems.length > 0) {
    console.error(`next の設定の検査(素の next.config.ts を解いた最後の設定):\n${problems.join("\n")}`);
    process.exit(1);
  }
  console.log("✓ next.config: 門番の Tier1・段階・build の番号・画像の許可・Firebase の認証の転送・cacheComponents・partialPrefetching");
}

void main();
