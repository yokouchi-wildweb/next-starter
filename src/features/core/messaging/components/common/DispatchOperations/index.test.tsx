// DispatchOperations の検査(jsdom の上で描く。Dialog と SwitchInput は偽物)。
// - できない操作は押せず、理由の文(constants/dispatchOperations.ts)を出す
// - 押すと確認を開き、確認で呼び手の処理を呼ぶ
// - 再送の確認: 失敗・不明の数、不明がある時だけ「不明も含める」、含めると件数が増える
// 実行: pnpm test src/features/core/messaging/components/common/DispatchOperations/index.test.tsx
import { after, before, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true });
const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.HTMLElement = dom.window.HTMLElement;
g.Node = dom.window.Node;
g.MouseEvent = dom.window.MouseEvent;
g.IS_REACT_ACT_ENVIRONMENT = true;

// Dialog は Radix(portal・focus)を jsdom で動かさない偽物: 開いている間だけ題・説明・中身・確認のボタンを描く
mock.module("@/components/Overlays/Dialog", {
  namedExports: {
    Dialog: ({
      open,
      title,
      description,
      children,
      confirmLabel,
      onConfirm,
    }: {
      open: boolean;
      title?: unknown;
      description?: unknown;
      children?: unknown;
      confirmLabel?: string;
      onConfirm?: () => unknown;
    }) =>
      open
        ? createElement(
            "section",
            { "data-testid": "dialog" },
            title as never,
            description as never,
            children as never,
            createElement("button", { type: "button", onClick: () => onConfirm?.() }, `confirm:${confirmLabel}`),
          )
        : null,
  },
});

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let DispatchOperations: typeof import("./index").DispatchOperations;
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  ({ DispatchOperations } = await import("./index"));
});
after(() => dom.window.close());

type Props = Parameters<typeof DispatchOperations>[0];
const flags = (extra: Partial<Props["operations"]> = {}): Props["operations"] => ({
  cancel: { allowed: false, reason: "not_scheduled" },
  retract: { allowed: true, reason: null },
  resend: { allowed: true, reason: null, mode: "requeue", failed: 2, unknown: 1 },
  ...extra,
});

const mount = async (props: Partial<Props> = {}) => {
  const calls: string[] = [];
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const render = (over: Partial<Props>) =>
    act(async () =>
      root.render(
        createElement(DispatchOperations, {
          operations: flags(),
          includeUnknown: false,
          onIncludeUnknownChange: (v: boolean) => calls.push(`unknown:${v}`),
          onCancel: async () => void calls.push("cancel"),
          onRetract: async () => void calls.push("retract"),
          onResend: async () => void calls.push("resend"),
          ...props,
          ...over,
        }),
      ),
    );
  await render({});
  return { container, calls, render, unmount: () => act(async () => root.unmount()) };
};
const button = (container: HTMLElement, text: string) =>
  [...container.querySelectorAll("button")].find((b) => (b.textContent ?? "").includes(text)) as HTMLButtonElement | undefined;

test("できない操作は押せず理由を出す", async () => {
  const view = await mount();
  assert.equal(button(view.container, "予約を取り消す")!.disabled, true);
  assert.match(view.container.textContent ?? "", /予約の回ではありません/);
  assert.equal(button(view.container, "取り下げる")!.disabled, false);
  await view.unmount();
});

test("取り下げ: 確認を開き、確認で呼び手の処理を呼ぶ", async () => {
  const view = await mount();
  await act(async () => button(view.container, "取り下げる")!.click());
  assert.match(view.container.querySelector("[data-testid=dialog]")?.textContent ?? "", /送ったメールは取り戻せません/);
  await act(async () => button(view.container, "confirm:取り下げる")!.click());
  assert.deepEqual(view.calls, ["retract"]);
  await view.unmount();
});

test("再送: 数と「不明も含める」、含めると件数が増える。不明が無ければ出さない", async () => {
  const view = await mount();
  await act(async () => button(view.container, "失敗分を再送")!.click());
  const dialog = () => view.container.querySelector("[data-testid=dialog]")?.textContent ?? "";
  assert.match(dialog(), /失敗 2 件 \/ 送れたか不明 1 件/);
  assert.match(dialog(), /送れたか不明の宛先も含める/);
  assert.ok(button(view.container, "confirm:2 件を送り直す"));
  await view.render({ includeUnknown: true });
  assert.ok(button(view.container, "confirm:3 件を送り直す"));
  await act(async () => button(view.container, "confirm:3 件を送り直す")!.click());
  assert.deepEqual(view.calls, ["resend"]);
  await view.unmount();

  const none = await mount({ operations: flags({ resend: { allowed: true, reason: null, mode: "new_dispatch", failed: 1, unknown: 0 } }) });
  await act(async () => button(none.container, "失敗分を再送")!.click());
  const text = none.container.querySelector("[data-testid=dialog]")?.textContent ?? "";
  assert.doesNotMatch(text, /送れたか不明の宛先も含める/);
  assert.match(text, /新しい回として送ります/);
  await none.unmount();
});
