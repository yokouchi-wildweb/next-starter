// scripts/structure/cache-components/lib.mjs
// cacheComponents の検査の判定(純関数)。入口は check.ts、説明は README.md。

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * next.config の値を見る: cacheComponents が true のまま・partialPrefetching が明示されている
 * @param {Record<string, unknown>} config next.config.ts の default export
 * @returns {string[]} problems
 */
export function checkConfig(config) {
  const problems = [];
  if (config?.cacheComponents !== true) {
    problems.push(
      `next.config の cacheComponents が true でない(${JSON.stringify(config?.cacheComponents)})。false に戻さない(fork ごとのスイッチは無い。直すべき所は build の失敗が名指す)`,
    );
  }
  if (typeof config?.partialPrefetching !== "boolean") {
    problems.push("next.config の partialPrefetching を明示する(段 3 までは false。書かないと Next が警告する)");
  }
  return problems;
}

/** 静的に焼き付いた API の route か(prerender-manifest の routes のキー) */
const isApiRoute = (route) => route === "/api" || route.startsWith("/api/");

/**
 * build の成果物を見る: cacheComponents が true で build された・/api の下に静的に焼き付いた route が無い
 * @param {string} distDir .next
 * @returns {{ problems: string[], staticRoutes: number } | null} 成果物が無ければ null(未検証)
 */
export function checkBuild(distDir) {
  const requiredPath = join(distDir, "required-server-files.json");
  const prerenderPath = join(distDir, "prerender-manifest.json");
  if (!existsSync(requiredPath) || !existsSync(prerenderPath)) return null;
  const problems = [];
  const required = JSON.parse(readFileSync(requiredPath, "utf8"));
  if (required?.config?.cacheComponents !== true) {
    problems.push(`build は cacheComponents=${JSON.stringify(required?.config?.cacheComponents)} で作られた(true のまま build する)`);
  }
  const prerender = JSON.parse(readFileSync(prerenderPath, "utf8"));
  const routes = Object.keys(prerender?.routes ?? {});
  const staticApi = routes.filter(isApiRoute).sort();
  for (const route of staticApi) {
    problems.push(
      `${route}: API の route が build で静的に焼き付いた(○)。route.ts は wiring の Factory(createApiRoute 等)で書く(最初に connection() を待つ)`,
    );
  }
  return { problems, staticRoutes: routes.length };
}
