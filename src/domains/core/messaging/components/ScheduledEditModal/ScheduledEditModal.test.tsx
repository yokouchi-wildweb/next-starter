// 予約した送信の直し(hook useScheduledEdit と入れ物 ScheduledEditModal)の検査(jsdom の上で描く。client service・門・送る画面の選択肢・
// 欄と送信方法の部品は偽物)。
// - PATCH の体は変えた物だけ: 時刻 { scheduledAt } / 欄は変えた欄だけ edits(変えていない欄は入らない)/ 送信方法は集合が変わった時だけ一覧を全部。
//   宛先(target)はどんな時も入らない(accept)/ 何も変えなければ確認に進めない
// - 材料(edit-options)は開いている間だけ読み、予約できる日数は材料から(門 messagingBroadcast に依らない)
// - 送信方法: off は出さない・on は外せない・free は選べる、初めは送信の送信方法。全部外すと確認に進めない
// - 直せる欄だけを欄の部品に渡す(定義連絡の required = 直せる欄なし = 文面の箱なし)
// - canEdit.content が閉 = 理由の文と時刻だけ(欄・送信方法は描かない)
// - 保存の後: onSaved に返った送信、モーダルは閉じる / 409 の文は書く段に出し、確認の段から戻す / canEdit が閉なら入口ごと描かない
// 実行: pnpm test src/domains/core/messaging/components/ScheduledEditModal/ScheduledEditModal.test.tsx
import { after, before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createElement, type ReactNode } from "react";
import { JSDOM } from "jsdom";
import { useController, type Control } from "react-hook-form";

import type { ScheduledEditDispatch } from "@/domains/core/messaging/hooks/useScheduledEdit";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true });
const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.HTMLElement = dom.window.HTMLElement;
g.Node = dom.window.Node;
g.MouseEvent = dom.window.MouseEvent;
g.IS_REACT_ACT_ENVIRONMENT = true;

const NOT_SCHEDULED = "送信を始めた送信は直せません(直せるのは予約のままの送信だけです)";
const BODY_MISSING = "本文を保存していない送信は、予約の時刻だけ直せます";
const patches: { id: string; body: Record<string, unknown> }[] = [];
const optionCalls: string[] = [];
let failWith: string | null = null;

const FIELDS = {
  subject: { type: "line", label: "件名", requiredFor: ["email"] },
  note: { type: "line", label: "補足" },
};
type EditOptions = {
  layout: { key: string; label: string; version: number; fields: Record<string, unknown> } | null;
  editableFields: string[];
  values: Record<string, unknown> | null;
  channels: Record<string, "on" | "off" | "free">;
  maxScheduleDays: number;
};
const FREE_OPTIONS: EditOptions = {
  layout: { key: "notice", label: "汎用", version: 2, fields: FIELDS },
  editableFields: ["subject", "note"],
  values: { subject: "件名", note: "補足の文" },
  channels: { email: "free", inApp: "free", line: "free" },
  maxScheduleDays: 30,
};
const TIME_ONLY_OPTIONS: EditOptions = { layout: null, editableFields: [], values: null, channels: {}, maxScheduleDays: 30 };
let editOptions: EditOptions = FREE_OPTIONS;

