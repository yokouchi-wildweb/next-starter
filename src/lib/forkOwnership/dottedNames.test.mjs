// 実行: pnpm test:fork-ids
import assert from "node:assert/strict";
import { test } from "node:test";

import { MARKER_MIGRATION_NOTICE, classifyDottedName, oldMarkerProblem } from "./dottedNames.mjs";

test("classifyDottedName: 印なし・.default・.replace・.override・.client・テスト・それ以外 = 旧い印", () => {
  assert.deepEqual(classifyDottedName("alpha.ts"), { base: "alpha", kind: "plain", ext: "ts" });
  assert.equal(classifyDottedName("enricher.default.ts").kind, "default");
  assert.equal(classifyDottedName("UserLayout.replace.tsx").kind, "replace");
  assert.equal(classifyDottedName("AppProviders.client.tsx").kind, "client");
  assert.deepEqual(classifyDottedName("user.role.override.ts"), { base: "user", kind: "override", target: "user.role", ext: "ts" });
  assert.equal(classifyDottedName("a.override.ts").target, "a");
  assert.equal(classifyDottedName("zeta.test.ts").kind, "test");
  assert.equal(classifyDottedName("x.d.ts").kind, "test");
  assert.deepEqual(classifyDottedName("alpha.acme.ts"), { base: "alpha", kind: "marker", marker: "acme", ext: "ts" });
  assert.equal(classifyDottedName("AppProviders.client.acme.tsx").marker, "client.acme");
  assert.equal(classifyDottedName("x.a.b.ts").marker, "a.b");
  assert.equal(classifyDottedName("x.replace.default.ts").kind, "marker", "組み合わせは受けない");
  assert.equal(classifyDottedName("alwaysOnExceptions.acme.mjs").kind, "marker");
  assert.deepEqual(classifyDottedName("beta", { folder: true }), { base: "beta", kind: "plain", ext: "" });
  assert.equal(classifyDottedName("beta.acme", { folder: true }).kind, "marker");
  assert.equal(classifyDottedName("dbAgent", {}).kind, "plain", "拡張子なしのフォルダ名");
});

test("oldMarkerProblem: 改名の先と移し方の notice を名指す", () => {
  const text = oldMarkerProblem("src/x/alpha.acme.ts", "alpha.ts");
  assert.match(text, /alpha\.ts に改名/);
  assert.ok(text.includes(MARKER_MIGRATION_NOTICE));
});
