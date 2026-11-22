// 送るモーダルの部品(props だけ)の検査。jsdom の上で描く(押す操作のある部品)・文字で見る。
// - SendLayoutPicker: 選べるレイアウトの選択(値 = 今のレイアウト、選ぶと onChange(鍵))/ 選べるレイアウトが無ければテンプレートの読み込みを促す
// - SendTemplatePicker: 任意の読み込みの道具。「テンプレートを読み込む」の小窓で選ぶ(公開中は版)/ 無ければその知らせ /
//   読み込んだ後は名前・版・直した印・別の読み込み・「テンプレートの読み込みを解除」
// - SendVarInputs: 読み込んだテンプレートの専用の埋め込み情報の入力(別名・必須の印・{{別名}}・型ごとの入力・既定値は仮の文・未入力の印・値の受け渡し)
// - SendTargetPicker: bulk は選んだ記録の数だけ / select は種類の選び、グループは名前(種類)で選び id は出さない、
//   グループが無く門 userGroups も閉なら選択肢に出さない(門が開なら 0 件でも出す)
// - SendCategoryChannels: カテゴリーが無い文言・送信チャンネルの切り替え・未入力の印(オンの送信チャンネルだけ)
// - SendSchedule: 予約の時だけ時刻・注記・誤り
// - SendLegalNotice: 法の義務の告知の注意(D83)をいつも出し、メールがオフなら警告の色
// - SendConfirmView / SendResultView: 見込み・上限超え・一括の数・予約・版 / 状態・後処理・送信へのリンク(一覧の上の詳細 ?dispatch=<id>)
// 実行: pnpm test src/domains/core/messaging/components/MessageSendModal/parts.test.tsx
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

