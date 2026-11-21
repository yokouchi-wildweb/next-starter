// scripts/structure/cache-components/lib.test.mjs
// cacheComponents の検査の判定。実行: pnpm test scripts/structure/cache-components/lib.test.mjs(門 cache-components の check も回す)

import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { checkBuild, checkConfig } from "./lib.mjs";

test("checkConfig: cacheComponents が true・partialPrefetching が boolean なら通る", () => {
  assert.deepEqual(checkConfig({ cacheComponents: true, partialPrefetching: false }), []);
  assert.deepEqual(checkConfig({ cacheComponents: true, partialPrefetching: true }), []);
  assert.equal(checkConfig({ cacheComponents: false, partialPrefetching: false }).length, 1);
  assert.equal(checkConfig({ partialPrefetching: false }).length, 1);
  assert.equal(checkConfig({ cacheComponents: true }).length, 1);
  assert.equal(checkConfig({}).length, 2);
});

test("checkBuild: 成果物が無ければ null、true で /api の静的な route が無ければ通る、あれば名指す", () => {
  const dist = mkdtempSync(join(tmpdir(), "cc-build-"));
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
