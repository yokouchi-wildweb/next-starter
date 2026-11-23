// scripts/structure/next-config/lib.mjs
// next の設定の検査の判定(純関数)。入口は check.ts、説明は README.md。
// 各リポの素の next.config.ts(型 5 self)を解いた最後の設定に、上流の約束が残っているかを見る(eslint の requiredRules と同じ作り、D300)。

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * next.config の default export を Next と同じ手順で解く: 関数なら (phase, { defaultConfig }) で呼んで待つ
 * @param {unknown} exported 素の next.config.ts の default export
 * @param {{ phase: string, defaultConfig: Record<string, unknown> }} context
 * @returns {Promise<Record<string, unknown>>}
 */
export async function resolveConfig(exported, { phase, defaultConfig }) {
  const value = typeof exported === "function" ? await exported(phase, { defaultConfig }) : await exported;
  return /** @type {Record<string, unknown>} */ (value ?? {});
}

/** rewrites() の結果(配列か beforeFiles / afterFiles / fallback の組)を 1 本の並びにする */
function flattenRewrites(/** @type {unknown} */ rewrites) {
  if (Array.isArray(rewrites)) return rewrites;
  if (rewrites && typeof rewrites === "object") {
    const groups = /** @type {Record<string, unknown>} */ (rewrites);
    return ["beforeFiles", "afterFiles", "fallback"].flatMap((key) => (Array.isArray(groups[key]) ? groups[key] : []));
  }
  return [];
}

const FIREBASE_AUTH_SOURCE = "/__/:path*";
const FIREBASE_AUTH_DESTINATION = /^https:\/\/[^/]+\.web\.app\/__\/:path\*$/;

/** 許可の 1 本の同じ(protocol・hostname・port・pathname・search) */
const samePattern = (/** @type {Record<string, unknown>} */ a, /** @type {Record<string, unknown>} */ b) =>
  ["protocol", "hostname", "port", "pathname", "search"].every((key) => (a[key] ?? "") === (b[key] ?? ""));

/**
 * ホスト全体を許していないか: hostname に * が無く、pathname の最初の段が固定(無い・/** だけ・/* で始まるのは全体)
 * @param {Record<string, unknown> | URL} pattern
 */
function isNarrow(pattern) {
  const hostname = String(pattern.hostname ?? "");
  const pathname = String(pattern.pathname ?? "");
  if (hostname === "" || hostname.includes("*")) return false;
  const first = pathname.split("/")[1] ?? "";
  return pathname.startsWith("/") && first !== "" && !first.includes("*");
}

/**
 * 解いた設定の約束を見る(1 つの約束に 1 行)
 * @param {Record<string, any>} config 解いた最後の設定
 * @param {{ tier1: boolean, appEnv: string, corePatterns: Record<string, unknown>[], rewrites?: unknown, buildId?: unknown }} expected
 *   tier1 = readForkIdentity の isTier1、appEnv = getAppEnv()、corePatterns = 本体の imageRemotePatterns(同じ env で計算した上流の置き場)、
 *   rewrites = await config.rewrites()、buildId = await config.generateBuildId()(呼び出しは check.ts。関数でなければ undefined)
 * @returns {string[]} problems
 */
export function checkConfig(config, expected) {
  const problems = [];
  const env = config?.env ?? {};
  if (env.FEATURE_GATE_TIER1 !== String(expected.tier1)) {
    problems.push(`env.FEATURE_GATE_TIER1 が ${JSON.stringify(env.FEATURE_GATE_TIER1)}(${String(expected.tier1)} であること。本体の featureGateTier1 = repo.json の名前から。読み手 src/featureGate/openSwitch.ts)`);
  }
  if (env.APP_ENV !== expected.appEnv) {
    problems.push(`env.APP_ENV が ${JSON.stringify(env.APP_ENV)}(getAppEnv() の ${JSON.stringify(expected.appEnv)} であること。client の段階の答え、@/lib/appEnv)`);
  }
  if (typeof config?.generateBuildId !== "function") {
    problems.push("generateBuildId が無い(ビルドごとの番号。本体のまま残す)");
  } else if (typeof env.NEXT_BUILD_ID !== "string" || expected.buildId !== env.NEXT_BUILD_ID) {
    problems.push(`generateBuildId の答え(${JSON.stringify(expected.buildId)})が env.NEXT_BUILD_ID(${JSON.stringify(env.NEXT_BUILD_ID)})と違う(読み手 /api/health のデプロイの検知)`);
  }
  const patterns = Array.isArray(config?.images?.remotePatterns) ? config.images.remotePatterns : [];
  for (const core of expected.corePatterns) {
    if (!patterns.some((pattern) => typeof pattern === "object" && samePattern(pattern, core))) {
      problems.push(`images.remotePatterns に上流の置き場が無い(${core.hostname}${core.pathname ?? ""})。本体の imageRemotePatterns を残して足す`);
    }
  }
  for (const pattern of patterns) {
    const value = pattern instanceof URL ? pattern : /** @type {Record<string, unknown>} */ (pattern);
    if (!isNarrow(value)) {
      problems.push(`images.remotePatterns がホスト全体を許している(${String(value.hostname ?? "")}${String(value.pathname ?? "")})。自分の置き場のパスに絞る(ホスト全体は画像最適化の課金枠の踏み台になる)`);
    }
  }
  const rewrites = flattenRewrites(expected.rewrites);
  if (!rewrites.some((rule) => rule?.source === FIREBASE_AUTH_SOURCE && FIREBASE_AUTH_DESTINATION.test(String(rule?.destination ?? "")))) {
    problems.push(`rewrites に Firebase の認証の転送(${FIREBASE_AUTH_SOURCE} → https://<project>.web.app/__/:path*)が無い(本体の rewrites を残して足す)`);
  }
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
const isApiRoute = (/** @type {string} */ route) => route === "/api" || route.startsWith("/api/");

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