// 入力の部品は Radix を jsdom で動かさない偽物(値と押すだけ)。受けた props は id / aria-label ごとに控える
const selects: { label?: string; onChange: (v: string) => void }[] = [];
const inputs = new Map<string, Record<string, unknown>>();
const keep = (props: Record<string, unknown>) => {
  const name = (props.id ?? props["aria-label"]) as string | undefined;
  if (name) inputs.set(name, props);
};
mock.module("@/components/Input/Select", {
  namedExports: {
    SelectInput: (props: { "aria-label"?: string; id?: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) => {
      keep(props);
      selects.push({ label: props["aria-label"] ?? props.id, onChange: props.onChange });
      return createElement("span", { "data-select": props["aria-label"] ?? props.id }, props.options.map((o) => o.label).join("|"));
    },
  },
});
mock.module("@/components/Input/RadioGroupInput", {
  namedExports: {
    RadioGroupInput: (props: { value: string; options?: { value: string; label: string }[] }) =>
      createElement("span", { "data-radio": props.value, "data-options": (props.options ?? []).map((o) => o.value).join("|") }),
  },
});
mock.module("@/components/Input/MultiSelectInput", {
  namedExports: {
    MultiSelectInput: () => createElement("span", { "data-multi": "1" }),
  },
});
mock.module("@/components/Input/DatetimeInput", {
  namedExports: {
    DatetimeInput: (props: Record<string, unknown>) => {
      keep(props);
      return createElement("input", { "data-datetime": "1", id: props.id as string | undefined });
    },
  },
});
mock.module("@/components/Input/DateInput", {
  namedExports: {
    DateInput: (props: Record<string, unknown>) => {
      keep(props);
      return createElement("input", { "data-date": "1", id: props.id as string | undefined });
    },
  },
});
mock.module("@/components/Input/Input", {
  namedExports: {
    Input: (props: Record<string, unknown>) => {
      keep(props);
      return createElement("input", { id: props.id as string, type: props.type as string, defaultValue: props.value as string, placeholder: props.placeholder as string });
    },
  },
});
// next/link は jsdom で動かない(requestIdleCallback)ので、ボタンの部品も偽物
mock.module("@/components/Button/Button", {
  namedExports: {
    Button: (props: { children?: unknown; disabled?: boolean; onClick?: () => void; "aria-pressed"?: boolean }) =>
      createElement(
        "button",
        { type: "button", disabled: props.disabled, onClick: props.onClick, "aria-pressed": props["aria-pressed"] },
        props.children as never,
      ),
  },
});
mock.module("@/components/Button/LinkButton", {
  namedExports: {
    LinkButton: (props: { href: string; children?: unknown }) => createElement("a", { href: props.href }, props.children as never),
  },
});
// テンプレートを選ぶ小窓は偽物: 引き金と、選択肢ごとに「読む:<名前>」のボタン(押すと onConfirm)
type FakePopoverProps = {
  trigger: unknown;
  options: { value: string; label: string; description?: string }[];
  confirmLabel?: string;
  onConfirm: (v: string) => void;
};
let popoverProps: FakePopoverProps | null = null;
mock.module("@/components/Overlays/Popover", {
  namedExports: {
    SelectPopover: (props: FakePopoverProps) => {
      popoverProps = props;
      return createElement(
        "div",
        null,
        props.trigger as never,
        ...props.options.map((o) => createElement("button", { key: o.value, type: "button", onClick: () => props.onConfirm(o.value) }, `読む:${o.label}`)),
      );
    },
  },
});
mock.module("@/domains/core/user/components/common/UserAsyncMultiSelect", {
  namedExports: { UserAsyncMultiSelect: () => createElement("span", { "data-users": "1" }) },
});

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let parts: {
  SendLayoutPicker: typeof import("../common/SendLayoutPicker").SendLayoutPicker;
  SendTemplatePicker: typeof import("../common/SendTemplatePicker").SendTemplatePicker;
  SendVarInputs: typeof import("../common/SendTemplatePicker").SendVarInputs;
  SendTargetPicker: typeof import("../common/SendTargetPicker").SendTargetPicker;
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
    ...(await import("../common/SendLayoutPicker")),
    ...(await import("../common/SendTemplatePicker")),
    ...(await import("../common/SendTargetPicker")),
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

test("SendTemplatePicker: 「テンプレートを読み込む」の小窓で選ぶ / 読み込んだ後は名前と版・別の読み込み・解除", async () => {
  const loaded: string[] = [];
  let unloaded = 0;
  const templates = [
    { id: "t0", name: "秋", currentVersion: 1 },
    { id: "t1", name: "春", currentVersion: 2 },
  ];
  const view = await render(
    createElement(parts.SendTemplatePicker, {
      templates,
      loaded: null,
      onLoad: (id: string) => void loaded.push(id),
      onUnload: () => void (unloaded += 1),
    }),
  );
  // 読み込んでいない = 読み込む口だけ(レイアウトは SendLayoutPicker)
  assert.doesNotMatch(view.container.textContent ?? "", /シンプル/);
  assert.ok(button(view.container, "テンプレートを読み込む"));
  assert.equal(button(view.container, "呼び出す"), undefined, "呼び出すの段は無い");
  assert.equal(popoverProps!.confirmLabel, "読み込む");
  assert.deepEqual(
    popoverProps!.options.map((o) => o.description),
    ["v1", "v2"],
    "公開中は版",
  );
  await act(async () => button(view.container, "読む:春")!.click());
  assert.deepEqual(loaded, ["t1"]);
  await view.unmount();

  // その種別のテンプレートが無い = 読み込む口は押せず、知らせ
  const none = await render(
    createElement(parts.SendTemplatePicker, { templates: [], loaded: null, onLoad: () => {}, onUnload: () => {} }),
  );
  assert.equal(button(none.container, "テンプレートを読み込む")!.disabled, true);
  assert.match(none.container.textContent ?? "", /この種別のテンプレートはありません/);
  await none.unmount();

  const on = await render(
    createElement(parts.SendTemplatePicker, {
      templates,
      loaded: { id: "t1", name: "春", version: 2, edited: true },
      onLoad: () => {},
      onUnload: () => void (unloaded += 1),
    }),
  );
  assert.match(on.container.textContent ?? "", /春\(v2\)/);
  assert.match(on.container.textContent ?? "", /直した文面/);
  assert.ok(button(on.container, "別のテンプレートを読み込む"));
  await act(async () => button(on.container, "テンプレートの読み込みを解除")!.click());
  assert.equal(unloaded, 1);
  await on.unmount();
});

test("SendLayoutPicker: 選べるレイアウトの選択 / 無ければテンプレートの読み込みを促す", async () => {
  const chosen: string[] = [];
  selects.length = 0;
  const view = await render(
    createElement(parts.SendLayoutPicker, {
      layouts: [
        { key: "simple", label: "シンプル" },
        { key: "notice", label: "汎用のお知らせ" },
      ],
      value: "simple",
      onChange: (key: string) => void chosen.push(key),
    }),
  );
  assert.equal(view.container.querySelector("[data-select=send-layout]")?.textContent, "シンプル|汎用のお知らせ");
  assert.equal(inputs.get("send-layout")!.value, "simple");
  await act(async () => selects.at(-1)!.onChange("notice"));
  await act(async () => selects.at(-1)!.onChange(""));
  assert.deepEqual(chosen, ["notice"], "空の値は渡さない");
  await view.unmount();

  // テンプレートを読み込んだ間(選べないレイアウト)= 値は空の表示
  const off = await render(createElement(parts.SendLayoutPicker, { layouts: [{ key: "simple", label: "シンプル" }], value: "legacy", onChange: () => {} }));
  assert.equal(inputs.get("send-layout")!.value, "");
  await off.unmount();

  const none = await render(createElement(parts.SendLayoutPicker, { layouts: [], value: null, onChange: () => {} }));
  assert.match(none.container.textContent ?? "", /管理画面で選べるレイアウトが無いため、テンプレートを読み込んでください/);
  await none.unmount();
});

test("SendVarInputs: 専用の埋め込み情報の欄 / 必須と未入力の印 / 既定値は仮の文 / 値の受け渡し", async () => {
  const changes: [string, string][] = [];
  inputs.clear();
  const view = await render(
    createElement(parts.SendVarInputs, {
      declarations: [
        { key: "discount", alias: "割引", type: "number", required: true },
        { key: "plan", alias: "プラン", type: "select", required: false, options: [{ value: "gold", label: "ゴールド" }], default: "gold" },
        { key: "until", alias: "期限", type: "date", required: false },
      ],
      values: { discount: "10" },
      onChange: (key: string, value: string) => void changes.push([key, value]),
      missing: ["discount"],
    }),
  );
  const text = view.container.textContent ?? "";
  assert.match(text, /割引 \*/, "必須の印");
  assert.match(text, /\{\{割引\}\}/, "書ける名前は {{別名}}");
  assert.doesNotMatch(text, /プラン \*/, "任意は印なし");
  assert.equal(text.match(/入力してください/g)?.length, 1, "未入力の印は missing の鍵だけ");
  const discount = inputs.get("send-vars-discount")!;
  assert.equal(discount.type, "number");
  assert.equal(discount.value, "10");
  assert.equal(inputs.get("send-vars-plan")!.placeholder, "初期値: ゴールド", "選択肢の既定値は表示名で");
  assert.ok(inputs.get("send-vars-until"), "日付の型は日付の入力");
  (discount.onChange as (e: { target: { value: string } }) => void)({ target: { value: "20" } });
  assert.deepEqual(changes, [["discount", "20"]]);
  await view.unmount();

  const none = await render(createElement(parts.SendVarInputs, { declarations: [], values: {}, onChange: () => {} }));
  assert.match(none.container.textContent ?? "", /このテンプレートに専用の埋め込み情報はありません/);
  await none.unmount();
});

test("SendTargetPicker: bulk は記録の数、select は種類の選び、グループは名前(種類)で id を出さない", async () => {
  const bulk = await render(createElement(parts.SendTargetPicker, { kind: "bulk", recordCount: 3, recordNoun: "振込レビュー" }));
  assert.match(bulk.container.textContent ?? "", /選択した 3 件の振込レビュー/);
  await bulk.unmount();
  const value = { type: "users" as const, roles: [], groupId: "", userIds: [] };
  const noGroups = await render(createElement(parts.SendTargetPicker, { kind: "select", value, onChange: () => {}, roles: [] }));
  assert.ok(noGroups.container.querySelector("[data-users]"));
  assert.equal(noGroups.container.querySelector("[data-radio]")?.getAttribute("data-options"), "all|role|users", "グループが無ければ選択肢に出さない");
  await noGroups.unmount();
  // 門 userGroups が開なら 0 件でも選択肢を出す(操作の途中で消えないように)
  const gateOpen = await render(createElement(parts.SendTargetPicker, { kind: "select", value, onChange: () => {}, roles: [], groupsEnabled: true }));
  assert.equal(gateOpen.container.querySelector("[data-radio]")?.getAttribute("data-options"), "all|role|group|users");
  await gateOpen.unmount();
  const GROUP_ID = "33333333-3333-4333-8333-333333333333";
  const picked: unknown[] = [];
  selects.length = 0;
  const withGroups = await render(
    createElement(parts.SendTargetPicker, {
      kind: "select",
      value: { ...value, type: "group" as const },
      onChange: (patch: unknown) => void picked.push(patch),
      roles: [],
      groups: [{ id: GROUP_ID, label: "常連", kindLabel: "動的" }],
      note: "前の回のグループは今は選べません",
    }),
  );
  assert.equal(withGroups.container.querySelector("[data-radio]")?.getAttribute("data-options"), "all|role|group|users");
  assert.match(withGroups.container.textContent ?? "", /常連\(動的\)/);
  assert.match(withGroups.container.textContent ?? "", /前の回のグループは今は選べません/);
  assert.doesNotMatch(withGroups.container.textContent ?? "", new RegExp(GROUP_ID));
  selects.find((item) => item.label === "グループ")!.onChange(GROUP_ID);
  assert.deepEqual(picked, [{ groupId: GROUP_ID }]);
  await withGroups.unmount();
});

test("SendCategoryChannels: カテゴリーが無い文言・送信チャンネルの切り替え・未入力の印", async () => {
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
      onToggleChannel: (key: string, on: boolean) => void toggles.push([key, on]),
    }),
  );
  assert.equal(view.container.textContent?.match(/未入力/g)?.length, 1, "オンの送信チャンネルだけ印");
  assert.equal(button(view.container, "メール")!.getAttribute("aria-pressed"), "true");
  const inApp = button(view.container, "お知らせ")!;
  assert.equal(inApp.getAttribute("aria-pressed"), "false");
  await act(async () => inApp.click());
  assert.deepEqual(toggles, [["inApp", true]]);
  await view.unmount();
  const none = await render(
    createElement(parts.SendCategoryChannels, { categories: [], category: "", onCategoryChange: () => {}, channels: [], onToggleChannel: () => {} }),
  );
  assert.match(none.container.textContent ?? "", /この種別に使えるカテゴリーがありません/);
  await none.unmount();
});