mock.module("@/domains/core/messaging/services/client/adminMessagingClient", {
  namedExports: {
    editAdminScheduledDispatch: async (id: string, body: Record<string, unknown>) => {
      patches.push({ id, body });
      if (failWith) throw new Error(failWith);
      return { ...DISPATCH, scheduledAt: (body.scheduledAt as string) ?? DISPATCH.scheduledAt };
    },
    getAdminDispatchEditOptions: async (id: string) => {
      optionCalls.push(id);
      return editOptions;
    },
    // 送る画面の hook(scheduleErrorOf の置き場)が読む名前。この検査では呼ばない
    adminBulkSend: async () => ({}),
    previewAdminBulkMessage: async () => ({}),
    sendAdminBulkTestMessage: async () => ({}),
  },
});
mock.module("@/featureGate/client", { namedExports: { useGate: () => ({ enabled: () => true }) } });
mock.module("@/domains/core/messaging/hooks/useAdminSendOptions", {
  namedExports: {
    useAdminSendOptions: (enabled: boolean) => ({
      // 予約できる日数は材料から読むので、ここの 5 日は使われない
      options: enabled ? { maxScheduleDays: 5, layouts: [{ key: "notice", label: "汎用(送る画面)", version: 1, fields: {}, selectable: true }] } : null,
      error: null,
      isLoading: false,
    }),
  },
});
mock.module("@/lib/toast", { namedExports: { useToast: () => ({ showToast: () => {} }) } });
// Modal は Radix を jsdom で動かさない偽物: 題・中身・下の帯
mock.module("@/components/Overlays/Modal", {
  defaultExport: (props: { open: boolean; title?: ReactNode; children?: ReactNode; footer?: ReactNode }) =>
    props.open ? createElement("section", { "data-testid": "modal" }, props.title, props.children, props.footer) : null,
});
mock.module("@/components/Button/Button", {
  namedExports: {
    Button: (props: { children?: ReactNode; disabled?: boolean; onClick?: () => void }) =>
      createElement("button", { type: "button", disabled: props.disabled, onClick: props.onClick }, props.children),
  },
});
// 予約の時刻の部品: 渡った props を残す
const scheduleProps: Record<string, unknown>[] = [];
mock.module("@/domains/core/messaging/components/common/SendSchedule", {
  namedExports: {
    SendSchedule: (props: Record<string, unknown>) => {
      scheduleProps.push(props);
      return createElement("div", { "data-part": "schedule" });
    },
  },
});
// 欄の部品: 渡った欄を残し、欄 1 つずつ値を変える口(field.onChange)を置く
const fieldProps: Record<string, unknown>[] = [];
const setField: Record<string, (value: unknown) => void> = {};
const keepSetter = (name: string, onChange: (value: unknown) => void) => {
  setField[name] = onChange;
};
function FieldProbe({ control, name }: { control: Control<Record<string, unknown>>; name: string }) {
  const { field } = useController({ control, name });
  keepSetter(name, field.onChange);
  return null;
}
mock.module("@/domains/core/messaging/components/common/LayoutFields", {
  namedExports: {
    LayoutFields: (props: { control: Control<Record<string, unknown>>; fields: Record<string, unknown> }) => {
      fieldProps.push(props as unknown as Record<string, unknown>);
      return createElement(
        "div",
        { "data-slot": "layout-fields" },
        Object.keys(props.fields).map((name) => createElement(FieldProbe, { key: name, control: props.control, name })),
      );
    },
    emptyValueOf: () => "",
  },
});
// 送信方法の部品: 渡った行を残す
const channelProps: { channels: { key: string; on: boolean; locked?: boolean }[]; onToggleChannel: (key: string, on: boolean) => void }[] = [];
mock.module("@/domains/core/messaging/components/common/SendCategoryChannels", {
  namedExports: {
    SendCategoryChannels: (props: (typeof channelProps)[number]) => {
      channelProps.push(props);
      return createElement("div", { "data-slot": "send-category-channels" });
    },
  },
});

const HOUR = 60 * 60 * 1000;
const at = (hours: number) => new Date(Date.now() + hours * HOUR).toISOString();
const flag = (allowed: boolean, reason: string | null = null) => ({ allowed, reason });
const DISPATCH: ScheduledEditDispatch = {
  id: "d1",
  scheduledAt: at(24),
  channels: ["email", "inApp"],
  target: { type: "role", roles: ["admin"], count: 0 },
  targetGroup: null,
  recipientCount: 0,
  content: { layout: "notice", layoutVersion: 1, values: { subject: "件名" } },
  operations: { canEdit: { ...flag(true), content: flag(true) } } as unknown as ScheduledEditDispatch["operations"],
};
const TIME_ONLY: ScheduledEditDispatch = {
  ...DISPATCH,
  operations: { canEdit: { ...flag(true), content: flag(false, "body_missing") } } as unknown as ScheduledEditDispatch["operations"],
};

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let SWRConfig: typeof import("swr").SWRConfig;
let hookMod: typeof import("@/domains/core/messaging/hooks/useScheduledEdit");
let modalMod: typeof import("./index");
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  // hook と同じ swr の写し(tsx では hook が require で読む)の SWRConfig を使う。await import("swr") は別の写しになり、
  // provider の新しい Map が hook に届かず、既定の cache に前のテストの直しの材料(同じ送信の鍵)が残る
  ({ SWRConfig } = (await import("node:module")).createRequire(import.meta.url)("swr") as typeof import("swr"));
  hookMod = await import("@/domains/core/messaging/hooks/useScheduledEdit");
  modalMod = await import("./index");
});
after(() => dom.window.close());
beforeEach(() => {
  patches.length = 0;
  optionCalls.length = 0;
  failWith = null;
  editOptions = FREE_OPTIONS;
  scheduleProps.length = 0;
  fieldProps.length = 0;
  channelProps.length = 0;
  for (const key of Object.keys(setField)) delete setField[key];
});

