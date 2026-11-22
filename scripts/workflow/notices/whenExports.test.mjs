// scripts/workflow/notices/whenExports.test.mjs
// /ship の促し(D28): 規則の when が指せる値(ドメインの config.ts の最上位の真偽の export)の消えた・改名を基準と HEAD の木の差で出す。実行: pnpm test scripts/workflow/notices/whenExports.test.mjs

import assert from "node:assert/strict";
import { test } from "node:test";

import { goneWhenExports, whenSurfaceOf } from "./whenExports.mjs";

const surface = (files) => whenSurfaceOf(Object.keys(files), (path) => files[path] ?? null);

test("消えた・改名・真偽でなくなった値を出し、同じ config.ts に増えた真偽を候補に、上流の規則が指していた名前に印", () => {
  const base = surface({
    "src/domains/core/shop/config.ts": "export const open: boolean = true;\nexport const legacy = false;\nexport const flag: boolean = true;\n",
    "src/domains/gone/config.ts": "export const on = true;\n",
    "src/domains/_template/config.ts": "export const x = true;\n",
    "src/featureGate/rules/shop.ts": 'export const rule = { pathPatterns: ["/s"], when: ["shop.legacy"], defaultEnabled: true };\n',
  });
  const head = surface({
    "src/domains/core/shop/config.ts": 'export const open: boolean = true;\nexport const isOpenNow: boolean = true;\nexport const flag = "x";\n',
    "src/featureGate/rules/shop.ts": 'export const rule = { pathPatterns: ["/s"], when: ["shop.isOpenNow"], defaultEnabled: true };\n',
  });
  const gone = goneWhenExports(base, head);
  assert.deepEqual(gone.map((g) => g.ref), ["shop.flag", "shop.legacy", "gone.on"]);
  assert.deepEqual(gone.find((g) => g.ref === "shop.legacy"), { ref: "shop.legacy", config: "src/domains/core/shop/config.ts", candidates: ["shop.isOpenNow"], pointedBy: ["src/featureGate/rules/shop.ts"] });
  assert.deepEqual(gone.find((g) => g.ref === "gone.on")?.candidates, [], "config.ts ごと消えたら候補なし");
});

test("変わらなければ何も出さない", () => {
  const files = { "src/domains/shop/config.ts": "export const open: boolean = true;\n" };
  assert.deepEqual(goneWhenExports(surface(files), surface(files)), []);
});
