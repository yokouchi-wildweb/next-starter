// 管理の送る画面の hook の検査(jsdom の上で描く。client service・離れる前の確認は偽物)。
// - templateVarsForInput: 回の変数だけ、数の型は数、空は送らない
// - useAdminSendComposer: テンプレート / その場で書くの入力、宛先の形、取引は選んだ利用者宛てだけ(宛先を変えたら marketing に戻る)、
//   予約の時刻の検査、見込み・プレビュー・テスト送信・送る(鍵を作り直す)・書きかけの確認
// 実行: pnpm test src/features/core/messaging/hooks/sendHooks.test.tsx
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

const TEMPLATE_ID = "11111111-1111-4111-8111-111111111111";
const template = {
  id: TEMPLATE_ID,
  key: "spring",
  name: "春",
  category: "marketing",
  channels: ["email", "inApp"],
  currentVersion: 2,
  variables: [
    { key: "discount", label: "割引", type: "number", required: true, source: "dispatch" },
    { key: "note", label: "メモ", type: "string", required: false, source: "dispatch" },
    { key: "nick", label: "呼び名", type: "string", required: false, source: "recipient" },
  ],
};
const OPTIONS = {
  channels: [
    { key: "email", label: "メール", adhoc: true },
    { key: "inApp", label: "お知らせ", adhoc: true },
  ],
  roles: [{ id: "user", label: "利用者" }],
  audiences: [],
  templates: [template],
  maxScheduleDays: 90,
};

const calls: unknown[][] = [];
mock.module("@/features/core/messaging/services/client/sendClient", {
  namedExports: {
    adminSendMessage: async (input: unknown) => {
      calls.push(["send", input]);
      return { dispatchId: "d1", status: "queued", queuedCount: 0, channelCounts: {} };
    },
    previewAdminMessage: async (input: unknown) => {
      calls.push(["preview", input]);
      return { messageKey: "messaging.adminMessage", kind: "marketing", category: "marketing", template: null, channels: [] };
    },
    estimateAdminRecipients: async (input: unknown) => {
      calls.push(["estimate", input]);
      return { count: 12, capped: false, fixedAtSend: true };
    },
    sendAdminTestMessage: async (input: unknown) => {
      calls.push(["test", input]);
      return { dispatchId: "t1", status: "completed", queuedCount: 0, channelCounts: {} };
    },
    getAdminSendOptions: async () => OPTIONS,
  },
});
const guarded: boolean[] = [];
mock.module("@/lib/unsavedGuard", { namedExports: { useUnsavedGuard: (when: boolean) => void guarded.push(when) } });

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let hooks: typeof import("./index");
let SWRConfig: typeof import("swr").SWRConfig;
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  ({ SWRConfig } = await import("swr"));
  hooks = await import("./index");
});
after(() => dom.window.close());
beforeEach(() => {
  calls.length = 0;
  guarded.length = 0;
});

const mount = async <T,>(useHook: () => T) => {
  const latest: { current: T | null } = { current: null };
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const Probe = ({ report }: { report: (value: T) => void }) => {
    report(useHook());
    return null;
  };
  await act(async () => {
    root.render(
      createElement(
        SWRConfig,
        { value: { provider: () => new Map(), dedupingInterval: 0 } },
        createElement(Probe, { report: (value: T) => (latest.current = value) }),
      ),
    );
  });
  return { value: () => latest.current!, unmount: () => act(async () => root.unmount()) };
};

test("templateVarsForInput: 回の変数だけ、数は数、空は送らない", () => {
  assert.deepEqual(hooks.templateVarsForInput(template as never, { discount: "15", note: "", nick: "x" }), { discount: 15 });
});

