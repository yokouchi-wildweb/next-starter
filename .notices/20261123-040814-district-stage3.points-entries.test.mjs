// .notices/20261123-040814-district-stage3.points-entries.test.mjs
// 型だけの入口への書き換えの道具(./20261123-040814-district-stage3.points-entries.mjs、注文 37)のテスト。実行: node --test .notices/20261123-040814-district-stage3.points-entries.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";

import { pointsExportsOf, rewriteItem } from "./20261123-040814-district-stage3.points-entries.mjs";

const entries = [
  { alias: "@/proxies", entry: "@/proxies/points", names: pointsExportsOf('export type { ProxyContext, ProxyHandler } from "./types";\n') },
  { alias: "@/lib/mail", entry: "@/lib/mail/points", names: pointsExportsOf('export type { MailFrameProps } from "./frame/MailFrame.default";\n') },
];

test("型の名前だけを入口へ分け、値は元に残す。名前だけになった元の import は消し、2 回目は何もしない", () => {
  const src = '// x\nimport type { ProxyContext, ProxyHandler } from "@/proxies/types";\nimport { MAIL_THEME_COLORS, MailFrameProps, type MailTheme } from "@/lib/mail";\nimport { z } from "zod";\n\nexport const a = 1;\n';
  const r = rewriteItem(src, entries);
  assert.deepEqual(r.stops, []);
  assert.deepEqual(r.moved.map((m) => `${m.from}→${m.entry}:${m.names.join(",")}`), ["@/proxies/types→@/proxies/points:ProxyContext,ProxyHandler", "@/lib/mail→@/lib/mail/points:MailFrameProps"]);
  assert.match(r.text, /^import \{ MAIL_THEME_COLORS, type MailTheme \} from "@\/lib\/mail";$/m);
  assert.doesNotMatch(r.text, /@\/proxies\/types/);
  assert.match(r.text, /import \{ z \} from "zod";\nimport type \{ ProxyContext, ProxyHandler \} from "@\/proxies\/points";\nimport type \{ MailFrameProps \} from "@\/lib\/mail\/points";\n/);
  assert.deepEqual(rewriteItem(r.text, entries).moved, []);
});

test("default・namespace の import に入口の型が混じりうる物は止める。入口の外の持ち主は触らない", () => {
  assert.equal(rewriteItem('import * as P from "@/proxies/types";\n', entries).stops.length, 1);
  assert.equal(rewriteItem('import D, { ProxyHandler } from "@/proxies/types";\n', entries).stops.length, 1);
  assert.deepEqual(rewriteItem('import type { X } from "@/lib/other";\n', entries).moved, []);
});
