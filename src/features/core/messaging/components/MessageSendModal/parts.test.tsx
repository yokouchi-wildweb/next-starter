// 送るモーダルの部品(props だけ)の検査。jsdom の上で描く(押す操作のある部品)・文字で見る。
// - SendTemplatePicker: 選んで「呼び出す」/ 呼び出し中は名前・版と「やめて…」
// - SendContentFields: その場で書く時もテンプレートの時も経路の欄の部品・文言なしの印・変数の欄(テンプレートの時だけ)
// - SendAudiencePicker: bulk は選んだ記録の数だけ / select は種類の選び
// - SendCategoryChannels: カテゴリーが無い文言・経路の切り替え・文言なしの印
// - SendSchedule: 予約の時だけ時刻・注記・誤り
// - SendLegalNotice: 法の義務の告知の注意(D83)をいつも出し、メールがオフなら警告の色
// - SendConfirmView / SendResultView: 見込み・一括の数・予約・版 / 状態・後処理・回へのリンク
// 実行: pnpm test src/features/core/messaging/components/MessageSendModal/parts.test.tsx
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

// 入力の部品は Radix を jsdom で動かさない偽物(値と押すだけ)
const selects: { label?: string; onChange: (v: string) => void }[] = [];
mock.module("@/components/Form/Input/Manual", {
  namedExports: {
    SelectInput: (props: { "aria-label"?: string; id?: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) => {
      selects.push({ label: props["aria-label"] ?? props.id, onChange: props.onChange });
      return createElement("span", { "data-select": props["aria-label"] ?? props.id }, props.options.map((o) => o.label).join("|"));
    },
    SwitchInput: (props: { label: string; value: boolean; onChange: (v: boolean) => void }) =>
      createElement("button", { type: "button", "data-switch": props.label, onClick: () => props.onChange(!props.value) }, `${props.label}:${props.value ? "on" : "off"}`),
    RadioGroupInput: (props: { value: string }) => createElement("span", { "data-radio": props.value }),
    MultiSelectInput: () => createElement("span", { "data-multi": "1" }),
    DatetimeInput: () => createElement("input", { "data-datetime": "1" }),
    Input: (props: Record<string, unknown>) => createElement("input", { id: props.id as string, defaultValue: props.value as string }),
    Textarea: (props: Record<string, unknown>) => createElement("textarea", { id: props.id as string, defaultValue: props.value as string }),
  },
});
// next/link は jsdom で動かない(requestIdleCallback)ので、ボタンの部品も偽物
mock.module("@/components/Form/Button", {
  namedExports: {
    Button: (props: { children?: unknown; disabled?: boolean; onClick?: () => void }) =>
      createElement("button", { type: "button", disabled: props.disabled, onClick: props.onClick }, props.children as never),
    LinkButton: (props: { href: string; children?: unknown }) => createElement("a", { href: props.href }, props.children as never),
  },
});
mock.module("@/features/core/user/components/common/UserAsyncMultiSelect", {
  namedExports: { UserAsyncMultiSelect: () => createElement("span", { "data-users": "1" }) },
});
mock.module("@/features/core/messaging/components/common/TemplateChannelFields", {
  namedExports: { TemplateChannelFields: (props: { channel: string }) => createElement("div", { "data-template-fields": props.channel }) },
});

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let parts: {
  SendTemplatePicker: typeof import("../common/SendTemplatePicker").SendTemplatePicker;
  SendContentFields: typeof import("../common/SendContentFields").SendContentFields;
  SendAudiencePicker: typeof import("../common/SendAudiencePicker").SendAudiencePicker;
  SendCategoryChannels: typeof import("../common/SendCategoryChannels").SendCategoryChannels;
  SendSchedule: typeof import("../common/SendSchedule").SendSchedule;
  SendLegalNotice: typeof import("../common/SendLegalNotice").SendLegalNotice;
  SendConfirmView: typeof import("../common/SendConfirmView").SendConfirmView;
  SendResultView: typeof import("../common/SendConfirmView").SendResultView;
};
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  parts = {
    ...(await import("../common/SendTemplatePicker")),
    ...(await import("../common/SendContentFields")),
    ...(await import("../common/SendAudiencePicker")),
    ...(await import("../common/SendCategoryChannels")),
    ...(await import("../common/SendSchedule")),
    ...(await import("../common/SendLegalNotice")),
    ...(await import("../common/SendConfirmView")),
  };
});
after(() => dom.window.close());