type Dispatch = ScheduledEditDispatch;
const wrap = (child: ReturnType<typeof createElement>) => createElement(SWRConfig, { value: { provider: () => new Map(), dedupingInterval: 0 } }, child);
/** 非同期の取得を待つ */
const settle = () => act(async () => new Promise((resolve) => setTimeout(resolve, 10)));

async function mountHook(dispatch: Dispatch, onSaved?: (detail: unknown) => void) {
  const box: { current: ReturnType<typeof hookMod.useScheduledEdit> | null } = { current: null };
  function Probe() {
    box.current = hookMod.useScheduledEdit({ dispatch, onSaved });
    return null;
  }
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(wrap(createElement(Probe))));
  return {
    m: () => box.current!,
    run: (fn: () => unknown) => act(async () => void (await fn())),
    unmount: () => act(async () => root.unmount()),
  };
}

async function renderModal(dispatch: Dispatch) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(wrap(createElement(modalMod.ScheduledEditModal, { dispatch, roleLabelOf: (role: string) => `ロール:${role}` }))));
  return {
    container,
    text: () => container.textContent ?? "",
    button: (text: string) => [...container.querySelectorAll("button")].find((b) => (b.textContent ?? "").includes(text)) as HTMLButtonElement | undefined,
    unmount: () => act(async () => root.unmount()),
  };
}

test("scheduledEditInputOf: 変えた物だけ。同じ時刻・空の edits・同じ集合の送信方法は入らず、何も無ければ null。宛先は入らない", () => {
  const next = at(48);
  assert.deepEqual(hookMod.scheduledEditInputOf(DISPATCH, { scheduledAt: next }), { scheduledAt: new Date(next).toISOString() });
  assert.equal(hookMod.scheduledEditInputOf(DISPATCH, { scheduledAt: DISPATCH.scheduledAt! }), null);
  assert.equal(hookMod.scheduledEditInputOf(DISPATCH, { scheduledAt: "" }), null);
  assert.equal(hookMod.scheduledEditInputOf(DISPATCH, { scheduledAt: DISPATCH.scheduledAt!, edits: {}, channels: ["inApp", "email"] }), null);
  assert.deepEqual(hookMod.scheduledEditInputOf(DISPATCH, { scheduledAt: DISPATCH.scheduledAt!, edits: { note: "新" } }), { edits: { note: "新" } });
  assert.deepEqual(hookMod.scheduledEditInputOf(DISPATCH, { scheduledAt: "", channels: ["email"] }), { channels: ["email"] });
  const all = hookMod.scheduledEditInputOf(DISPATCH, { scheduledAt: next, edits: { subject: "新" }, channels: ["email", "line"] })!;
  assert.deepEqual(all, { scheduledAt: new Date(next).toISOString(), edits: { subject: "新" }, channels: ["email", "line"] });
  assert.equal("target" in all, false, "宛先は入らない");
});

test("scheduledEditChannelShape・sameChannelSet", () => {
  assert.deepEqual(hookMod.scheduledEditChannelShape({ email: "on", inApp: "free", line: "off" }), { keys: ["email", "inApp"], locked: ["email"] });
  assert.equal(hookMod.sameChannelSet(["a", "b"], ["b", "a"]), true);
  assert.equal(hookMod.sameChannelSet(["a"], ["a", "b"]), false);
});

test("材料: 開くまで読まず、開いたら読む。予約できる日数は材料から", async () => {
  const view = await mountHook(DISPATCH);
  await settle();
  assert.deepEqual(optionCalls, [], "閉じている間は読まない");
  await view.run(() => view.m().setOpen(true));
  await settle();
  assert.deepEqual(optionCalls, ["d1"]);
  assert.equal(view.m().contentEditable, true);
  assert.equal(view.m().layoutLabel, "汎用", "レイアウトの表示名は材料から");
  assert.match(view.m().scheduleNote, /30 日先まで予約できます/);
  await view.run(() => view.m().setScheduledAt(at(24 * 20)));
  assert.equal(view.m().timeError, null, "材料の 30 日(送る画面の 5 日ではない)");
  await view.unmount();
});