test("SendSchedule: 予約の時だけ時刻・注記・誤り", async () => {
  const now = await render(
    createElement(parts.SendSchedule, { mode: "now", scheduledAt: "", error: null, note: "注記", onModeChange: () => {}, onScheduledAtChange: () => {} }),
  );
  assert.equal(now.container.querySelector("[data-datetime]"), null);
  assert.doesNotMatch(now.container.textContent ?? "", /注記/);
  await now.unmount();
  const at = await render(
    createElement(parts.SendSchedule, {
      mode: "at",
      scheduledAt: "",
      error: "予約日時を入力してください",
      note: "粒度の注記",
      onModeChange: () => {},
      onScheduledAtChange: () => {},
    }),
  );
  assert.ok(at.container.querySelector("[data-datetime]"));
  assert.match(at.container.textContent ?? "", /粒度の注記/);
  assert.match(at.container.textContent ?? "", /予約日時を入力してください/);
  await at.unmount();
});

test("SendConfirmView / SendResultView", async () => {
  const confirm = await render(
    createElement(parts.SendConfirmView, {
      estimate: { count: 12 },
      scheduledAt: null,
      templateVersion: 3,
      channels: ["メール"],
      categoryLabel: "キャンペーン",
    }),
  );
  assert.match(confirm.container.textContent ?? "", /12 名\(送信時に再集計します\)/);
  assert.match(confirm.container.textContent ?? "", /今すぐ送信します/);
  assert.match(confirm.container.textContent ?? "", /v3/);
  assert.equal(confirm.container.querySelector('[data-slot="send-confirm-over-limit"]'), null);
  await confirm.unmount();
  const scheduledAt = "2026-12-01T03:00:00.000Z";
  const scheduled = await render(
    createElement(parts.SendConfirmView, {
      estimate: { count: 1 },
      scheduledAt,
      templateVersion: null,
      channels: ["メール"],
      categoryLabel: "キャンペーン",
    }),
  );
  assert.ok((scheduled.container.textContent ?? "").includes(`${new Date(scheduledAt).toLocaleString("ja-JP")} に予約します`));
  assert.doesNotMatch(scheduled.container.textContent ?? "", /今すぐ送信します/);
  await scheduled.unmount();
  const over = await render(
    createElement(parts.SendConfirmView, {
      estimate: { count: 150_000, overLimit: true, memberLimit: 100_000 },
      scheduledAt: null,
      templateVersion: null,
      channels: ["メール"],
      categoryLabel: "キャンペーン",
    }),
  );
  assert.match(over.container.textContent ?? "", /宛先数 150,000 人が上限 100,000 人を超えているため送信できません/);
  await over.unmount();
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
  assert.match(bulk.container.textContent ?? "", /選択した 2 件の振込レビューに関連するユーザー/);
  await bulk.unmount();
  const result = await render(
    createElement(parts.SendResultView, {
      status: "processing",
      queuedCount: 0,
      dispatchHref: "/admin/messaging?dispatch=d1",
      afterSend: { ok: false, error: "x" },
      recordNoun: "振込レビュー",
    }),
  );
  assert.match(result.container.textContent ?? "", /送信を受け付けました/);
  assert.doesNotMatch(result.container.textContent ?? "", /queued/, "状態は表示名(鍵は出さない)");
  assert.match(result.container.textContent ?? "", /振込レビューの送信後の処理に失敗しました: x/);
  assert.ok(result.container.querySelector("a[href='/admin/messaging?dispatch=d1']"));
  await result.unmount();
  const noLink = await render(createElement(parts.SendResultView, { status: "scheduled", queuedCount: 0, dispatchHref: null }));
  assert.match(noLink.container.textContent ?? "", /予約しました/);
  assert.equal(noLink.container.querySelector("a"), null);
  await noLink.unmount();
});

test("SendLegalNotice: 注意をいつも出し、メールがオフなら警告の色", async () => {
  const on = await render(createElement(parts.SendLegalNotice, { emailOn: true }));
  const onNote = on.container.querySelector("p");
  assert.ok(onNote?.textContent?.includes("送信方法にメールを含めてください"));
  assert.ok(onNote?.className.includes("text-muted-foreground"));
  await on.unmount();
  const off = await render(createElement(parts.SendLegalNotice, { emailOn: false }));
  const offNote = off.container.querySelector("p");
  assert.ok(offNote?.textContent?.includes("送信方法にメールを含めてください"));
  assert.ok(offNote?.className.includes("text-warning-text"));
  await off.unmount();
});
