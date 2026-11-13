// 送るモーダルの hook useMessageSendModal の検査(jsdom の上で描く。client service・門・離れる前の確認は偽物)。
// - 純粋な関数: scheduleErrorOf / templateVarsForInput / isBlankChannel / initialDraftOf / initialAudienceOf
// - new: テンプレートを呼び出す → 文言が写る → 直す → カテゴリー(宛先で絞る)→ 経路の絞り(既定は全部オン)→ 文言の無い経路は止める
//   → 予約の検査 → プレビュー・テスト送信 → 見込み → 確認 → 送る(鍵を作り直す)・書きかけの確認・閉じると初めに戻る
// - 門 messagingTemplates が閉ならテンプレートを出さない
// - sameAs: 文面・カテゴリー・宛先の形を写す / テンプレートの回は呼び出しの形
// - bulk: 選んだ記録が宛先、bulk-send の API と bulk のプレビュー・テスト、予約は無い、見込みは取らない
// 実行: pnpm test src/features/core/messaging/hooks/sendModalHooks.test.tsx
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
  category: "campaign",
  currentVersion: 3,
  content: { email: { subject: "{{discount}} 割引", paragraphs: ["本文"] } },
  variables: [{ key: "discount", label: "割引", type: "number", required: true, source: "dispatch" }],
};
const categories = [
  { key: "notice", label: "お知らせ", kind: "announcement", channels: ["email", "inApp"], audiences: ["all", "role", "audience"], adhoc: true },
  { key: "operatorDirect", label: "運営から", kind: "direct", channels: ["email", "inApp"], audiences: ["users", "bulk"], adhoc: true },
  { key: "campaign", label: "キャンペーン", kind: "marketing", channels: ["email", "inApp"], audiences: ["all", "users", "bulk"], adhoc: true },
];
const SEND_OPTIONS = {
  channels: [
    { key: "email", label: "メール", adhoc: true },
    { key: "inApp", label: "お知らせ", adhoc: true },
  ],
  roles: [{ id: "user", label: "利用者" }],
  audiences: [],
  templates: [template],
  categories,
  maxScheduleDays: 90,
};