test("時刻だけ変える: PATCH の体は { scheduledAt } だけで、edits・channels・target を持たない。onSaved に返った送信、閉じる", async () => {
  const saved: unknown[] = [];
  const view = await mountHook(DISPATCH, (detail) => saved.push(detail));
  await view.run(() => view.m().setOpen(true));
  await settle();
  assert.equal(view.m().canConfirm, false, "何か変えるまで確認に進めない");
  const next = at(48);
  await view.run(() => view.m().setScheduledAt(next));
  assert.equal(view.m().canConfirm, true);
  await view.run(() => view.m().toConfirm());
  assert.equal(view.m().step, "confirm");
  await view.run(() => view.m().save());
  assert.equal(patches.length, 1);
  assert.equal(patches[0]!.id, "d1");
  assert.deepEqual(patches[0]!.body, { scheduledAt: new Date(next).toISOString() });
  assert.equal("target" in patches[0]!.body, false, "宛先は送らない");
  assert.equal(saved.length, 1);
  assert.equal(view.m().open, false);
  await view.unmount();
});

test("文面: 変えた欄だけが edits に入り、変えていない欄は入らない。宛先は送らない", async () => {
  const view = await renderModal(DISPATCH);
  await act(async () => view.button("予約を編集")!.click());
  await settle();
  const fields = fieldProps.at(-1)!.fields as Record<string, unknown>;
  assert.deepEqual(Object.keys(fields), ["subject", "note"], "直せる欄だけ");
  await act(async () => setField.note!("直した補足"));
  await act(async () => view.button("確認に進む")!.click());
  await settle();
  assert.match(view.text(), /直した欄: 補足/);
  assert.doesNotMatch(view.text(), /予約日時: /, "時刻を変えていなければ時刻の行は出さない");
  await act(async () => view.button("保存する")!.click());
  await settle();
  assert.equal(patches.length, 1);
  assert.deepEqual(patches[0]!.body, { edits: { note: "直した補足" } });
  assert.equal("subject" in (patches[0]!.body.edits as Record<string, unknown>), false, "変えていない欄は送らない");
  assert.equal("target" in patches[0]!.body, false);
  await view.unmount();
});

test("文面: 定義連絡で直せる欄が無い(required)なら欄の部品を描かない", async () => {
  editOptions = { ...FREE_OPTIONS, editableFields: [], channels: { email: "on", inApp: "off" } };
  const view = await renderModal(DISPATCH);
  await act(async () => view.button("予約を編集")!.click());
  await settle();
  assert.equal(view.container.querySelector('[data-slot="layout-fields"]'), null);
  assert.ok(view.container.querySelector('[data-slot="send-category-channels"]'), "送信方法は出す");
  await view.unmount();
});

test("送信方法: off は出さず on は外せない、free は選べる。集合が変わった時だけ一覧を全部送る。全部外すと確認に進めない", async () => {
  editOptions = { ...FREE_OPTIONS, channels: { email: "on", inApp: "free", line: "free", sms: "off" } };
  const view = await mountHook(DISPATCH);
  await view.run(() => view.m().setOpen(true));
  await settle();
  assert.deepEqual(
    view.m().channels.map((c) => [c.key, c.on, c.locked]),
    [
      ["email", true, true],
      ["inApp", true, false],
      ["line", false, false],
    ],
    "初めは送信の送信方法、off は出さない",
  );
  await view.run(() => view.m().toggleChannel("email", false));
  assert.deepEqual(view.m().channelsOn, ["email", "inApp"], "on は外せない");
  assert.equal(view.m().input, null, "同じ集合なら channels を送らない");

  await view.run(() => view.m().toggleChannel("line", true));
  assert.equal(view.m().channelsChanged, true);
  assert.deepEqual(view.m().input, { channels: ["email", "inApp", "line"] }, "変えたら一覧を全部");
  await view.run(() => view.m().toConfirm());
  await view.run(() => view.m().save());
  assert.deepEqual(patches[0]!.body, { channels: ["email", "inApp", "line"] });
  assert.equal("target" in patches[0]!.body, false);
  await view.unmount();

  editOptions = { ...FREE_OPTIONS, channels: { email: "free", inApp: "free" } };
  const none = await mountHook(DISPATCH);
  await none.run(() => none.m().setOpen(true));
  await settle();
  await none.run(() => none.m().toggleChannel("email", false));
  await none.run(() => none.m().toggleChannel("inApp", false));
  assert.equal(none.m().channelsError, "送信方法を 1 つ以上選んでください");
  assert.equal(none.m().canConfirm, false);
  await none.unmount();
});

