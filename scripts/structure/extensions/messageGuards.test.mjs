// scripts/structure/extensions/messageGuards.test.mjs
// 連絡の字面の守り(./derive/messageGuards.mjs)と、連絡の上書きの点(lib/messaging の extensionPoints.ts の messages)。
// 一時ディレクトリの fork(acme、祖先 parent)の木で planExtensions を回す。種類の点(messaging の categories)・種別の性質の表は本物を写す。
// - 定義だけ・正しい上書き・項目 0 は通る
// - category: 全部の定義に必須・受け口の鍵・文面は種類の経路の分だけ(上書きでは変えられない)
// - required の定義: 種類の経路に email・adminEditable が空・throttle が無い / required への上書き: enabled:false・adminEditable・throttle を止める
// - 上流の functional の連絡は上書きで止められない(fork の木の core の定義)
// - 種類の上書き: functional・security の email は外せない、group は受け口の鍵で同じ種別だけ
// - 守りに関わる値がリテラルでない・定義の形が違う(export const message が無い)を止める / views/ の下は対象外
// 実行: pnpm test scripts/structure/extensions/messageGuards.test.mjs

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { planExtensions } from "./extensions.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
// 宣言と性質の表は本物を使う(点の glob・export・overrideOf・種別の性質を写さない)
const DECLARATION = readFileSync(join(repoRoot, "src/lib/messaging/extensionPoints.ts"), "utf8");
const MESSAGING_DECLARATION = readFileSync(join(repoRoot, "src/features/core/messaging/extensionPoints.ts"), "utf8");
const KINDS = readFileSync(join(repoRoot, "src/lib/messaging/definition/kinds.ts"), "utf8");

const categoryItem = (key, kind, channels) =>
  `import type { MessageCategory } from "@/lib/messaging";\n\nexport const category: MessageCategory = { key: "${key}", label: "${key}", kind: "${kind}", channels: ${JSON.stringify(channels)} };\n`;
const C = "src/features/core/messaging/categories/";

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), "message-guards-"));
  const put = (path, text) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  put("repo.json", '{"repo_id": "acme", "tier": "leaf"}\n');
  put(".notices/applied/parent.md", "");
  put("src/lib/CATALOG.md", "## next-starter\n\n## parent\n\n## acme\n");
  put("src/lib/messaging/extensionPoints.ts", DECLARATION);
  put("src/lib/messaging/definition/kinds.ts", KINDS);
  put("src/features/core/messaging/extensionPoints.ts", MESSAGING_DECLARATION);
  put(`${C}account.ts`, categoryItem("account", "functional", ["email"]));
  put(`${C}notice.ts`, categoryItem("notice", "transactional", ["email", "inApp"]));
  put(`${C}alert.ts`, categoryItem("alert", "security", ["email"]));
  put(`${C}inAppOnly.ts`, categoryItem("inAppOnly", "transactional", ["inApp"]));
  for (const [path, text] of Object.entries(files)) put(path, text);
  return root;
}

const M = "src/features/core/auth/messages/";
const definition = (props, category = "account") => `import { z } from "zod";
import { defineMessage } from "@/lib/messaging";

export const message = defineMessage({
  key: "auth.verification",
  category: ${category.startsWith("@") ? category.slice(1) : `"${category}"`},
  vars: z.object({ verificationUrl: z.string() }),
  ${props}
  content: { email: { subject: "確認" }, inApp: { title: "確認", body: "" } },
});
`;
const REQUIRED = definition("required: true,");
const OPTIONAL = definition('adminEditable: ["email.subject"],', "notice");
const override = (props) => `import type { MessageOverride } from "@/lib/messaging";\n\nexport const messageOverride = { ${props} } satisfies MessageOverride;\n`;
const categoryOverride = (props) => `export const override = { ${props} };\n`;

const problemsOf = (files) =>
  planExtensions(fixture(files)).problems.filter((p) => p.includes("/messages/") || p.includes("/categories/"));
const expectOne = (files, path, pattern) => {
  const problems = problemsOf(files);
  assert.equal(problems.length, 1, problems.join(" / "));
  assert.ok(problems[0].startsWith(path), problems[0]);
  assert.match(problems[0], pattern);
};

test("項目 0・定義だけ・正しい上書きは通る", () => {
  assert.deepEqual(problemsOf({}), []);
  assert.deepEqual(problemsOf({ [`${M}verification.ts`]: REQUIRED, [`${M}welcome.ts`]: OPTIONAL }), []);
  assert.deepEqual(
    problemsOf({
      [`${M}verification.ts`]: REQUIRED,
      [`${M}verification.override.ts`]: override('content: { email: { subject: "新しい件名" } }, enabled: true, adminEditable: [], throttle: null'),
      [`${M}welcome.ts`]: OPTIONAL,
      [`${M}welcome.override.ts`]: override('enabled: false, adminEditable: ["inApp.title"]'),
    }),
    [],
  );
});

test("category: 全部の定義に必須・受け口の鍵・文面は種類の経路の分だけ。上書きでは変えられない", () => {
  expectOne({ [`${M}a.ts`]: definition("", "nope") }, `${M}a.ts`, /category "nope" は categories の受け口に無い\(account \/ alert \/ inAppOnly \/ notice\)/);
  expectOne({ [`${M}a.ts`]: definition("").replace('  category: "account",\n', "") }, `${M}a.ts`, /category\(.*\)を書く/);
  expectOne({ [`${M}a.ts`]: definition("", "@CATEGORY") }, `${M}a.ts`, /category はリテラル/);
  // 種類 notice の経路は email・inApp → inApp の文面が無いと止まる
  expectOne(
    { [`${M}a.ts`]: definition("", "notice").replace(', inApp: { title: "確認", body: "" }', "") },
    `${M}a.ts`,
    /種類 notice の経路 inApp の文面/,
  );
  const problems = problemsOf({ [`${M}a.ts`]: OPTIONAL, [`${M}a.override.ts`]: override('category: "account"') });
  assert.equal(problems.length, 1, problems.join(" / "));
  assert.match(problems[0], /category は上書きできない/);
});