test("テンプレートで送る: 入力の形・必須の変数・見込み・送る(鍵を作り直す)", async () => {
  const view = await mount(() => hooks.useAdminSendComposer(OPTIONS as never));
  const c = () => view.value();
  assert.equal(c().fields.source, "template");
  assert.equal(c().contentError, "テンプレートを選んでください");
  assert.equal(guarded.at(-1), false);
  await act(async () => c().fields.setTemplateId(TEMPLATE_ID));
  assert.deepEqual(c().fields.channels, ["email", "inApp"], "テンプレートの経路を初めの値にする");
  assert.match(c().contentError ?? "", /割引/);
  await act(async () => c().fields.setVarValue("discount", "20"));
  assert.equal(c().canSend, true);
  assert.equal(guarded.at(-1), true);

  const est = await c().runEstimate();
  assert.equal(est.count, 12);
  const firstKey = c().buildInput().idempotencyKey;
  await act(async () => {
    await c().send();
  });
  assert.deepEqual(calls.map((call) => call[0]), ["estimate", "send"]);
  assert.deepEqual(calls[0][1], { audience: { type: "all" } });
  const sent = calls[1][1] as Record<string, unknown>;
  assert.deepEqual(sent.message, { type: "template", templateId: TEMPLATE_ID, vars: { discount: 20 } });
  assert.deepEqual(sent.channels, ["email", "inApp"]);
  assert.equal(sent.kind, "marketing");
  assert.equal(sent.scheduledAt, undefined);
  assert.equal(c().sent?.dispatchId, "d1");
  assert.notEqual(c().buildInput().idempotencyKey, firstKey, "送った後は鍵を作り直す");
  assert.equal(c().dirty, false);
  await view.unmount();
});

test("その場で書く: 経路の中身、取引は選んだ利用者宛てだけ、予約の時刻の検査、プレビュー・テスト送信", async () => {
  const view = await mount(() => hooks.useAdminSendComposer(OPTIONS as never));
  const c = () => view.value();
  await act(async () => c().fields.setSource("adhoc"));
  await act(async () => c().fields.toggleChannel("email", true));
  assert.equal(c().contentError, "メールの件名・本文を入れてください");
  await act(async () => {
    c().fields.setEmailSubject("件名");
    c().fields.setEmailBody("本文");
  });
  assert.equal(c().contentError, null);

  // 全員宛ては取引を選べない
  await act(async () => c().fields.setKind("transactional"));
  assert.equal(c().fields.kind, "marketing");
  await act(async () => c().fields.setAudienceType("users"));
  assert.equal(c().audienceError, "利用者を選んでください");
  await act(async () => {
    c().fields.setUserIds(["u1", "u2"]);
    c().fields.setKind("transactional");
  });
  assert.equal(c().fields.kind, "transactional");
  assert.deepEqual(c().buildAudience(), { type: "users", userIds: ["u1", "u2"] });
  // 宛先を変えたら marketing に戻る
  await act(async () => c().fields.setAudienceType("role"));
  assert.equal(c().fields.kind, "marketing");
  await act(async () => c().fields.setRoles(["user"]));
  assert.deepEqual(c().buildAudience(), { type: "role", roles: ["user"] });

  await act(async () => c().fields.setScheduleMode("at"));
  assert.equal(c().scheduleError, "予約の時刻を入れてください");
  await act(async () => c().fields.setScheduledAt(new Date(Date.now() - 60_000).toISOString()));
  assert.equal(c().scheduleError, "予約の時刻は今より後にしてください");
  await act(async () => c().fields.setScheduledAt(new Date(Date.now() + 400 * 86_400_000).toISOString()));
  assert.match(c().scheduleError ?? "", /90 日先まで/);
  const at = new Date(Date.now() + 86_400_000).toISOString();
  await act(async () => c().fields.setScheduledAt(at));
  assert.equal(c().scheduleError, null);
  assert.equal(c().buildInput().scheduledAt, at);

  await act(async () => {
    await c().runPreview();
    await c().sendTest();
  });
  assert.deepEqual(calls[0], ["preview", { message: { type: "adhoc", email: { subject: "件名", body: "本文" } }, channels: ["email"], kind: "marketing" }]);
  assert.equal(calls[1][0], "test");
  assert.equal(typeof (calls[1][1] as { idempotencyKey: string }).idempotencyKey, "string");
  assert.ok(c().preview);
  await view.unmount();
});
