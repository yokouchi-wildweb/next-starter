// MessagePreferences の検査(jsdom の上で描く。hook と toast と棚の Link は偽物)。
// - 並び: 経路 > 種別の枠(見出しだけ、スイッチなし)> グループ(グループの無い種類が先・見出しなし)> 種類の行
// - 止め方 4 つ: 1 マス(setCell)・種類まるごと(最初の経路の行に 1 回だけ、setCategoryWide)・経路まるごと(setChannelWide)・全部(setAll)
// - 種別まるごとに止められた種類は切で、押すと setCell(サーバーが書き分ける)。全部の停止の下は押せない
// - 全部の停止の間は経路まるごと(切)・種類まるごと(入)も全部に従って見せる。全部を戻すと各行の値に戻る(C17)
// - 宛先の無い経路は連携の案内
// 実行: pnpm test src/features/core/messaging/components/MessagePreferences/index.test.tsx
// (package.json に type: module が無いので tsx は CJS として読む = top-level await 不可 → before() で import)
import { after, before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.HTMLElement = dom.window.HTMLElement;
g.HTMLInputElement = dom.window.HTMLInputElement;
g.Node = dom.window.Node;
g.MouseEvent = dom.window.MouseEvent;
g.IS_REACT_ACT_ENVIRONMENT = true;

const calls: unknown[][] = [];
let preferences: unknown = null;
mock.module("@/features/core/messaging/hooks/useMessagePreferences", {
  namedExports: {
    useMessagePreferences: () => ({
      preferences,
      isLoading: false,
      error: null,
      retry: () => {},
      pendingKey: null,
      setCell: async (...args: unknown[]) => void calls.push(["cell", ...args]),
      setCategoryWide: async (...args: unknown[]) => void calls.push(["category", ...args]),
      setChannelWide: async (...args: unknown[]) => void calls.push(["channel", ...args]),
      setAll: async (...args: unknown[]) => void calls.push(["all", ...args]),
      setKind: async () => {},
    }),
  },
});
mock.module("@/lib/toast", { namedExports: { useToast: () => ({ showToast: () => {} }) } });
mock.module("@/components/Navigation", {
  namedExports: { Link: ({ href, children, className }: { href: string; children: unknown; className?: string }) => createElement("a", { href, className }, children as never) },
});

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let MessagePreferences: typeof import("./index").MessagePreferences;
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  ({ MessagePreferences } = await import("./index"));
});
after(() => dom.window.close());

const cat = (key: string, label: string, optedOut = false, via: string | null = null) => ({ key, label, description: null, optedOut, via });
beforeEach(() => {
  calls.length = 0;
  preferences = {
    allOptedOut: false,
    categories: [
      { key: "campaign", optedOut: false },
      { key: "likes", optedOut: false },
    ],
    kinds: [{ kind: "marketing", optedOut: true }],
    channels: [
      {
        key: "email", label: "メール", hasAddress: true, connectHref: null, optedOut: false,
        kinds: [
          { kind: "activity", groups: [
            { key: null, label: null, categories: [cat("likes", "いいね")] },
            { key: "social", label: "つながり", categories: [cat("follows", "フォロー")] },
          ] },
          { kind: "marketing", groups: [{ key: null, label: null, categories: [cat("campaign", "キャンペーン", true, "kind")] }] },
        ],
      },
      {
        key: "line", label: "LINE", hasAddress: false, connectHref: "/api/auth/line/login", optedOut: false,
        kinds: [{ kind: "marketing", groups: [{ key: null, label: null, categories: [cat("campaign", "キャンペーン")] }] }],
      },
    ],
  };
});

const mount = async () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(createElement(MessagePreferences)));
  return { container, unmount: () => act(async () => root.unmount()) };
};
const byLabel = (c: HTMLElement, label: string) => c.querySelector(`[aria-label="${label}"]`) as HTMLInputElement | null;
const text = (c: HTMLElement) => c.textContent ?? "";
const order = (c: HTMLElement, parts: string[]) => {
  const t = text(c);
  const at = parts.map((p) => t.indexOf(p));
  assert.ok(at.every((i) => i >= 0), `見つからない: ${parts.filter((_, i) => at[i] < 0).join(", ")}`);
  assert.deepEqual([...at].sort((a, b) => a - b), at, `並びが違う: ${parts.join(" > ")}`);
};