const render = async (element: ReturnType<typeof createElement>) => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(element));
  return { container, unmount: () => act(async () => root.unmount()) };
};
const button = (container: HTMLElement, text: string) =>
  [...container.querySelectorAll("button")].find((b) => (b.textContent ?? "").includes(text)) as HTMLButtonElement | undefined;

test("SendTemplatePicker: 選んで呼び出す / 呼び出し中は名前と版とやめる", async () => {
  const called: string[] = [];
  let cleared = 0;
  const view = await render(
    createElement(parts.SendTemplatePicker, {
      templates: [{ id: "t1", name: "春", currentVersion: 2 }],
      called: null,
      onCall: (id: string) => called.push(id),
      onClear: () => (cleared += 1),
    }),
  );
  assert.equal(button(view.container, "呼び出す")!.disabled, true, "選ぶまで押せない");
  await act(async () => selects.at(-1)!.onChange("t1"));
  await act(async () => button(view.container, "呼び出す")!.click());
  assert.deepEqual(called, ["t1"]);
  await view.unmount();

  const on = await render(
    createElement(parts.SendTemplatePicker, { templates: [], called: { id: "t1", name: "春", version: 2 }, onCall: () => {}, onClear: () => (cleared += 1) }),
  );
  assert.match(on.container.textContent ?? "", /春\(v2\)/);
  await act(async () => button(on.container, "やめて")!.click());
  assert.equal(cleared, 1);
  await on.unmount();
});

test("SendContentFields: その場で書く欄 / テンプレートの欄 / 文言なしの印 / 変数", async () => {
  const adhoc = await render(
    createElement(parts.SendContentFields, {
      source: "adhoc",
      channels: [
        { key: "email", label: "メール", blank: false },
        { key: "inApp", label: "お知らせ", blank: true },
        { key: "line", label: "LINE", blank: false },
        { key: "fax", label: "fax", blank: false },
      ],
      content: { email: { subject: "件", paragraphs: ["本"] }, inApp: { title: "", body: "" }, line: { text: "文" }, fax: { number: "03" } },
      onChange: () => {},
      variables: [{ key: "discount", label: "割引", type: "number", required: true }],
    }),
  );
  // その場で書く時も経路ごとに経路の欄の部品(メールの全部の欄・お知らせの画像・LINE・fork の JSON はその部品が描く)
  assert.deepEqual(
    [...adhoc.container.querySelectorAll("[data-template-fields]")].map((el) => el.getAttribute("data-template-fields")),
    ["email", "inApp", "line", "fax"],
  );
  assert.equal(adhoc.container.textContent?.match(/文言がありません/g)?.length, 1);
  assert.equal(adhoc.container.querySelector("#send-var-discount"), null, "変数はテンプレートの時だけ");
  await adhoc.unmount();

  const tpl = await render(
    createElement(parts.SendContentFields, {
      source: "template",
      channels: [{ key: "email", label: "メール", blank: false }],
      content: { email: { subject: "s" } },
      onChange: () => {},
      variables: [{ key: "discount", label: "割引", type: "number", required: true }],
      vars: { discount: "10" },
      onVarChange: () => {},
    }),
  );
  assert.ok(tpl.container.querySelector("[data-template-fields=email]"));
  assert.match(tpl.container.textContent ?? "", /割引\(必須\)/);
  assert.ok(tpl.container.querySelector("#send-var-discount"));
  await tpl.unmount();
});

test("SendAudiencePicker: bulk は記録の数、select は種類の選び", async () => {
  const bulk = await render(createElement(parts.SendAudiencePicker, { kind: "bulk", recordCount: 3, recordNoun: "振込レビュー" }));
  assert.match(bulk.container.textContent ?? "", /選んだ 3 件の振込レビュー/);
  await bulk.unmount();
  const select = await render(
    createElement(parts.SendAudiencePicker, {
      kind: "select",
      value: { type: "users", roles: [], audienceKey: "", userIds: [] },
      onChange: () => {},
      roles: [],
      audiences: [],
    }),
  );
  assert.ok(select.container.querySelector("[data-users]"));
  await select.unmount();
});

