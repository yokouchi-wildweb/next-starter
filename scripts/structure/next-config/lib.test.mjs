// scripts/structure/next-config/lib.test.mjs
// next の設定の検査の判定。実行: pnpm test scripts/structure/next-config/lib.test.mjs(段階の next-config の check も回す)

import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { checkBuild, checkConfig, resolveConfig } from "./lib.mjs";

const CORE_PATTERNS = [{ protocol: "https", hostname: "firebasestorage.googleapis.com", pathname: "/v0/b/bucket/o/**" }];
/** 本体のままの設定(解いた後)と、check.ts が呼んだ rewrites()・generateBuildId() の答え */
const okConfig = () => ({
  cacheComponents: true,
  partialPrefetching: false,
  generateBuildId: () => "b1",
  env: { NEXT_BUILD_ID: "b1", APP_ENV: "development", FEATURE_GATE_TIER1: "true" },
  images: { remotePatterns: [...CORE_PATTERNS] },
});
const expected = (/** @type {Record<string, unknown>} */ over = {}) => ({
  tier1: true,
  appEnv: "development",
  corePatterns: CORE_PATTERNS,
  rewrites: { fallback: [{ source: "/__/:path*", destination: "https://proj.web.app/__/:path*" }] },
  buildId: "b1",
  ...over,
});

test("checkConfig: 本体のままの設定は通る(rewrites は配列でも組でも)", () => {
  assert.deepEqual(checkConfig(okConfig(), expected()), []);
  assert.deepEqual(checkConfig(okConfig(), expected({ rewrites: [{ source: "/__/:path*", destination: "https://p.web.app/__/:path*" }] })), []);
});

test("checkConfig: 約束ごとに 1 行(Tier1・段階・build の番号・Firebase の転送・cacheComponents・partialPrefetching)", () => {
  const one = (/** @type {(c: any) => void} */ change, over = {}) => {
    const config = okConfig();
    change(config);
    return checkConfig(config, expected(over));
  };
  assert.match(one((c) => (c.env.FEATURE_GATE_TIER1 = "false")).join(), /FEATURE_GATE_TIER1/);
  assert.match(one((c) => delete c.env.APP_ENV).join(), /APP_ENV/);
  assert.match(one((c) => delete c.generateBuildId, { buildId: undefined }).join(), /generateBuildId が無い/);
  assert.match(one(() => {}, { buildId: "other" }).join(), /NEXT_BUILD_ID/);
  assert.match(one(() => {}, { rewrites: { fallback: [] } }).join(), /Firebase の認証の転送/);
  assert.match(one(() => {}, { rewrites: undefined }).join(), /Firebase の認証の転送/);
  assert.equal(one((c) => (c.cacheComponents = false)).length, 1);
  assert.equal(one((c) => delete c.partialPrefetching).length, 1);
  assert.equal(checkConfig({}, expected({ rewrites: undefined, buildId: undefined, corePatterns: [] })).length, 6);
});

test("checkConfig: remotePatterns = 上流の置き場が全部残り、どれもホスト全体を許さない(fork の CDN のパスは足してよい)", () => {
  const withPatterns = (/** @type {unknown[]} */ patterns) => {
    const config = okConfig();
    config.images.remotePatterns = /** @type {any} */ (patterns);
    return checkConfig(config, expected());
  };
  assert.deepEqual(withPatterns([...CORE_PATTERNS, { protocol: "https", hostname: "cdn.example.com", pathname: "/acme/**" }]), [], "fork の CDN のパス");
  assert.deepEqual(withPatterns([...CORE_PATTERNS, new URL("https://cdn.example.com/acme/**")]), [], "URL の形");
  assert.match(withPatterns([]).join(), /上流の置き場が無い/);
  assert.match(withPatterns([...CORE_PATTERNS, { hostname: "cdn.example.com" }]).join(), /ホスト全体/);
  assert.match(withPatterns([...CORE_PATTERNS, { hostname: "cdn.example.com", pathname: "/**" }]).join(), /ホスト全体/);
  assert.match(withPatterns([...CORE_PATTERNS, { hostname: "*.example.com", pathname: "/a/**" }]).join(), /ホスト全体/);
});

test("resolveConfig: 関数の設定は (phase, { defaultConfig }) で呼んで待つ(包む fork の設定も解ける)", async () => {
  const seen = [];
  const wrapped = async (/** @type {string} */ phase, /** @type {{ defaultConfig: object }} */ ctx) => {
    seen.push(phase, ctx.defaultConfig);
    return { ...okConfig(), extra: 1 };
  };
  const defaultConfig = { d: 1 };
  const config = await resolveConfig(wrapped, { phase: "phase-production-build", defaultConfig });
  assert.equal(config.extra, 1);
  assert.deepEqual(seen, ["phase-production-build", defaultConfig]);
  assert.equal((await resolveConfig(okConfig(), { phase: "x", defaultConfig })).cacheComponents, true);
});

test("checkBuild: 成果物が無ければ null、true で /api の静的な route が無ければ通る、あれば名指す", () => {
  const dist = mkdtempSync(join(tmpdir(), "next-config-build-"));
  try {
    assert.equal(checkBuild(dist), null);
    const put = (cacheComponents, routes) => {
      writeFileSync(join(dist, "required-server-files.json"), JSON.stringify({ config: { cacheComponents } }));
      writeFileSync(join(dist, "prerender-manifest.json"), JSON.stringify({ version: 4, routes, dynamicRoutes: {} }));
    };
    put(true, { "/_not-found": {}, "/": {} });
    assert.deepEqual(checkBuild(dist), { problems: [], staticRoutes: 2 });

    put(false, {});
    assert.equal(checkBuild(dist).problems.length, 1);
    assert.match(checkBuild(dist).problems[0], /cacheComponents=false/);

    put(true, { "/api/health": {}, "/api/x/y": {}, "/apiary": {}, "/": {} });
    const r = checkBuild(dist);
    assert.equal(r.problems.length, 2);
    assert.ok(r.problems[0].startsWith("/api/health:"));
    assert.ok(r.problems[1].startsWith("/api/x/y:"));
  } finally {
    rmSync(dist, { recursive: true, force: true });
  }
});