test("並び: 経路 > 種別の枠 > グループ(無い方が先)> 種類。種別の枠にスイッチは無い", async () => {
  const view = await mount();
  order(view.container, ["すべての連絡を止める", "メール", "ご利用に伴うお知らせ", "いいね", "つながり", "フォロー", "キャンペーン情報", "キャンペーン", "LINE"]);
  assert.equal(byLabel(view.container, "キャンペーン情報"), null, "種別のスイッチは無い");
  await view.unmount();
});

test("1 マス: 押すと setCell。種別まるごとで止まった種類は切で理由が出て、押すと setCell(再開)", async () => {
  const view = await mount();
  await act(async () => byLabel(view.container, "いいねをメールで受け取る")!.click());
  const campaign = byLabel(view.container, "キャンペーンをメールで受け取る")!;
  assert.equal(campaign.disabled, false);
  assert.match(text(view.container), /まとめて止める設定で止まっています/);
  await act(async () => campaign.click());
  assert.deepEqual(calls, [
    ["cell", "likes", "email", false],
    ["cell", "campaign", "email", true],
  ]);
  await view.unmount();
});

test("種類まるごとは種類が最初に出る経路の行に 1 回だけ。押すと setCategoryWide", async () => {
  const view = await mount();
  const toggles = view.container.querySelectorAll('[aria-label$="をすべての経路で止める"]');
  assert.equal(toggles.length, 2, "campaign と likes に 1 つずつ(LINE の campaign・categories に無い follows には出ない)");
  assert.match(text(view.container), /このカテゴリーをすべての経路で止める/);
  await act(async () => byLabel(view.container, "いいねをすべての経路で止める")!.click());
  assert.deepEqual(calls[0], ["category", "likes", true]);
  await view.unmount();
});

test("経路まるごと: 経路の枠の切り替え → setChannelWide。宛先の無い経路は連携の案内", async () => {
  const view = await mount();
  await act(async () => byLabel(view.container, "メールで受け取る")!.click());
  assert.deepEqual(calls, [["channel", "email", true]]);
  assert.match(text(view.container), /宛先が登録されていません/);
  assert.equal(view.container.querySelector('a[href="/api/auth/line/login"]')?.textContent, "連携する");
  await view.unmount();
});

test("全部: setAll。全部の停止の間は経路・種類まるごと・全部の下のマスは押せない", async () => {
  const view = await mount();
  await act(async () => byLabel(view.container, "すべての連絡を止める")!.click());
  assert.deepEqual(calls, [["all", true]]);
  await view.unmount();

  const p = preferences as { allOptedOut: boolean; channels: { kinds: { groups: { categories: { optedOut: boolean; via: string | null }[] }[] }[] }[] };
  p.allOptedOut = true;
  for (const ch of p.channels) for (const f of ch.kinds) for (const gr of f.groups) for (const c of gr.categories) Object.assign(c, { optedOut: true, via: "all" });
  const locked = await mount();
  assert.ok(byLabel(locked.container, "メールで受け取る")!.disabled);
  assert.ok(byLabel(locked.container, "いいねをメールで受け取る")!.disabled);
  assert.match(text(locked.container), /すべての連絡を止めています/);
  // C17: 経路の行は止めていないが、全部に従って切で見せる。種類まるごとは入(止まっている)
  assert.equal(byLabel(locked.container, "メールで受け取る")!.checked, false);
  assert.equal(byLabel(locked.container, "LINEで受け取る")!.checked, false);
  assert.equal(byLabel(locked.container, "いいねをすべての経路で止める")!.checked, true);
  assert.ok(byLabel(locked.container, "いいねをすべての経路で止める")!.disabled);
  await locked.unmount();

  // 全部を戻すと経路の行の値に戻る
  p.allOptedOut = false;
  for (const ch of p.channels) for (const f of ch.kinds) for (const gr of f.groups) for (const c of gr.categories) Object.assign(c, { optedOut: false, via: null });
  const back = await mount();
  assert.equal(byLabel(back.container, "メールで受け取る")!.checked, true);
  assert.equal(byLabel(back.container, "メールで受け取る")!.disabled, false);
  assert.equal(byLabel(back.container, "いいねをすべての経路で止める")!.checked, false);
  await back.unmount();
});

test("経路が無ければ文言", async () => {
  preferences = { allOptedOut: false, categories: [], kinds: [], channels: [] };
  const view = await mount();
  assert.match(text(view.container), /設定できる通知はありません/);
  await view.unmount();
});