test("時刻の誤り: 過ぎた・予約できる日数より先は確認に進めない", async () => {
  const view = await mountHook(DISPATCH);
  await view.run(() => view.m().setOpen(true));
  await settle();
  await view.run(() => view.m().setScheduledAt(at(-1)));
  assert.equal(view.m().timeError, "予約日時は現在より後にしてください");
  assert.equal(view.m().canConfirm, false);
  await view.run(() => view.m().setScheduledAt(at(24 * 40)));
  assert.equal(view.m().timeError, "予約できるのは 30 日先までです");
  await view.unmount();
});

test("409: 文を残して書く段に戻し、閉じない", async () => {
  failWith = NOT_SCHEDULED;
  const view = await mountHook(DISPATCH);
  await view.run(() => view.m().setOpen(true));
  await settle();
  await view.run(() => view.m().setScheduledAt(at(48)));
  await view.run(() => view.m().toConfirm());
  await view.run(() => view.m().save());
  assert.equal(view.m().error, NOT_SCHEDULED);
  assert.equal(view.m().step, "edit");
  assert.equal(view.m().open, true);
  await view.unmount();
});

test("入れ物: canEdit が閉なら何も描かない", async () => {
  const closed = await renderModal({ ...DISPATCH, operations: { canEdit: { ...flag(false, "not_scheduled"), content: flag(false, "not_scheduled") } } } as never);
  assert.equal(closed.container.textContent, "");
  await closed.unmount();
});

test("入れ物: 文面の直しが閉なら理由の文と時刻だけ(欄・送信方法は描かない)。時刻だけの送信のレイアウト名は送る画面の選択肢から", async () => {
  editOptions = TIME_ONLY_OPTIONS;
  const view = await renderModal(TIME_ONLY);
  await act(async () => view.button("予約を編集")!.click());
  await settle();
  const text = view.text();
  assert.match(text, /ロール「ロール:admin」/);
  assert.match(text, new RegExp(BODY_MISSING));
  assert.match(text, /レイアウト汎用\(送る画面\)/);
  assert.equal(view.container.querySelector('[data-slot="layout-fields"]'), null, "欄は描かない");
  assert.equal(view.container.querySelector('[data-slot="send-category-channels"]'), null, "送信方法は描かない");
  const schedule = scheduleProps.at(-1)!;
  assert.equal(schedule.showNow, false);
  assert.equal(schedule.mode, "at");
  await act(async () => (schedule.onScheduledAtChange as (v: string) => void)(at(48)));
  await act(async () => view.button("確認に進む")!.click());
  await act(async () => view.button("保存する")!.click());
  await settle();
  assert.deepEqual(Object.keys(patches.at(-1)!.body), ["scheduledAt"], "時刻だけ");
  await view.unmount();
});

test("入れ物: 宛先とレイアウトは見せるだけ、時刻は「今すぐ」なしの SendSchedule。確認の段で前と後の時刻、409 の文を出す", async () => {
  failWith = NOT_SCHEDULED;
  const view = await renderModal(DISPATCH);
  await act(async () => view.button("予約を編集")!.click());
  await settle();
  assert.match(view.text(), /ロール「ロール:admin」/);
  assert.match(view.text(), /レイアウト汎用/);
  assert.ok(view.container.querySelector('[data-slot="layout-fields"]'), "直せる欄を描く");
  await act(async () => (scheduleProps.at(-1)!.onScheduledAtChange as (v: string) => void)(at(48)));
  await act(async () => view.button("確認に進む")!.click());
  await settle();
  assert.match(view.text(), /予約日時: .* → /);
  await act(async () => view.button("保存する")!.click());
  await settle();
  assert.match(view.container.querySelector('[data-slot="scheduled-edit-error"]')?.textContent ?? "", /予約のままの送信だけ/);
  assert.equal("target" in patches.at(-1)!.body, false);
  await view.unmount();
});
