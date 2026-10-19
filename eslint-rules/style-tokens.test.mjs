// eslint-rules/style-tokens.test.mjs
// 生パレット色検出規則の契約テスト。実行: pnpm test:style-lint (node:test)
import { describe, it, test } from "node:test";
import assert from "node:assert/strict";
import { RuleTester } from "eslint";

import plugin, { findRawPaletteTokens } from "./style-tokens.mjs";

test("検出対象: 数値付きパレット・white/black・任意値 hex、修飾子・透過率付きも含む", () => {
  const hits = findRawPaletteTokens(
    [
      "bg-slate-900",
      "text-red-600",
      "dark:bg-gray-950/50",
      "hover:text-white",
      "bg-black/50",
      "via-white/60",
      "ring-blue-500/10",
      "text-[#4285F4]",
      "border-white/30",
      "[&>svg]:text-amber-500",
      "!bg-white",
      "text-Yellow-400",
      "ring-offset-white",
      "border-t-gray-200",
      "bg-white!",
      "text-white/[0.5]",
      "bg-[rgba(0,0,0,0.5)]",
      "text-[oklch(0.5_0.2_30)]",
      "divide-gray-200",
      "placeholder-gray-400",
    ].join(" "),
  );
  assert.equal(hits.length, 20, `検出漏れ: ${hits.join(", ")}`);
});

test("対象外: テーマトークン・transparent/current/inherit・寸法クラス・色以外の文字列", () => {
  const hits = findRawPaletteTokens(
    [
      "bg-primary",
      "text-destructive-foreground",
      "text-success-text",
      "bg-overlay/50",
      "bg-background/30",
      "text-muted-foreground",
      "border-border",
      "bg-transparent",
      "text-current",
      "text-inherit",
      "bg-white-label", // 完全一致でないものは対象外
      "icon-text-white", // 独自クラスの末尾一致は対象外(区切りは : と ! のみ)
      "shadow-[0_1px_2px_rgba(15,23,42,0.08)]", // 色以外で始まる任意値
      "from-[color:var(--color-primary)]",
      "from-[color:color-mix(in_oklch,_var(--color-primary)_10%,_var(--color-background))]",
      "w-50",
      "text-xs",
      "#000000", // inline style の hex(クラスではない)
      "black",
      "whitespace-nowrap",
    ].join(" "),
  );
  assert.deepEqual(hits, []);
});

// RuleTester を node:test の describe / it に接続する
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: "module", parserOptions: { ecmaFeatures: { jsx: true } } },
});

ruleTester.run("no-raw-palette", plugin.rules["no-raw-palette"], {
  valid: [
    'const a = "bg-primary text-primary-foreground";',
    'const b = cn("bg-destructive/10", isError && "text-destructive-text");',
    "const c = `rounded ${x} bg-overlay/50`;",
    'import x from "./text-white";',
    'const d = <div className="bg-background text-foreground" />;',
    "// 任意値の hex は inline style では対象外\nconst e = { color: '#ffffff' };",
  ],
  invalid: [
    {
      code: 'const a = "bg-white/80 text-slate-900";',
      errors: [
        { messageId: "rawPalette", data: { token: "bg-white/80" } },
        { messageId: "rawPalette", data: { token: "text-slate-900" } },
      ],
    },
    {
      code: "const b = `p-2 ${x} dark:bg-gray-900`;",
      errors: [{ messageId: "rawPalette", data: { token: "dark:bg-gray-900" } }],
    },
    {
      code: 'const c = <span className="text-[#1877F2]" />;',
      errors: [{ messageId: "rawPalette", data: { token: "text-[#1877F2]" } }],
    },
    {
      code: '// eslint の無効化コメントが無ければ検出される\nconst d = { class: "hover:bg-black/90" };',
      errors: [{ messageId: "rawPalette", data: { token: "hover:bg-black/90" } }],
    },
  ],
});

ruleTester.run("span-in-heading", plugin.rules["span-in-heading"], {
  valid: [
    'const a = <UserPageTitle><Span size="inherit" weight="inherit">見出し</Span></UserPageTitle>;',
    'const b = <SecTitle><Span size="sm" weight="normal">補足</Span></SecTitle>;',
    "const c = <PageTitle><Span {...rest}>見出し</Span></PageTitle>;",
    "const d = <Para><Span>本文中の強調</Span></Para>;",
    "const e = <UserPageTitle><Flex><Span>入れ子は対象外</Span></Flex></UserPageTitle>;",
    "const f = <Span>単独</Span>;",
  ],
  invalid: [
    {
      code: '<UserPageTitle><Span className="bg-clip-text">メンテナンス中</Span></UserPageTitle>;',
      errors: [{ messageId: "spanInHeading", data: { heading: "UserPageTitle", missing: "size / weight" } }],
    },
    {
      code: '<SecTitle as="h3"><Span size="inherit">見出し</Span></SecTitle>;',
      errors: [{ messageId: "spanInHeading", data: { heading: "SecTitle", missing: "weight" } }],
    },
    {
      code: "<h2><Span weight=\"bold\">生の見出し</Span></h2>;",
      errors: [{ messageId: "spanInHeading", data: { heading: "h2", missing: "size" } }],
    },
    {
      code: "<Admin.PageTitle><Span>名前空間付き</Span></Admin.PageTitle>;",
      errors: [{ messageId: "spanInHeading", data: { heading: "PageTitle", missing: "size / weight" } }],
    },
  ],
});
