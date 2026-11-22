// 定義連絡の汎用の送るモーダルの流れ useDefinitionSendModal の検査(jsdom の上で描く。client service・門・離れる前の確認・send/options は偽物)。
// - 選択肢: 記録の入口は ?recordTarget、broadcast は ?entry=broadcast。開いている間だけ取る
// - 連絡定義: 1 つならそれ、2 つ以上は選ぶまで送れない、0 個は「送れる連絡がありません」
// - broadcast は門 messagingBroadcast が閉なら available = false で何も取らない。宛先の種類は定義の adminTargets の全員・ロール・グループ
// - 送信チャンネル: off は出さない、on は外せない、初めは initialChannels / required = 文面の箱なし・メールは外せない
// - 管理者の値: 必須が空なら送れない、数は読み替え
// - 表示例・テスト・送る: 口の本文(entry・channels・vars・触っていない欄は edits に入れない・鍵)、送ると結果の段・鍵を作り直し・onSent
// - changedEdits: 変えた欄だけ
// 実行: pnpm test src/domains/core/messaging/hooks/definitionSendModal.test.tsx
import { after, before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.HTMLElement = dom.window.HTMLElement;
g.Node = dom.window.Node;
g.IS_REACT_ACT_ENVIRONMENT = true;

const LAYOUT = {
  key: "simple",
  label: "シンプル",
  version: 1,
  fields: { title: { type: "line", label: "件名" }, body: { type: "paragraph", label: "本文" } },
};
const definition = (key: string, over: Record<string, unknown> = {}) => ({
  key,
  label: `連絡 ${key}`,
  layout: LAYOUT,
  editableFields: ["title"],
  values: { title: "お知らせ" },
  adminVars: [],
  channels: { email: "free", inApp: "on", line: "off" },
  initialChannels: ["inApp"],
  required: false,
  adminTargets: ["records"],
  adminText: null,
  ...over,
});

let definitions: Record<string, unknown>[] = [];
const calls: unknown[][] = [];
mock.module("@/domains/core/messaging/services/client/definitionSendClient", {
  namedExports: {
    getAdminDefinitionOptions: async (query: Record<string, unknown>) => {
      calls.push(["options", query]);
      return { recordTarget: "recordTarget" in query ? { key: query.recordTarget, label: "振込レビュー" } : null, definitions };
    },
    sendAdminDefinition: async (input: unknown) => {
      calls.push(["send", input]);
      return { dispatchId: "d1", status: "queued", counts: { recipientCount: 2, channelCounts: {}, queuedCount: 0 }, afterSend: null };
    },
    previewAdminDefinition: async (input: unknown) => {
      calls.push(["preview", input]);
      return { messageKey: "k", channels: [] };
    },
    sendAdminDefinitionTest: async (input: unknown) => {
      calls.push(["test", input]);
      return { dispatchId: "t1", status: "completed", counts: { recipientCount: 1, channelCounts: {}, queuedCount: 0 } };
    },
  },
});
mock.module("@/domains/core/messaging/hooks/useAdminSendOptions", {
  namedExports: {
    useAdminSendOptions: (enabled: boolean) => {
      if (enabled) calls.push(["sendOptions"]);
      return { options: enabled ? { roles: [{ id: "admin", label: "管理者" }], groups: [], maxScheduleDays: 30 } : null, error: null, isLoading: false };
    },
  },
});
let broadcastOpen = true;
mock.module("@/featureGate/client", { namedExports: { useGate: () => ({ enabled: (name: string) => name !== "messagingBroadcast" || broadcastOpen }) } });
mock.module("@/lib/unsavedGuard", { namedExports: { useUnsavedGuard: () => {} } });

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let SWRConfig: typeof import("swr").SWRConfig;
let hook: typeof import("./useDefinitionSendModal");
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  ({ SWRConfig } = await import("swr"));
  hook = await import("./useDefinitionSendModal");
});
after(() => dom.window.close());
beforeEach(() => {
  calls.length = 0;
  broadcastOpen = true;
  definitions = [definition("bankTransferReview.statement")];
});

