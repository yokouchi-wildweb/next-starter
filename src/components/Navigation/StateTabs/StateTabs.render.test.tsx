// StateTabs の横の差し込み(listEnd)と下線の見た目(variant="underline")の検査。
// - どちらも渡さない時: 既定・size と listClassName・制御の出力が変更の前に記録した出力(__fixtures__/stateTabs.before.json)と同じ
// - listEnd: タブの列と同じ行の右端(列は min-w-0 flex-1)
// - variant="underline": 列は下の境界線だけ、選んだタブは文字 primary と下線。外観のクラスを渡せばそれが勝つ
// 実行: pnpm test src/components/Navigation/StateTabs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";

import { StateTabs, StateTabsContent } from "./index";

const BEFORE = JSON.parse(
  readFileSync(new URL("./__fixtures__/stateTabs.before.json", import.meta.url), "utf8"),
) as Record<string, string>;

const tabs = [
  { value: "a", label: "A" },
  { value: "b", label: "B", icon: <i>*</i> },
];
type StateTabsProps = Parameters<typeof StateTabs>[0];
const body = (
  <>
    <StateTabsContent value="a">body-a</StateTabsContent>
    <StateTabsContent value="b">body-b</StateTabsContent>
  </>
);
const html = (props: Partial<StateTabsProps>) =>
  renderToStaticMarkup(
    <StateTabs tabs={tabs} {...props}>
      {body}
    </StateTabs>,
  )
    .replace(/radix-[^"]+/g, "ID")
    .replace(/«[^»]*»|_R_[^"]*_/g, "ID");
const classOf = (markup: string, re: RegExp) => (re.exec(markup)?.[1] ?? "").split(/\s+/);

test("listEnd / variant なし: 既定・size と listClassName・制御の出力が前と同じ", () => {
  assert.equal(html({}), BEFORE.plain);
  assert.equal(html({ size: "sm", listClassName: "overflow-x-auto" }), BEFORE.sized);
  assert.equal(html({ value: "b" }), BEFORE.controlled);
  assert.equal(html({ variant: "segment" }), BEFORE.plain);
});

test("listEnd はタブの列と同じ行の右端に置かれ、列は残りの幅で縮む", () => {
  const out = html({ listEnd: <b>filter</b> });
  assert.match(
    out,
    /<nav aria-label="タブ切り替え"><div[^>]*class="[^"]*flex[^"]*w-full[^"]*"[^>]*><div class="min-w-0 flex-1"><div role="tablist"/,
  );
  assert.match(out, /<\/div><\/div><div class="shrink-0"><b>filter<\/b><\/div><\/div><\/nav>/);
  // 列の中身は前と同じ
  const listOf = (m: string) =>
    /<div role="tablist"[\s\S]*?<\/div>(?=<\/div><div class="shrink-0">|<\/nav>)/.exec(m)?.[0];
  assert.equal(listOf(out), listOf(BEFORE.plain));
});

test('variant="underline": 下の境界線・選んだタブは primary と下線、外観のクラスを渡せばそれが勝つ', () => {
  const out = html({ variant: "underline" });
  const list = classOf(out, /role="tablist"[^>]*class="([^"]*)"/);
  for (const k of ["border-b", "border-border", "bg-transparent", "rounded-none", "p-0"])
    assert.ok(list.includes(k), k);
  for (const k of ["bg-muted", "rounded-md", "p-1"]) assert.ok(!list.includes(k), k);
  const trigger = classOf(out, /role="tab"[^>]*class="([^"]*)"/);
  for (const k of ["data-[state=active]:text-primary", "data-[state=active]:after:bg-primary", "after:h-0.5"])
    assert.ok(trigger.includes(k), k);
  assert.ok(!trigger.includes("data-[state=active]:bg-primary"));
  assert.match(out, /class="[^"]*text-primary font-medium[^"]*">A</);
  const custom = html({ variant: "underline", listAppearanceClassName: "x-list" });
  assert.ok(classOf(custom, /role="tablist"[^>]*class="([^"]*)"/).includes("x-list"));
  assert.ok(!classOf(custom, /role="tablist"[^>]*class="([^"]*)"/).includes("border-b"));
});
