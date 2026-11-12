// scripts/structure/extensions/messageGuards.test.mjs
// 止められない連絡(required)の守り(./derive/messageGuards.mjs)と、連絡の上書きの点(lib/messaging の extensionPoints.ts の messages)。
// 一時ディレクトリの fork(acme、祖先 parent)の木で planExtensions を回す。
// - 定義だけ・正しい上書き・項目 0 は通る
// - required の定義: email の無い defaultChannels・adminEditable・throttle を止める
// - required への上書き: enabled:false・email の除外・adminEditable・throttle を止める(throttle: null は通す)
// - 守りに関わる値がリテラルでない・定義の形が違う(export const message が無い)を止める
// - 宣言に無い鍵(key・required)の上書きは既存の overrideKeys が止める / views/ の下は対象外
// - category: categories の点の項目の鍵か(取引だけ省ける)、上書きも(点の宣言が無い木では照らさない)
// 実行: pnpm test scripts/structure/extensions/messageGuards.test.mjs

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { planExtensions } from "./extensions.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
// 宣言は本物を使う(点の glob・export・overrideOf を写さない)
const DECLARATION = readFileSync(join(repoRoot, "src/lib/messaging/extensionPoints.ts"), "utf8");

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), "message-guards-"));
  const put = (path, text) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  put(".claude/rules/project.md", "fork_id: acme\n");
  put(".notices/applied/parent.md", "");
  put("src/lib/CATALOG.md", "## next-starter\n\n## parent\n\n## acme\n");
  put("src/lib/messaging/extensionPoints.ts", DECLARATION);
  for (const [path, text] of Object.entries(files)) put(path, text);
  return root;
}

const M = "src/features/core/auth/messages/";
const definition = (props) => `import { z } from "zod";
import { defineMessage } from "@/lib/messaging";

export const message = defineMessage({
  key: "auth.verification",
  kind: "transactional",
  category: "account",
  vars: z.object({ verificationUrl: z.string() }),
  ${props}
  content: { email: { subject: "確認" }, inApp: { title: "確認", body: "" } },
});
`;
const REQUIRED = definition('required: true,\n  defaultChannels: ["email"],');
const OPTIONAL = definition('defaultChannels: ["email", "inApp"],\n  adminEditable: ["email.subject"],');
const override = (props) => `import type { MessageOverride } from "@/lib/messaging";\n\nexport const messageOverride = { ${props} } satisfies MessageOverride;\n`;

const problemsOf = (files) => planExtensions(fixture(files)).problems.filter((p) => p.includes("/messages/"));
const expectOne = (files, path, pattern) => {
  const problems = problemsOf(files);
  assert.equal(problems.length, 1, problems.join(" / "));
  assert.ok(problems[0].startsWith(path), problems[0]);
  assert.match(problems[0], pattern);
};

test("項目 0・定義だけ・正しい上書きは通る", () => {
  assert.deepEqual(planExtensions(fixture({})).problems, []);
  assert.deepEqual(problemsOf({ [`${M}verification.ts`]: REQUIRED, [`${M}welcome.ts`]: OPTIONAL }), []);
  assert.deepEqual(
    problemsOf({
      [`${M}verification.ts`]: REQUIRED,
      [`${M}verification.override.ts`]: override('content: { email: { subject: "新しい件名" } }, enabled: true, defaultChannels: ["email", "inApp"], adminEditable: [], throttle: null'),
      [`${M}welcome.ts`]: OPTIONAL,
      [`${M}welcome.override.ts`]: override('enabled: false, defaultChannels: ["inApp"], adminEditable: ["inApp.title"]'),
    }),
    [],
  );
});

test("required の定義: email の無い defaultChannels・adminEditable・throttle を止める", () => {
  expectOne({ [`${M}a.ts`]: definition('required: true,\n  defaultChannels: ["inApp"],') }, `${M}a.ts`, /"email" を含める/);
  expectOne({ [`${M}a.ts`]: definition('required: true,\n  defaultChannels: ["email"],\n  adminEditable: ["email.subject"],') }, `${M}a.ts`, /adminEditable は付けられない/);
  expectOne(
    { [`${M}a.ts`]: definition('required: true,\n  defaultChannels: ["email"],\n  throttle: { by: ["verificationUrl"], mode: "window", seconds: 60 },') },
    `${M}a.ts`,
    /throttle は付けられない/,
  );
});

