// Button の読み込み中の指定(loading / loadingLabel)の検査。
// - loading を渡さない出力は、前の実装(Primitives の Button + buttonVariants)と同じ
// - loading で Spinner が子の前に出て、disabled と aria-busy が付く
// - loadingLabel は子の代わりに出る(null = Spinner だけ)。asChild では子に手を入れない
// - TabletButton も同じ指定を持つ
// 実行: pnpm test src/components/Button(tsx + node:test、サーバー描画の文字列で比べる)
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { Button } from "./Button";
import { TabletButton } from "./TabletButton";
import { buttonVariants, tabletButtonVariants } from "./variants";
import { Button as PrimitiveButton } from "@/components/Primitives/Button";
import { cn } from "@/lib/cn";

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

test("loading を渡さない Button は前の出力と同じ", () => {
  const cases = [
    { props: {}, label: "保存" },
    { props: { variant: "outline" as const, size: "sm" as const, className: "w-full", disabled: true, type: "submit" as const }, label: "送信" },
    { props: { variant: "destructive" as const, disabled: false }, label: "削除" },
  ];
  for (const { props, label } of cases) {
    const { variant, size, className, ...rest } = props as Record<string, never>; // 前の実装と同じ並びで残りを広げる
    const expected = html(
      createElement(PrimitiveButton, { className: cn(buttonVariants({ variant, size, className })), ...rest }, label),
    );
    assert.equal(html(createElement(Button, props, label)), expected);
    assert.equal(html(createElement(Button, { ...props, loading: false, loadingLabel: "待つ" }, label)), expected);
  }
});

test("loading で Spinner が子の前に出て disabled と aria-busy が付く", () => {
  const out = html(createElement(Button, { loading: true }, "保存"));
  assert.match(out, /^<button[^>]* disabled=""[^>]*aria-busy="true"|^<button[^>]*aria-busy="true"[^>]* disabled=""/);
  assert.match(out, /<svg[^>]*class="[^"]*animate-spin[^"]*"[^>]*>.*<\/svg>保存<\/button>$/);
});

test("loadingLabel は子の代わりに出る / null は Spinner だけ", () => {
  const replaced = html(createElement(Button, { loading: true, loadingLabel: "保存中..." }, "保存"));
  assert.match(replaced, /<\/svg>保存中\.\.\.<\/button>$/);
  assert.doesNotMatch(replaced, />保存</);
  const only = html(createElement(Button, { loading: true, loadingLabel: null }, "適用"));
  assert.match(only, /<\/svg><\/button>$/);
  assert.doesNotMatch(only, /適用/);
});

test("disabled を外から渡しても loading が勝つ", () => {
  assert.match(html(createElement(Button, { loading: true, disabled: false }, "x")), / disabled=""/);
});

test("asChild では子に Spinner を足さない(Slot は子 1 つ)", () => {
  const out = html(createElement(Button, { asChild: true, loading: true }, createElement("a", { href: "/x" }, "行く")));
  assert.doesNotMatch(out, /<svg/);
  assert.match(out, /^<a [^>]*href="\/x"[^>]*>行く<\/a>$/);
  assert.match(out, /aria-busy="true"/);
});

test("TabletButton: loading 無しは前の出力と同じ、loading は Button と同じ動き", () => {
  const expected = html(createElement(PrimitiveButton, { className: cn(tabletButtonVariants({ size: "lg" })) }, "次へ"));
  assert.equal(html(createElement(TabletButton, { size: "lg" }, "次へ")), expected);
  const out = html(createElement(TabletButton, { loading: true, loadingLabel: "送信中" }, "次へ"));
  assert.match(out, /aria-busy="true"/);
  assert.match(out, / disabled=""/);
  assert.match(out, /<\/svg>送信中<\/button>$/);
});