type State = ReturnType<typeof import("./useDefinitionSendModal").useDefinitionSendModal>;
type Options = Parameters<typeof import("./useDefinitionSendModal").useDefinitionSendModal>[0];
const RECORDS: Options["entry"] = { type: "records", recordTarget: "bankTransferReview.reviews", recordIds: ["r1", "r2"] };
/** 連絡定義の並びを替えるテストは項目の鍵(= 選択肢の SWR の鍵)を分ける(前のテストの取得を持ち越さない) */
const recordsOf = (recordTarget: string): Options["entry"] => ({ type: "records", recordTarget, recordIds: ["r1", "r2"] });

const mount = async (options: Options) => {
  const latest: { current: State | null } = { current: null };
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const Probe = () => {
    latest.current = hook.useDefinitionSendModal(options);
    return null;
  };
  await act(async () =>
    root.render(createElement(SWRConfig, { value: { provider: () => new Map(), dedupingInterval: 0 } }, createElement(Probe))),
  );
  return { m: () => latest.current!, unmount: () => act(async () => root.unmount()) };
};
const settle = () => act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
const openIt = async (view: { m: () => State }) => {
  await act(async () => view.m().setOpen(true));
  await settle();
};

test("記録の入口: 開いている間だけ項目の選択肢を取り、1 つならその連絡定義。送信チャンネルの固定", async () => {
  const view = await mount({ entry: RECORDS });
  await settle();
  assert.equal(calls.length, 0, "閉じている間は取らない");
  await openIt(view);
  const m = view.m();
  assert.deepEqual(calls[0], ["options", { recordTarget: "bankTransferReview.reviews" }]);
  assert.equal(calls.some((call) => call[0] === "sendOptions"), false, "記録の入口は send/options を取らない");
  assert.equal(m.definition?.key, "bankTransferReview.statement");
  assert.equal(m.recordNoun, "振込レビュー");
  assert.equal(m.recordCount, 2);
  assert.equal(m.showSchedule, false);
  assert.deepEqual(m.channels, [
    { key: "email", label: "メール", on: false, locked: false },
    { key: "inApp", label: "サービス内通知", on: true, locked: true },
  ]);
  assert.equal(m.canEdit, true);
  assert.equal(m.canSend, true);
  // on は外せない、free は入り切り
  await act(async () => view.m().toggleChannel("inApp", false));
  await act(async () => view.m().toggleChannel("email", true));
  assert.deepEqual(view.m().sendChannels, ["email", "inApp"]);
  await view.unmount();
});

test("連絡定義が 2 つ以上は選ぶまで送れない、0 個は送れる連絡がない", async () => {
  definitions = [definition("a.one"), definition("a.two")];
  const view = await mount({ entry: recordsOf("t.many") });
  await openIt(view);
  assert.equal(view.m().definition, null);
  assert.equal(view.m().definitionError, "送る連絡を選んでください");
  assert.equal(view.m().canSend, false);
  await act(async () => view.m().chooseDefinition("a.two"));
  assert.equal(view.m().definition?.key, "a.two");
  assert.equal(view.m().canSend, true);
  await view.unmount();

  definitions = [];
  const none = await mount({ entry: recordsOf("t.none") });
  await openIt(none);
  assert.equal(none.m().definitionError, "送れる連絡がありません");
  assert.equal(none.m().canSend, false);
  await none.unmount();
});

test("broadcast: 門が閉なら使えず取らない。開なら宛先の種類は adminTargets の全員・ロール・グループ", async () => {
  broadcastOpen = false;
  const closed = await mount({ entry: { type: "broadcast" } });
  await openIt(closed);
  assert.equal(closed.m().available, false);
  assert.equal(calls.length, 0);
  await closed.unmount();

  broadcastOpen = true;
  definitions = [definition("notice.campaign", { adminTargets: ["records", "role"] })];
  const view = await mount({ entry: { type: "broadcast" } });
  await openIt(view);
  const m = view.m();
  assert.equal(m.available, true);
  assert.deepEqual(calls.find((call) => call[0] === "options"), ["options", { entry: "broadcast" }]);
  assert.ok(calls.some((call) => call[0] === "sendOptions"));
  assert.deepEqual(m.allowedTargetTypes, ["role"]);
  assert.equal(m.target.type, "role", "許さない形は最初の許す種類に読み替える");
  assert.equal(m.targetError, "ロールを選んでください");
  assert.equal(m.showSchedule, true);
  await act(async () => view.m().setTarget({ roles: ["admin"] }));
  assert.equal(view.m().targetError, null);
  await act(async () => {
    await view.m().runPreview();
  });
  assert.deepEqual((calls.find((call) => call[0] === "preview")![1] as { entry: unknown }).entry, {
    message: "notice.campaign",
    target: { type: "role", roles: ["admin"] },
  });
  await view.unmount();
});