test("required への上書き: enabled:false・email の除外・adminEditable・throttle を止める", () => {
  const base = { [`${M}verification.ts`]: REQUIRED };
  const path = `${M}verification.override.ts`;
  expectOne({ ...base, [path]: override("enabled: false") }, path, /止められない/);
  expectOne({ ...base, [path]: override('defaultChannels: ["inApp"]') }, path, /email は外せない/);
  expectOne({ ...base, [path]: override('adminEditable: ["email.subject"]') }, path, /adminEditable は付けられない/);
  expectOne({ ...base, [path]: override('throttle: { by: ["verificationUrl"], mode: "window", seconds: 60 }') }, path, /throttle は付けられない/);
});

test("守りに関わる値がリテラルでない・定義の形が違うと止める", () => {
  expectOne({ [`${M}a.ts`]: definition("required: REQUIRED,\n  defaultChannels: [\"email\"],") }, `${M}a.ts`, /required はリテラル/);
  expectOne({ [`${M}a.ts`]: definition("required: true,\n  defaultChannels: CHANNELS,") }, `${M}a.ts`, /defaultChannels はリテラル/);
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

// category の検査: messaging の点 categories の項目の鍵と照らす(点の宣言が無い木では照らさない = 上の fixture)
const MESSAGING_DECLARATION = readFileSync(join(repoRoot, "src/features/core/messaging/extensionPoints.ts"), "utf8");
const categoryItem = (key, kind) =>
  `import type { MessageCategory } from "@/lib/messaging";\n\nexport const category: MessageCategory = { key: "${key}", label: "${key}", kind: "${kind}" };\n`;
const withCategories = (files) => ({
  "src/features/core/messaging/extensionPoints.ts": MESSAGING_DECLARATION,
  "src/features/core/messaging/categories/marketing.ts": categoryItem("marketing", "marketing"),
  "src/features/core/messaging/categories/activity.ts": categoryItem("activity", "activity"),
  ...files,
});
const categoryProblemsOf = (files) => problemsOf(withCategories(files)).filter((p) => p.includes("category"));
const plain = (kind, category) =>
  definition(`defaultChannels: ["email"],`).replace('kind: "transactional",\n  category: "account",', `kind: "${kind}",${category ? `\n  category: ${category},` : ""}`);

test("category: 受け口の鍵か、取引だけ省ける。上書きも照らす", () => {
  assert.deepEqual(categoryProblemsOf({ [`${M}a.ts`]: plain("transactional") }), []);
  assert.deepEqual(categoryProblemsOf({ [`${M}a.ts`]: plain("marketing", '"marketing"') }), []);
  assert.deepEqual(categoryProblemsOf({ [`${M}a.ts`]: plain("transactional", '"activity"') }), []);
  const unknown = categoryProblemsOf({ [`${M}a.ts`]: plain("transactional", '"account"') });
  assert.equal(unknown.length, 1, unknown.join(" / "));
  assert.match(unknown[0], /category "account" は categories の受け口に無い\(activity \/ marketing\)/);
  const missing = categoryProblemsOf({ [`${M}a.ts`]: plain("activity") });
  assert.equal(missing.length, 1, missing.join(" / "));
  assert.match(missing[0], /activity の連絡は category/);
  const notLiteral = categoryProblemsOf({ [`${M}a.ts`]: plain("marketing", "CATEGORY") });
  assert.match(notLiteral[0], /category はリテラル/);
  const overridden = categoryProblemsOf({ [`${M}a.ts`]: plain("transactional"), [`${M}a.override.ts`]: override('category: "news"') });
  assert.equal(overridden.length, 1, overridden.join(" / "));
  assert.ok(overridden[0].startsWith(`${M}a.override.ts`), overridden[0]);
  assert.deepEqual(categoryProblemsOf({ [`${M}a.ts`]: plain("transactional"), [`${M}a.override.ts`]: override('category: "marketing"') }), []);
});