const calls: unknown[][] = [];
mock.module("@/features/core/messaging/services/client/sendClient", {
  namedExports: {
    getAdminSendOptions: async () => SEND_OPTIONS,
    adminSendMessage: async (input: unknown) => {
      calls.push(["send", input]);
      return { dispatchId: "d1", status: "queued", queuedCount: 0, channelCounts: {} };
    },
    previewAdminMessage: async (input: unknown) => {
      calls.push(["preview", input]);
      return { messageKey: "k", kind: "marketing", category: "campaign", template: null, channels: [] };
    },
    estimateAdminRecipients: async (input: unknown) => {
      calls.push(["estimate", input]);
      return { count: 12, capped: false, fixedAtSend: true };
    },
    sendAdminTestMessage: async (input: unknown) => {
      calls.push(["test", input]);
      return { dispatchId: "t1", status: "completed", queuedCount: 0, channelCounts: {} };
    },
  },
});
mock.module("@/features/core/messaging/services/client/adminMessagingClient", {
  namedExports: {
    getAdminBulkSendOptions: async () => ({ categories: categories.filter((c) => c.audiences.includes("bulk")), templates: [template] }),
    adminBulkSend: async (input: unknown) => {
      calls.push(["bulk", input]);
      return { dispatchId: "b1", status: "queued", counts: { recipientCount: 2, channelCounts: {}, queuedCount: 0 }, afterSend: { ok: true } };
    },
    previewAdminBulkMessage: async (input: unknown) => {
      calls.push(["bulkPreview", input]);
      return { messageKey: "k", kind: "direct", category: "operatorDirect", template: null, channels: [] };
    },
    sendAdminBulkTestMessage: async (input: unknown) => {
      calls.push(["bulkTest", input]);
      return { dispatchId: "bt", status: "completed", queuedCount: 0, channelCounts: {} };
    },
  },
});
let templatesOpen = true;
mock.module("@/featureGate/client", {
  namedExports: { useGate: () => ({ enabled: (name: string) => (name === "messagingTemplates" ? templatesOpen : true) }) },
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
  templatesOpen = true;
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
const NEW = { type: "new" } as const;

test("純粋な関数", () => {
  const now = Date.UTC(2026, 10, 13);
  assert.equal(hooks.scheduleErrorOf("now", "", 90, now), null);
  assert.equal(hooks.scheduleErrorOf("at", "", 90, now), "予約の時刻を入れてください");
  assert.equal(hooks.scheduleErrorOf("at", new Date(now - 1000).toISOString(), 90, now), "予約の時刻は今より後にしてください");
  assert.match(hooks.scheduleErrorOf("at", new Date(now + 91 * 86_400_000).toISOString(), 90, now) ?? "", /90 日先まで/);
  assert.deepEqual(hooks.templateVarsForInput(template as never, { discount: "15" }), { discount: 15 });
  const adhoc = hooks.initialDraftOf({ type: "bulk", target: "t", recordIds: ["r"], recordNoun: "記録", defaults: { inAppTitle: "題" } }, []);
  assert.equal(hooks.isBlankChannel(adhoc, "email"), true);
  assert.equal(hooks.isBlankChannel({ ...adhoc, content: { ...adhoc.content, inApp: { title: "題", body: "本文" } } }, "inApp"), false);
  assert.deepEqual(hooks.initialAudienceOf({ type: "sameAs", dispatch: { audience: { type: "role", roles: ["user"] } } as never }), {
    type: "role",
    roles: ["user"],
    audienceKey: "",
    userIds: [],
  });
  assert.equal(hooks.initialAudienceOf({ type: "sameAs", dispatch: { audience: null } as never }).type, "users");
});

test("new: 呼び出し → 直す → カテゴリー → 経路の絞り → 空の経路で止まる → 予約 → プレビュー・テスト → 見込み → 確認 → 送る", async () => {
  const view = await mount(() => hooks.useMessageSendModal({ mode: NEW }));
  const m = () => view.value();
  await act(async () => m().setOpen(true));
  assert.equal(m().optionsLoaded, true);
  assert.equal(m().templatesAvailable, true);
  // 宛先 全員 → 選べるカテゴリーは notice と campaign
  assert.deepEqual(m().allowedCategories.map((c) => c.key), ["notice", "campaign"]);
  assert.equal(m().dirty, false);

  await act(async () => m().callTemplate(TEMPLATE_ID));
  assert.equal(m().draft.source, "template");
  assert.deepEqual(m().draft.content.email, { subject: "{{discount}} 割引", paragraphs: ["本文"] });
  assert.equal(m().dirty, true);
  assert.equal(guarded.at(-1), true);
  await act(async () => m().setCategory("campaign"));
  assert.deepEqual(m().sendChannels, ["email", "inApp"], "既定は全部オン");
  // inApp は文言が無い → 止める
  assert.match(m().contentError ?? "", /変数 割引/);
  await act(async () => m().setVar("discount", "20"));
  assert.match(m().contentError ?? "", /お知らせ の文言がありません|サービス内のお知らせ/);
  await act(async () => m().toggleChannel("inApp", false));
  assert.equal(m().contentError, null);
  await act(async () => m().setChannelFields("email", { subject: "{{discount}} 割引!", paragraphs: ["直した"] }));

  await act(async () => m().setScheduleMode("at"));
  assert.equal(m().scheduleError, "予約の時刻を入れてください");
  const at = new Date(Date.now() + 86_400_000).toISOString();
  await act(async () => m().setScheduledAt(at));
  assert.equal(m().canSend, true);

  await act(async () => {
    await m().runPreview();
    await m().sendTest();
  });
  const content = calls[0][1] as Record<string, unknown>;
  assert.deepEqual(content, {
    message: { type: "template", templateId: TEMPLATE_ID, version: 3, content: { email: { subject: "{{discount}} 割引!", paragraphs: ["直した"] } }, vars: { discount: 20 } },
    category: "campaign",
    channels: ["email"],
  });
  assert.equal(calls[1][0], "test");

  const firstKey = m().buildSendInput().idempotencyKey;
  await act(async () => {
    await m().requestConfirm();
  });
  assert.equal(m().step, "confirm");
  assert.equal(m().estimate?.count, 12);
  assert.deepEqual(calls[2], ["estimate", { audience: { type: "all" } }]);
  await act(async () => {
    await m().confirmSend();
  });
  const sent = calls[3][1] as Record<string, unknown>;
  assert.equal(calls[3][0], "send");
  assert.equal(sent.scheduledAt, at);
  assert.deepEqual(sent.audience, { type: "all" });
  assert.equal(m().step, "done");
  assert.equal(m().dirty, false);
  assert.notEqual(m().buildSendInput().idempotencyKey, firstKey, "送った後は鍵を作り直す");

  await act(async () => m().setOpen(false));
  assert.equal(m().step, "edit");
  assert.equal(m().draft.source, "adhoc", "閉じると初めに戻る");
  await view.unmount();
});

test("new: 宛先を選んだ利用者に変えるとカテゴリーが変わり、利用者が無ければ止まる。門 messagingTemplates が閉ならテンプレートを出さない", async () => {
  templatesOpen = false;
  const view = await mount(() => hooks.useMessageSendModal({ mode: NEW }));
  const m = () => view.value();
  await act(async () => m().setOpen(true));
  assert.equal(m().templatesAvailable, false);
  await act(async () => m().setAudience({ type: "users" }));
  assert.deepEqual(m().allowedCategories.map((c) => c.key), ["operatorDirect", "campaign"]);
  assert.equal(m().audienceError, "利用者を選んでください");
  await act(async () => m().setAudience({ userIds: ["u1"] }));
  assert.equal(m().audienceError, null);
  assert.match(m().contentError ?? "", /文言がありません/, "その場で書く欄が空なら止める");
  await view.unmount();
});

test("sameAs: 文面・カテゴリー・宛先の形を写す。テンプレートの回は呼び出しの形", async () => {
  const dispatch = {
    id: "d0",
    category: "notice",
    audience: { type: "role", roles: ["user"] },
    headings: { email: "元の件名", inApp: "元の題" },
    body: null,
    templateId: null,
    templateVersion: null,
  };
  const view = await mount(() => hooks.useMessageSendModal({ mode: { type: "sameAs", dispatch: dispatch as never } }));
  const m = () => view.value();
  await act(async () => m().setOpen(true));
  assert.equal(m().category, "notice");
  assert.deepEqual(m().audience.roles, ["user"]);
  assert.deepEqual(m().draft.content.email, { subject: "元の件名", body: "" }, "本文を残さない回は件名だけ");
  assert.match(m().contentError ?? "", /文言がありません/);
  await view.unmount();

  const fromTemplate = await mount(() =>
    hooks.useMessageSendModal({ mode: { type: "sameAs", dispatch: { ...dispatch, category: "campaign", audience: { type: "all" }, templateId: TEMPLATE_ID, templateVersion: 2 } as never } }),
  );
  await act(async () => fromTemplate.value().setOpen(true));
  assert.equal(fromTemplate.value().draft.source, "template");
  assert.equal(fromTemplate.value().draft.template?.version, 3, "今の公開版を呼び出す");
  await fromTemplate.unmount();
});

test("bulk: 選んだ記録が宛先、bulk の API、予約は無い、見込みは取らない、onSent", async () => {
  const sentResults: unknown[] = [];
  const view = await mount(() =>
    hooks.useMessageSendModal({
      mode: { type: "bulk", target: "bankTransferReview", recordIds: ["r1", "r2"], recordNoun: "振込レビュー", defaults: { inAppTitle: "題", inAppBody: "本文" } },
      onSent: (r) => sentResults.push(r),
    }),
  );
  const m = () => view.value();
  await act(async () => m().setOpen(true));
  assert.equal(m().showSchedule, false);
  assert.equal(m().category, "operatorDirect", "既定のカテゴリー");
  assert.equal(m().templatesAvailable, true);
  await act(async () => m().toggleChannel("email", false));
  assert.equal(m().contentError, null);
  await act(async () => {
    await m().runPreview();
    await m().sendTest();
    await m().requestConfirm();
  });
  assert.deepEqual(calls.map((c) => c[0]), ["bulkPreview", "bulkTest"], "見込みは取らない");
  assert.equal(m().step, "confirm");
  await act(async () => {
    await m().confirmSend();
  });
  const input = calls[2][1] as Record<string, unknown>;
  assert.equal(calls[2][0], "bulk");
  assert.equal(input.target, "bankTransferReview");
  assert.deepEqual(input.recordIds, ["r1", "r2"]);
  assert.deepEqual(input.message, { type: "adhoc", inApp: { title: "題", body: "本文" } });
  assert.equal(input.category, "operatorDirect");
  assert.equal("scheduledAt" in input, false);
  assert.equal(sentResults.length, 1);
  await view.unmount();
});