test("required: 文面の箱なし・メールは外せない", async () => {
  definitions = [definition("legal.terms", { required: true, editableFields: [], channels: { email: "free", inApp: "free" }, initialChannels: ["inApp"] })];
  const view = await mount({ entry: recordsOf("t.required") });
  await openIt(view);
  const m = view.m();
  assert.equal(m.canEdit, false);
  assert.deepEqual(
    m.channels.map((channel) => [channel.key, channel.on, channel.locked]),
    [
      ["email", true, true],
      ["inApp", true, false],
    ],
  );
  await act(async () => view.m().toggleChannel("email", false));
  assert.ok(view.m().sendChannels.includes("email"));
  await view.unmount();
});

test("管理者の値: 必須が空なら送れない、数は読み替えて送る", async () => {
  definitions = [
    definition("shop.coupon", {
      adminVars: [
        { key: "amount", alias: "金額", type: "number", required: true },
        { key: "note", alias: "メモ", type: "text", required: false },
      ],
    }),
  ];
  const view = await mount({ entry: recordsOf("t.vars") });
  await openIt(view);
  assert.equal(view.m().canSend, false);
  assert.match(view.m().contentError ?? "", /金額/);
  await act(async () => view.m().setVar("amount", "500"));
  assert.equal(view.m().canSend, true);
  assert.deepEqual(view.m().buildContent().vars, { amount: 500 });
  await view.unmount();
});

test("表示例・テスト・送る: 本文、触っていない欄は edits に入れない、送ると結果の段・鍵を作り直し・onSent", async () => {
  const sent: unknown[] = [];
  const view = await mount({ entry: RECORDS, onSent: (result) => sent.push(result) });
  await openIt(view);
  await act(async () => {
    await view.m().runPreview();
    await view.m().sendTest();
  });
  const preview = calls.find((call) => call[0] === "preview")![1] as Record<string, unknown>;
  assert.deepEqual(preview, {
    entry: { recordTarget: "bankTransferReview.reviews", recordIds: ["r1", "r2"], message: "bankTransferReview.statement" },
    channels: ["inApp"],
  });
  assert.equal(typeof (calls.find((call) => call[0] === "test")![1] as { idempotencyKey?: string }).idempotencyKey, "string");
  assert.deepEqual(view.m().preview, { messageKey: "k", channels: [] });

  await act(async () => {
    await view.m().requestConfirm();
  });
  assert.equal(view.m().step, "confirm");
  const key = view.m().buildSendInput().idempotencyKey;
  await act(async () => {
    await view.m().confirmSend();
  });
  const body = calls.find((call) => call[0] === "send")![1] as Record<string, unknown>;
  assert.equal(body.idempotencyKey, key);
  assert.equal("edits" in body, false);
  assert.equal("scheduledAt" in body, false, "記録の入口は予約しない");
  assert.equal(view.m().step, "done");
  assert.equal(view.m().result?.dispatchId, "d1");
  assert.notEqual(view.m().buildSendInput().idempotencyKey, key, "成功で鍵を作り直す");
  assert.equal(sent.length, 1);
  // 閉じると初めに戻る
  await act(async () => view.m().setOpen(false));
  assert.deepEqual([view.m().step, view.m().result], ["edit", null]);
  await view.unmount();
});

test("changedEdits: 変えた欄だけ / definitionChannelsOf / broadcastTypesOf", () => {
  assert.deepEqual(hook.changedEdits({ title: "a", body: "b" }, { title: "a", body: "c" }), { body: "c" });
  assert.deepEqual(hook.changedEdits({ title: "a" }, { title: "a" }), {});
  assert.deepEqual(hook.definitionChannelsOf({ channels: { email: "free", inApp: "on", line: "off" }, required: false }), {
    keys: ["email", "inApp"],
    locked: ["inApp"],
  });
  assert.deepEqual(hook.definitionChannelsOf({ channels: { email: "free" }, required: true }).locked, ["email"]);
  assert.deepEqual(hook.broadcastTypesOf(["group", "records", "all"]), ["all", "group"]);
});