test("SendCategoryChannels: カテゴリーが無い文言・経路の切り替え・文言なしの印", async () => {
  const toggles: [string, boolean][] = [];
  const view = await render(
    createElement(parts.SendCategoryChannels, {
      categories: [{ key: "notice", label: "お知らせ" }],
      category: "notice",
      onCategoryChange: () => {},
      channels: [
        { key: "email", label: "メール", on: true, blank: true },
        { key: "inApp", label: "お知らせ", on: false, blank: true },
      ],
      onToggleChannel: (key: string, on: boolean) => toggles.push([key, on]),
    }),
  );
  assert.equal(view.container.textContent?.match(/文言なし/g)?.length, 1, "オンの経路だけ印");
  await act(async () => button(view.container, "お知らせ:off")!.click());
  assert.deepEqual(toggles, [["inApp", true]]);
  await view.unmount();
  const none = await render(
    createElement(parts.SendCategoryChannels, { categories: [], category: "", onCategoryChange: () => {}, channels: [], onToggleChannel: () => {} }),
  );
  assert.match(none.container.textContent ?? "", /送れるカテゴリーがありません/);
  await none.unmount();
});

test("SendSchedule: 予約の時だけ時刻・注記・誤り", async () => {
  const now = await render(
    createElement(parts.SendSchedule, { mode: "now", scheduledAt: "", error: null, note: "注記", onModeChange: () => {}, onScheduledAtChange: () => {} }),
  );
  assert.equal(now.container.querySelector("[data-datetime]"), null);
  await now.unmount();
  const at = await render(
    createElement(parts.SendSchedule, { mode: "at", scheduledAt: "", error: "予約の時刻を入れてください", note: "粒度の注記", onModeChange: () => {}, onScheduledAtChange: () => {} }),
  );
  assert.ok(at.container.querySelector("[data-datetime]"));
  assert.match(at.container.textContent ?? "", /粒度の注記/);
  assert.match(at.container.textContent ?? "", /予約の時刻を入れてください/);
  await at.unmount();
});

test("SendConfirmView / SendResultView", async () => {
  const confirm = await render(
    createElement(parts.SendConfirmView, {
      estimate: { count: 12, capped: false },
      scheduledAt: null,
      templateVersion: 3,
      channels: ["メール"],
      categoryLabel: "キャンペーン",
    }),
  );
  assert.match(confirm.container.textContent ?? "", /12 名\(送る時に数え直します\)/);
  assert.match(confirm.container.textContent ?? "", /今送ります/);
  assert.match(confirm.container.textContent ?? "", /v3/);
  await confirm.unmount();
  const bulk = await render(
    createElement(parts.SendConfirmView, {
      estimate: null,
      bulk: { recordCount: 2, recordNoun: "振込レビュー" },
      scheduledAt: null,
      templateVersion: null,
      channels: ["メール"],
      categoryLabel: "運営から",
    }),
  );
  assert.match(bulk.container.textContent ?? "", /選んだ 2 件の振込レビュー/);
  await bulk.unmount();
  const result = await render(
    createElement(parts.SendResultView, { status: "queued", queuedCount: 0, dispatchHref: "/admin/messaging/d1", afterSend: { ok: false, error: "x" }, recordNoun: "振込レビュー" }),
  );
  assert.match(result.container.textContent ?? "", /送信を受け付けました/);
  assert.match(result.container.textContent ?? "", /送った後の処理に失敗しました: x/);
  assert.ok(result.container.querySelector("a[href='/admin/messaging/d1']"));
  await result.unmount();
});

test("SendLegalNotice: 注意をいつも出し、メールがオフなら警告の色", async () => {
  const on = await render(createElement(parts.SendLegalNotice, { emailOn: true }));
  const onNote = on.container.querySelector("p");
  assert.ok(onNote?.textContent?.includes("経路にメールを含めてください"));
  assert.ok(onNote?.className.includes("text-muted-foreground"));
  await on.unmount();
  const off = await render(createElement(parts.SendLegalNotice, { emailOn: false }));
  const offNote = off.container.querySelector("p");
  assert.ok(offNote?.textContent?.includes("経路にメールを含めてください"));
  assert.ok(offNote?.className.includes("text-warning-text"));
  await off.unmount();
});
