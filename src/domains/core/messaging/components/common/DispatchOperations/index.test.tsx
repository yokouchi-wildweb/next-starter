// DispatchOperations の検査(jsdom の上で描く。Dialog と SwitchInput は偽物)。
// - できない操作は出さない(押せないボタン・理由の文も出さない、J92)。状態の 1 行は呼び手が渡した物を出す
// - 押すと確認を開き、確認で呼び手の処理を呼ぶ(削除は見込みと「元に戻せない」を出す、D88)
// - 再送の確認: 失敗・不明の数、不明がある時だけ「不明も含める」、含めると件数が増える
// 実行: pnpm test src/domains/core/messaging/components/common/DispatchOperations/index.test.tsx
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
  canDelete: { allowed: true, reason: null },
  canResend: { allowed: true, reason: null, mode: "requeue", failed: 2, unknown: 1 },
  canContinue: { allowed: false, reason: "not_processing" },
  ...extra,
});
const SUMMARY: NonNullable<Props["deleteSummary"]> = {
  found: 1,
  deleted: 0,
  scheduled: 0,
  unsent: 3,
  channels: [
    { key: "inApp", label: "お知らせ", removable: true, sent: 4 },
    { key: "email", label: "メール", removable: false, sent: 5 },
  ],
  sharedInbox: 0,
};

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
          onDeleteConfirmOpenChange: (open: boolean) => void calls.push(`deleteOpen:${open}`),
          onDelete: async () => void calls.push("delete"),
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

test("できない操作は出さず理由も出さない。状態の 1 行は出す(J92)", async () => {
  const view = await mount({
    operations: flags({ canDelete: { allowed: false, reason: "deleted" } }),
    stateLine: "この送信は削除済みです",
    canContinue: false,
    onContinue: async () => void 0,
  });
  const text = () => view.container.textContent ?? "";
  assert.equal(button(view.container, "削除"), undefined);
  assert.equal(button(view.container, "送信を再開"), undefined);
  assert.doesNotMatch(text(), /削除した送信です|送信中の送信ではありません/);
  assert.equal(view.container.querySelector("[data-slot=dispatch-state-line]")?.textContent, "この送信は削除済みです");
  assert.equal(button(view.container, "失敗分を再送")!.disabled, false);
  // できる操作が 1 つも無ければボタンの行ごと出さない
  await view.render({ operations: flags({ canDelete: { allowed: false, reason: "deleted" }, canResend: { allowed: false, reason: "deleted", mode: null, failed: 0, unknown: 0 } }) });
  assert.equal(view.container.querySelectorAll("button").length, 0);
  assert.match(text(), /この送信は削除済みです/);
  // 状態が送信中の送信は「送信を再開」を同じ行に出す
  await view.render({ operations: flags({ canContinue: { allowed: true, reason: null } }), canContinue: true });
  assert.ok(button(view.container, "送信を再開"));
  assert.ok(button(view.container, "削除"));
  await view.unmount();
});

test("削除: 確認を開き(見込みと戻せないことを出す)、確認で呼び手の処理を呼ぶ(D88)", async () => {
  const view = await mount({ deleteSummary: SUMMARY });
  await act(async () => button(view.container, "削除")!.click());
  const dialog = view.container.querySelector("[data-testid=dialog]")?.textContent ?? "";
  assert.match(dialog, /送信を削除/);
  assert.match(dialog, /お知らせ 4 件が受け取った人から消えます/);
  assert.match(dialog, /メール 5 件は送信済みのため取り消せません/);
  assert.match(dialog, /未送信 3 件は送信されません/);
  assert.match(dialog, /削除は元に戻せません/);
  await act(async () => button(view.container, "confirm:削除する")!.click());
  assert.deepEqual(view.calls, ["deleteOpen:true", "delete"]);
  await view.unmount();
});

test("再送: 数と「不明も含める」、含めると件数が増える。不明が無ければ出さない", async () => {
  const view = await mount();
  await act(async () => button(view.container, "失敗分を再送")!.click());
  const dialog = () => view.container.querySelector("[data-testid=dialog]")?.textContent ?? "";
  assert.match(dialog(), /失敗 2 件 \/ 送信結果が不明 1 件/);
  assert.match(dialog(), /送信結果が不明の宛先も含める/);
  assert.ok(button(view.container, "confirm:2 件を再送する"));
  await view.render({ includeUnknown: true });
  assert.ok(button(view.container, "confirm:3 件を再送する"));
  await act(async () => button(view.container, "confirm:3 件を再送する")!.click());
  assert.deepEqual(view.calls, ["resend"]);
  await view.unmount();

  const none = await mount({ operations: flags({ canResend: { allowed: true, reason: null, mode: "new_dispatch", failed: 1, unknown: 0 } }) });
  await act(async () => button(none.container, "失敗分を再送")!.click());
  const text = none.container.querySelector("[data-testid=dialog]")?.textContent ?? "";
  assert.doesNotMatch(text, /送信結果が不明の宛先も含める/);
  assert.match(text, /新しい送信として送ります/);
  await none.unmount();
});