test("authored の定義: 文面の経路を見ない・上書きのファイルは止める", () => {
  const authored = `import { z } from "zod";
import { defineMessage } from "@/lib/messaging";

export const message = defineMessage({ key: "messaging.adminNotice", category: "notice", authored: true, vars: z.object({}), content: {} });
`;
  const A = "src/features/core/messaging/messages/";
  assert.deepEqual(problemsOf({ [`${A}adminNotice.ts`]: authored }), []);
  expectOne(
    { [`${A}adminNotice.ts`]: authored, [`${A}adminNotice.override.ts`]: override("enabled: false") },
    `${A}adminNotice.override.ts`,
    /authored の連絡.*上書きできない/,
  );
});

test("required の定義: 種類の経路に email・adminEditable・throttle を止める", () => {
  expectOne({ [`${M}a.ts`]: definition("required: true,", "inAppOnly") }, `${M}a.ts`, /"email" を含める/);
  expectOne({ [`${M}a.ts`]: definition('required: true,\n  adminEditable: ["email.subject"],') }, `${M}a.ts`, /adminEditable は付けられない/);
  expectOne(
    { [`${M}a.ts`]: definition('required: true,\n  throttle: { by: ["verificationUrl"], mode: "window", seconds: 60 },') },
    `${M}a.ts`,
    /throttle は付けられない/,
  );
});

test("required への上書き: enabled:false・adminEditable・throttle を止める", () => {
  const base = { [`${M}verification.ts`]: REQUIRED };
  const path = `${M}verification.override.ts`;
  expectOne({ ...base, [path]: override("enabled: false") }, path, /required の連絡は止められない/);
  expectOne({ ...base, [path]: override('adminEditable: ["email.subject"]') }, path, /adminEditable は付けられない/);
  expectOne({ ...base, [path]: override('throttle: { by: ["verificationUrl"], mode: "window", seconds: 60 }') }, path, /throttle は付けられない/);
});

test("上流の functional の連絡は止められない(required でなくても)、fork の自分の連絡と他の種別は止められる", () => {
  const plainFunctional = definition("");
  expectOne({ [`${M}a.ts`]: plainFunctional, [`${M}a.override.ts`]: override("enabled: false") }, `${M}a.override.ts`, /上流の種別 functional の連絡は止められない/);
  const F = "src/features/shop/messages/";
  assert.deepEqual(problemsOf({ [`${F}a.ts`]: plainFunctional.replace("auth.verification", "shop.a") }), []);
  assert.deepEqual(problemsOf({ [`${M}a.ts`]: OPTIONAL, [`${M}a.override.ts`]: override("enabled: false") }), []);
});

test("種類の上書き: functional・security の email は外せない、group は受け口の鍵で同じ種別だけ", () => {
  expectOne({ [`${C}account.override.ts`]: categoryOverride('channels: ["inApp"]') }, `${C}account.override.ts`, /email は外せない/);
  expectOne({ [`${C}alert.override.ts`]: categoryOverride('channels: ["inApp"]') }, `${C}alert.override.ts`, /email は外せない/);
  assert.deepEqual(problemsOf({ [`${C}notice.override.ts`]: categoryOverride('channels: ["inApp"], label: "知らせ"') }), []);
  const G = "src/features/core/messaging/categoryGroups/";
  const group = `export const group = { key: "social", label: "交流", order: 1 };\n`;
  expectOne({ [`${C}notice.override.ts`]: categoryOverride('group: "nope"') }, `${C}notice.ts`, /group nope は categoryGroups の受け口に無い/);
  assert.deepEqual(
    problemsOf({
      [`${G}social.ts`]: group,
      [`${C}notice.override.ts`]: categoryOverride('group: "social"'),
      [`${C}inAppOnly.override.ts`]: categoryOverride('group: "social"'),
    }),
    [],
  );
  const mixed = problemsOf({
    [`${G}social.ts`]: group,
    [`${C}notice.override.ts`]: categoryOverride('group: "social"'),
    [`${C}alert.override.ts`]: categoryOverride('group: "social"'),
  });
  assert.equal(mixed.length, 1, mixed.join(" / "));
  assert.match(mixed[0], /入れられない\(D82\)/);
});

test("守りに関わる値がリテラルでない・定義の形が違うと止める", () => {
  expectOne({ [`${M}a.ts`]: definition("required: REQUIRED,") }, `${M}a.ts`, /required はリテラル/);
  expectOne(
    { [`${M}verification.ts`]: REQUIRED, [`${M}verification.override.ts`]: override("enabled: isOn") },
    `${M}verification.override.ts`,
    /enabled はリテラル/,
  );
  expectOne({ [`${M}a.ts`]: 'import { defineMessage } from "@/lib/messaging";\nexport default defineMessage({ key: "auth.a" });\n' }, `${M}a.ts`, /export const message = defineMessage/);
});

test("宣言に無い鍵の上書きは止まり、views/ の下は対象外", () => {
  const problems = problemsOf({ [`${M}verification.ts`]: REQUIRED, [`${M}verification.override.ts`]: override('required: false, key: "auth.x"') });
  assert.equal(problems.length, 1, problems.join(" / "));
  assert.match(problems[0], /required・key は上書きできない/);
  assert.deepEqual(problemsOf({ [`${M}verification.ts`]: REQUIRED, [`${M}views/verification.tsx`]: "export const x = 1;\n" }), []);
});
