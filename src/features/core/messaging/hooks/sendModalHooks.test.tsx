// 送るモーダルの hook useMessageSendModal(と文面の useSendTemplateText)の検査(jsdom の上で描く。client service・門・離れる前の確認は偽物)。
// - 純粋な関数: scheduleErrorOf / kindsOf / blankOfKind / initialTextOf / sameAsNoteOf / initialTargetOf / overLimitText /
//   embeddedValuesForInput / missingEmbedded / embeddedPreviewValues
// - new(D110 D115 D118): 種別を選ぶまで止まる → 種別 → カテゴリー(1 つなら自動)→ 宛先(種別が許す種類だけ)→ テンプレート(その種別の物 + システム)。
//   読み込み直後は文を固定、専用の埋め込み情報の入力だけ(D119)→ 文面を直す → 直した印(D118)→ 予約の検査 → プレビュー・テスト送信 →
//   見込み → 確認 → 送る(送る口の入力 { template, values, edited, embedded, category, channels }、鍵を作り直す)・書きかけの確認・閉じると初めに戻る
// - 『テンプレートを更新』(D120): 直した文を 1 回の保存で新しい版に(D134)、新しい版へつなぎ直し直した印が消える / 変わらなければ unchanged
// - 種別が 2 つ以上のカテゴリーを持つ時は選ぶ、送信方法はカテゴリーの最初の経路(defaultChannels)。門 messagingTemplates が閉ならシステムだけ
// - 読み込み: 手で直した後は確かめる / 解除は白紙へ(ひな形が同じなら文を残す)/ システムテンプレートの専用の埋め込み情報
// - sameAs: カテゴリー → 種別・宛先の形・回の中身(ひな形 + values)を写す / テンプレートの回は今の版を読み込む(専用の値も)/
//   直して送った回は直した文で文面を直す状態から / 公開中でないテンプレートは白紙 + 知らせ / 写せない回は知らせ
// - グループ宛て: 選ぶまで止まる・体 target group・上限超えは確認で送れない / sameAs のグループ(選べなければ知らせ、全員に広げない)
// - sameAs の経路: 元の回の経路だけオン(今のカテゴリーの中で)、触るまで書きかけにしない
// - bulk: 選んだ記録が宛先、defaults の values を白紙に重ねる、bulk-send の API と bulk のプレビュー・テスト、予約は無い、見込みは取らない
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
const NOTICE_TEMPLATE_ID = "22222222-2222-4222-8222-222222222222";
const BLANK_VALUES = { subject: "", blocks: [] };
const discount = { key: "discount", alias: "割引", type: "number", required: true } as const;
const template = {
  id: TEMPLATE_ID,
  key: "spring",
  name: "春",
  category: "campaign",
  currentVersion: 3,
  layout: "notice",
  layoutVersion: 1,
  values: { subject: "{{割引}} 割引", blocks: [{ type: "paragraph", text: "本文" }] },
  embedded: [discount],
};
const noticeTemplate = {
  id: NOTICE_TEMPLATE_ID,
  key: "info",
  name: "告知",
  category: "notice",
  currentVersion: 1,
  layout: "notice",
  layoutVersion: 1,
  values: { subject: "告知", blocks: [] },
  embedded: [],
};
const layouts = [
  {
    key: "notice",
    label: "汎用のお知らせ",
    version: 1,
    fields: {
      subject: { type: "line", label: "件名", required: true },
      blocks: { type: "blocks", label: "本文", allow: ["heading", "paragraph"] },
    },
  },
];
const blankOf = (key: string, label: string) => ({ key, label, layout: "notice", values: BLANK_VALUES });
const catalog = [{ key: "displayName", alias: "表示名", source: "common", description: null }];
const categories = [
  {
    key: "notice",
    label: "お知らせ",
    kind: "announcement",
    channels: ["email", "inApp"],
    defaultChannels: ["email", "inApp"],
    targets: ["all", "role"],
    systemTemplate: blankOf("announcement", "シンプル"),
    catalog,
  },
  {
    key: "lineNotice",
    label: "LINE のお知らせ",
    kind: "announcement",
    channels: ["email", "inApp", "line"],
    defaultChannels: ["inApp"],
    targets: ["all", "role"],
    systemTemplate: blankOf("announcement", "シンプル"),
    catalog,
  },
  {
    key: "operatorDirect",
    label: "運営から",
    kind: "direct",
    channels: ["email", "inApp"],
    defaultChannels: ["email", "inApp"],
    targets: ["users", "bulk", "group"],
    systemTemplate: blankOf("direct", "個別の白紙"),
    catalog,
  },
  {
    key: "campaign",
    label: "キャンペーン",
    kind: "promotion",
    channels: ["email", "inApp"],
    defaultChannels: ["email", "inApp"],
    targets: ["all", "group", "users", "bulk"],
    systemTemplate: blankOf("promotion", "宣伝の白紙"),
    catalog,
  },
];
const startAt = { key: "startAt", alias: "開始", type: "line", required: true } as const;
const systemTemplates = [
  { ...blankOf("announcement", "シンプル"), kind: "announcement", embedded: [] },
  { key: "maintenance", label: "メンテナンス", kind: "announcement", layout: "notice", values: { subject: "メンテナンス {{開始}}", blocks: [] }, embedded: [startAt] },
  { ...blankOf("direct", "個別の白紙"), kind: "direct", embedded: [] },
  { ...blankOf("promotion", "宣伝の白紙"), kind: "promotion", embedded: [] },
];
const SEND_OPTIONS = {
  channels: [
    { key: "email", label: "メール" },
    { key: "inApp", label: "お知らせ" },
  ],
  roles: [{ id: "user", label: "利用者" }],
  templates: [template, noticeTemplate],
  categories,
  systemTemplates,
  layouts,
  groups: [{ id: "g1", label: "常連", kindLabel: "動的" }],
  maxScheduleDays: 90,
};

const calls: unknown[][] = [];
const okSend = (id: string) => ({ dispatchId: id, status: "queued", queuedCount: 0, channelCounts: {} });
const preview = (category: string) => ({ messageKey: "k", kind: "promotion", category, template: null, channels: [] });
mock.module("@/features/core/messaging/services/client/sendClient", {
  namedExports: {
    getAdminSendOptions: async () => SEND_OPTIONS,
    adminSendMessage: async (input: unknown) => {
      calls.push(["send", input]);
      return okSend("d1");
    },
    previewAdminMessage: async (input: unknown) => {
      calls.push(["preview", input]);
      return preview("campaign");
    },
    estimateAdminRecipients: async (input: { target?: { type: string } }) => {
      calls.push(["estimate", input]);
      if (input.target?.type === "group") return { count: 150_000, fixedAtSend: true, memberLimit: 100_000, overLimit: true };
      return { count: 12, fixedAtSend: true };
    },
    sendAdminTestMessage: async (input: unknown) => {
      calls.push(["test", input]);
      return { ...okSend("t1"), status: "completed" };
    },
  },
});
const notCalled = (name: string) => async () => {
  throw new Error(`${name} はこの検査では呼ばない`);
};
mock.module("@/features/core/messaging/services/client/adminMessagingClient", {
  namedExports: {
    getAdminBulkSendOptions: async () => ({
      channels: SEND_OPTIONS.channels,
      categories: categories.filter((c) => c.targets.includes("bulk")),
      templates: [template],
      systemTemplates: systemTemplates.filter((s) => s.kind !== "announcement"),
      layouts,
    }),
    adminBulkSend: async (input: unknown) => {
      calls.push(["bulk", input]);
      return { dispatchId: "b1", status: "queued", counts: { recipientCount: 2, channelCounts: {}, queuedCount: 0 }, afterSend: { ok: true } };
    },
    previewAdminBulkMessage: async (input: unknown) => {
      calls.push(["bulkPreview", input]);
      return preview("operatorDirect");
    },
    sendAdminBulkTestMessage: async (input: unknown) => {
      calls.push(["bulkTest", input]);
      return { ...okSend("bt"), status: "completed" };
    },
    listAdminDispatches: notCalled("listAdminDispatches"),
    getAdminDispatchCategories: notCalled("getAdminDispatchCategories"),
    getAdminDispatch: notCalled("getAdminDispatch"),
    getAdminDispatchPreview: notCalled("getAdminDispatchPreview"),
    listAdminDispatchDeliveries: notCalled("listAdminDispatchDeliveries"),
    continueAdminDispatch: notCalled("continueAdminDispatch"),
    deleteAdminDispatch: notCalled("deleteAdminDispatch"),
    bulkDeleteAdminDispatches: notCalled("bulkDeleteAdminDispatches"),
    adminDispatchDeleteSummary: notCalled("adminDispatchDeleteSummary"),
    resendAdminDispatch: notCalled("resendAdminDispatch"),
  },
});
let saveResult: { currentVersion: number; unchanged: boolean } = { currentVersion: 4, unchanged: false };
mock.module("@/features/core/messaging/services/client/templateClient", {
  namedExports: {
    updateMessageTemplate: async (id: string, input: unknown) => {
      calls.push(["updateTemplate", id, input]);
      return { ...template, ...saveResult };
    },
    // ひな形のプレビュー(描いた物は見ない。送る画面の左のプレビューが呼ぶ)
    previewMessageLayout: async (input: { channel: string }) => ({ channel: input.channel, html: null, text: null, title: null, summary: null, cannotRender: null }),
    listMessageTemplates: notCalled("listMessageTemplates"),
    getMessageTemplateOptions: notCalled("getMessageTemplateOptions"),
    getMessageTemplate: notCalled("getMessageTemplate"),
    createMessageTemplate: notCalled("createMessageTemplate"),
    deleteMessageTemplate: notCalled("deleteMessageTemplate"),
    listMessageTemplateVersions: notCalled("listMessageTemplateVersions"),
    getMessageTemplateVersion: notCalled("getMessageTemplateVersion"),
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
let text: typeof import("./useSendTemplateText");
let SWRConfig: typeof import("swr").SWRConfig;
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  ({ SWRConfig } = await import("swr"));
  hooks = await import("./index");
  text = await import("./useSendTemplateText");
});
after(() => dom.window.close());
beforeEach(() => {
  calls.length = 0;
  guarded.length = 0;
  templatesOpen = true;
  saveResult = { currentVersion: 4, unchanged: false };
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
type Modal = ReturnType<typeof import("./useMessageSendModal").useMessageSendModal>;
const open = async (mode: unknown, onSent?: (result: unknown) => void) => {
  const view = await mount(() => hooks.useMessageSendModal({ mode: mode as never, ...(onSent ? { onSent } : {}) }));
  await act(async () => view.value().setOpen(true));
  return view;
};
/** 直している文の欄を入れる(react-hook-form の setValue、書きかけの印つき) */
const typeField = async (m: () => Modal, name: string, value: unknown) =>
  act(async () => m().text.form.setValue(name, value, { shouldDirty: true }));

const NEW = { type: "new" } as const;
const SAME_AS_DISPATCH = {
  id: "d0",
  category: "campaign",
  target: { type: "all" },
  targetGroup: null,
  templateId: null,
  templateVersion: null,
  templateEdited: false,
  content: { layout: "notice", layoutVersion: 1, values: { subject: "元の件名", blocks: [] } },
  embeddedValues: null,
  channels: ["email", "inApp"],
};
const SAME_AS = { type: "sameAs", dispatch: SAME_AS_DISPATCH } as const;

test("純粋な関数", () => {
  const now = Date.UTC(2026, 10, 13);
  assert.equal(hooks.scheduleErrorOf("now", "", 90, now), null);
  assert.equal(hooks.scheduleErrorOf("at", "", 90, now), "予約日時を入力してください");
  assert.equal(hooks.scheduleErrorOf("at", "x", 90, now), "予約日時が正しくありません");
  assert.equal(hooks.scheduleErrorOf("at", new Date(now - 1000).toISOString(), 90, now), "予約日時は現在より後にしてください");
  assert.match(hooks.scheduleErrorOf("at", new Date(now + 91 * 86_400_000).toISOString(), 90, now) ?? "", /90 日先まで/);
  assert.equal(hooks.scheduleErrorOf("at", new Date(now + 86_400_000).toISOString(), 90, now), null);

  // 種別(受け口の順、重なりなし)と種別の白紙
  assert.deepEqual(hooks.kindsOf(categories as never), ["announcement", "direct", "promotion"]);
  assert.equal(hooks.blankOfKind(categories as never, "direct")?.key, "direct");
  assert.equal(hooks.blankOfKind(categories as never, "security"), null);

  // 専用の埋め込み情報: 数の型は数に、空は送らない / 必須の未入力(既定値のある物は除く)/ プレビューは入れた値(空なら既定値)で埋める
  assert.deepEqual(text.embeddedValuesForInput([discount, startAt], { discount: "15", startAt: " " }), { discount: 15 });
  assert.deepEqual(text.missingEmbedded([discount, { ...startAt, default: "明日" }], {}).map((item) => item.key), ["discount"]);
  assert.deepEqual(
    text.embeddedPreviewValues({ subject: "{{割引}} と {{discount}} と {{表示名}}", blocks: [{ type: "paragraph", text: "{{開始}}" }] }, [discount, { ...startAt, default: "明日" }], {
      discount: "15",
    }),
    { subject: "15 と 15 と {{表示名}}", blocks: [{ type: "paragraph", text: "明日" }] },
    "共通の名前(受信者ごと)は書いたまま",
  );
  const untouched = { subject: "{{割引}}" };
  assert.equal(text.embeddedPreviewValues(untouched, [discount], {}), untouched, "埋める値が無ければそのまま");

  // 初めの文面
  const bulk = hooks.initialTextOf(
    { type: "bulk", target: "t", recordIds: ["r"], recordNoun: "記録", defaults: { values: { subject: "題" } } },
    "direct",
    categories as never,
    [],
  );
  assert.deepEqual([bulk?.source, bulk?.start, bulk?.unlocked], [{ type: "system", key: "direct", label: "個別の白紙" }, { subject: "題", blocks: [] }, true]);
  assert.equal(hooks.initialTextOf(NEW, "", categories as never, []), null, "種別を選ぶまで文面は無い");
  const edited = hooks.initialTextOf(
    { type: "sameAs", dispatch: { ...SAME_AS_DISPATCH, templateId: TEMPLATE_ID, templateEdited: true, embeddedValues: { discount: "30", gone: "x" } } } as never,
    "promotion",
    categories as never,
    [template] as never,
  );
  assert.deepEqual(edited?.source, { type: "template", id: TEMPLATE_ID, name: "春", version: 3 });
  assert.deepEqual([edited?.start, edited?.versionValues, edited?.unlocked], [SAME_AS_DISPATCH.content.values, template.values, true], "直した回は直した文で直す状態から");
  assert.deepEqual(edited?.embedded, { discount: "30" }, "今の版が宣言する鍵だけ");
  const otherKind = hooks.initialTextOf({ type: "sameAs", dispatch: { ...SAME_AS_DISPATCH, templateId: TEMPLATE_ID } } as never, "direct", categories as never, [template] as never);
  assert.equal(otherKind?.source.type, "system", "種別を選び直した後は白紙から");

  // 写せなかった時の知らせ
  const goneMode = { type: "sameAs", dispatch: { ...SAME_AS_DISPATCH, templateId: "gone" } } as never;
  const goneText = hooks.initialTextOf(goneMode, "promotion", categories as never, [template] as never);
  assert.deepEqual(goneText?.start, SAME_AS_DISPATCH.content.values);
  assert.match(hooks.sameAsNoteOf(goneMode, goneText, [template] as never) ?? "", /白紙のテンプレートにコピーしました/);
  const emptyMode = { type: "sameAs", dispatch: { ...SAME_AS_DISPATCH, templateId: "gone", content: null } } as never;
  assert.match(hooks.sameAsNoteOf(emptyMode, hooks.initialTextOf(emptyMode, "promotion", categories as never, []), []) ?? "", /入力し直してください/);
  const otherLayout = { type: "sameAs", dispatch: { ...SAME_AS_DISPATCH, content: { layout: "welcome", layoutVersion: 1, values: {} } } } as never;
  assert.match(hooks.sameAsNoteOf(otherLayout, hooks.initialTextOf(otherLayout, "promotion", categories as never, []), []) ?? "", /形と違うため/);
  assert.equal(hooks.sameAsNoteOf(SAME_AS as never, hooks.initialTextOf(SAME_AS as never, "promotion", categories as never, []), []), null);
  assert.equal(hooks.sameAsNoteOf(NEW, null, []), null);

  // 初めの宛先
  assert.deepEqual(hooks.initialTargetOf({ type: "sameAs", dispatch: { target: { type: "role", roles: ["user"] } } as never }), {
    type: "role",
    roles: ["user"],
    groupId: "",
    userIds: [],
  });
  // グループ宛ての回 = 同じグループ(id は値としてだけ)
  assert.deepEqual(hooks.initialTargetOf({ type: "sameAs", dispatch: { target: { type: "group" }, targetGroup: { id: "g1", name: "常連" } } as never }), {
    type: "group",
    roles: [],
    groupId: "g1",
    userIds: [],
  });
  assert.equal(hooks.initialTargetOf({ type: "sameAs", dispatch: { target: null } as never }).type, "users");
  // 選んだ利用者に送った回(recipients)= 同じ利用者を選んだ形。id が無い(多すぎる)回は選び直し
  assert.deepEqual(hooks.initialTargetOf({ type: "sameAs", dispatch: { target: { type: "recipients", count: 2 }, targetUserIds: ["u1", "u2"] } as never }), {
    type: "users",
    roles: [],
    groupId: "",
    userIds: ["u1", "u2"],
  });
  assert.deepEqual(hooks.initialTargetOf({ type: "sameAs", dispatch: { target: { type: "recipients", count: 20_000 }, targetUserIds: null } as never }).userIds, []);
  assert.deepEqual(hooks.initialTargetOf(NEW), { type: "all", roles: [], groupId: "", userIds: [] });
  assert.equal(hooks.overLimitText({ count: 150_000, memberLimit: 100_000 }), "宛先数 150,000 人が上限 100,000 人を超えているため送信できません");
});

test("new: 種別 → 宛先 → テンプレートを読み込む(固定)→ 専用の値 → 文面を直す → 予約 → プレビュー・テスト → 見込み → 確認 → 送る", async () => {
  const view = await open(NEW);
  const m = () => view.value();
  assert.equal(m().optionsLoaded, true);
  assert.equal(m().templatesAvailable, true);
  // 種別は先に選ばない(D110)
  assert.equal(m().kind, "");
  assert.deepEqual(m().kinds.map((kind) => kind.key), ["announcement", "direct", "promotion"]);
  assert.equal(m().targetError, "種別を選んでください");
  assert.equal(m().text.source, null);
  assert.equal(m().canSend, false);
  assert.equal(m().dirty, false);

  await act(async () => m().setKind("promotion"));
  assert.equal(m().category, "campaign", "カテゴリーが 1 つなら自動");
  assert.deepEqual(m().allowedTargetTypes, ["all", "group", "users"]);
  assert.deepEqual(m().text.source, { type: "system", key: "promotion", label: "宣伝の白紙" }, "読み込まない = 種別の白紙");
  assert.equal(m().text.locked, false);
  // テンプレートはその種別の物だけ(システム → 公開中)
  assert.deepEqual(
    m().pickerTemplates.map((item) => [item.id, item.system]),
    [
      ["system:promotion", true],
      [TEMPLATE_ID, false],
    ],
  );
  assert.equal(m().dirty, true);
  assert.equal(guarded.at(-1), true);

  await act(async () => m().loadTemplate(TEMPLATE_ID));
  assert.equal(m().pendingLoad, null, "手で直していなければ確かめない");
  assert.deepEqual(m().loadedTemplate, { type: "template", id: TEMPLATE_ID, name: "春", version: 3 });
  assert.equal(m().text.locked, true, "読み込んだ直後は文を固定(D119)");
  assert.deepEqual(m().text.values, template.values);
  assert.equal(m().text.edited, false);
  assert.deepEqual(m().sendChannels, ["email", "inApp"], "カテゴリーの最初の経路");
  assert.match(m().contentError ?? "", /埋め込み情報「割引」を入力してください/);
  assert.deepEqual(
    m().embeddedCatalog.map((entry) => [entry.alias, entry.source]),
    [
      ["表示名", "common"],
      ["割引", "own"],
    ],
  );
  await act(async () => m().text.setEmbedded("discount", "20"));
  assert.equal(m().contentError, null);
  await act(async () => m().toggleChannel("inApp", false));
  assert.deepEqual(m().sendChannels, ["email"]);

  // 文面を直す: つながりは残り、版と違えば直した印(D118)
  await act(async () => m().text.unlock());
  assert.equal(m().text.locked, false);
  assert.equal(m().text.edited, false, "直す前は版のまま");
  await typeField(m, "subject", "{{割引}} 割引!");
  assert.equal(m().text.edited, true);

  await act(async () => m().setScheduleMode("at"));
  assert.equal(m().scheduleError, "予約日時を入力してください");
  assert.equal(m().canSend, false);
  const at = new Date(Date.now() + 86_400_000).toISOString();
  await act(async () => m().setScheduledAt(at));
  assert.equal(m().canSend, true);

  await act(async () => {
    await m().runPreview();
    await m().sendTest();
  });
  const expected = {
    template: { id: TEMPLATE_ID, version: 3 },
    values: { subject: "{{割引}} 割引!", blocks: [{ type: "paragraph", text: "本文" }] },
    edited: true,
    embedded: { discount: 20 },
    category: "campaign",
    channels: ["email"],
  };
  assert.deepEqual(calls[0], ["preview", expected]);
  assert.equal(calls[1][0], "test");
  const { idempotencyKey: testKey, ...testInput } = calls[1][1] as Record<string, unknown>;
  assert.deepEqual(testInput, expected, "プレビューとテスト送信は同じ中身");
  assert.equal(typeof testKey, "string");

  const firstKey = m().buildSendInput().idempotencyKey;
  await act(async () => {
    await m().requestConfirm();
  });
  assert.equal(m().step, "confirm");
  assert.equal(m().estimate?.count, 12);
  assert.deepEqual(calls[2], ["estimate", { target: { type: "all" } }]);
  await act(async () => {
    await m().confirmSend();
  });
  assert.equal(calls[3][0], "send");
  const sent = calls[3][1] as Record<string, unknown>;
  assert.deepEqual({ ...sent, idempotencyKey: undefined }, { ...expected, target: { type: "all" }, scheduledAt: at, idempotencyKey: undefined });
  assert.equal(sent.idempotencyKey, firstKey);
  assert.equal(m().step, "done");
  assert.equal(m().dirty, false);
  assert.notEqual(m().buildSendInput().idempotencyKey, firstKey, "送った後は鍵を作り直す");

  await act(async () => m().setOpen(false));
  assert.equal(m().step, "edit");
  assert.equal(m().kind, "", "閉じると初めに戻る");
  assert.equal(m().text.source, null);
  await view.unmount();
});

test("テンプレートを更新: 直した文を新しい版にし、つなぎ直して直した印が消える / 変わらなければ unchanged / 門が閉なら出さない", async () => {
  const view = await open(NEW);
  const m = () => view.value();
  await act(async () => m().setKind("promotion"));
  await act(async () => m().loadTemplate(TEMPLATE_ID));
  assert.equal(m().text.canUpdateTemplate, false, "固定の間は出さない");
  await act(async () => m().text.unlock());
  assert.equal(m().text.canUpdateTemplate, true);
  await typeField(m, "subject", "直した件名");
  assert.equal(m().text.edited, true);

  let updated: Awaited<ReturnType<Modal["updateTemplate"]>> | undefined;
  await act(async () => {
    updated = await m().updateTemplate();
  });
  assert.deepEqual(updated, { version: 4, unchanged: false });
  assert.deepEqual(calls.at(-1), ["updateTemplate", TEMPLATE_ID, { values: { subject: "直した件名", blocks: [{ type: "paragraph", text: "本文" }] } }]);
  assert.equal(m().loadedTemplate?.version, 4, "新しい版へつなぎ直す");
  assert.equal(m().text.edited, false, "直した印は消える");
  assert.deepEqual((m().buildContent() as { template: unknown }).template, { id: TEMPLATE_ID, version: 4 });

  saveResult = { currentVersion: 4, unchanged: true };
  await act(async () => {
    updated = await m().updateTemplate();
  });
  assert.deepEqual(updated, { version: null, unchanged: true });
  assert.equal(m().loadedTemplate?.version, 4);

  // 内容の誤り(件名は必須)は保存しない
  await typeField(m, "subject", "");
  const before = calls.length;
  await act(async () => {
    await assert.rejects(m().updateTemplate(), /内容の入力に誤りがあります/);
  });
  assert.equal(calls.length, before);
  await view.unmount();

  templatesOpen = false;
  const closed = await open(NEW);
  await act(async () => closed.value().setKind("promotion"));
  assert.equal(closed.value().templatesAvailable, false);
  assert.deepEqual(closed.value().pickerTemplates.map((item) => item.id), ["system:promotion"], "門が閉ならシステムだけ");
  assert.equal(closed.value().text.canUpdateTemplate, false);
  await closed.unmount();
});

test("種別: 宛先は種別が許す種類だけ、カテゴリーが 2 つ以上なら選ぶ、送信方法はカテゴリーの最初の経路、空の文は確認に進めない", async () => {
  const view = await open(NEW);
  const m = () => view.value();
  await act(async () => m().setKind("direct"));
  assert.equal(m().category, "operatorDirect");
  assert.deepEqual(m().allowedTargetTypes, ["group", "users"]);
  assert.equal(m().target.type, "group", "許さない形(全員)は最初の許す種類に読み替える");
  assert.equal(m().targetError, "グループを選んでください");
  await act(async () => m().setTarget({ type: "users" }));
  assert.equal(m().targetError, "ユーザーを選んでください");
  await act(async () => m().setTarget({ userIds: ["u1"] }));
  assert.equal(m().targetError, null);
  // 白紙のまま(件名は必須)= 確認に進めず、送らない
  await act(async () => {
    await assert.rejects(m().requestConfirm(), /内容の入力に誤りがあります/);
  });
  assert.equal(m().step, "edit");
  assert.equal(calls.length, 0);

  await act(async () => m().setKind("announcement"));
  assert.deepEqual(m().categories.map((c) => c.key), ["notice", "lineNotice"]);
  assert.equal(m().category, "notice", "種別を替えると最初のカテゴリー");
  assert.deepEqual(m().allowedTargetTypes, ["all", "role"]);
  assert.deepEqual(m().pickerTemplates.map((item) => item.id), ["system:announcement", "system:maintenance", NOTICE_TEMPLATE_ID], "種別のテンプレートだけ");
  await act(async () => m().setCategory("lineNotice"));
  assert.deepEqual(m().channels.map((c) => [c.key, c.on]), [
    ["email", false],
    ["inApp", true],
    ["line", false],
  ]);
  assert.equal(m().channels.find((c) => c.key === "inApp")?.label, "お知らせ", "経路の名前は選択肢の label");
  await act(async () => m().toggleChannel("inApp", false));
  assert.equal(m().contentError, "送信方法を 1 つ以上選んでください");
  await view.unmount();
});

test("読み込み: 手で直した後は確かめる / 解除は白紙へ(ひな形が同じなら文を残す)/ システムテンプレートの専用の埋め込み情報", async () => {
  const view = await open(NEW);
  const m = () => view.value();
  await act(async () => m().setKind("promotion"));
  await typeField(m, "subject", "手で書いた件名");
  await act(async () => m().loadTemplate(TEMPLATE_ID));
  assert.equal(m().pendingLoad, TEMPLATE_ID, "手で直した後は確かめる");
  assert.equal(m().text.values.subject, "手で書いた件名");
  await act(async () => m().cancelLoad());
  assert.equal(m().pendingLoad, null);
  assert.equal(m().text.values.subject, "手で書いた件名", "やめれば書きかけはそのまま");
  assert.equal(m().loadedTemplate, null);
  await act(async () => m().loadTemplate(TEMPLATE_ID));
  await act(async () => m().confirmLoad());
  assert.equal(m().loadedTemplate?.id, TEMPLATE_ID);
  assert.deepEqual(m().text.values, template.values);

  // 解除: 白紙へ。ひな形が同じ(notice)なので今の文は白紙の文として残る。専用の埋め込み情報は無くなる
  await act(async () => m().unloadTemplate());
  assert.equal(m().loadedTemplate, null);
  assert.deepEqual(m().text.source, { type: "system", key: "promotion", label: "宣伝の白紙" });
  assert.deepEqual(m().text.values, template.values);
  assert.equal(m().text.locked, false);
  assert.deepEqual(m().text.state?.embeddedDeclarations, []);
  assert.deepEqual((m().buildContent() as { template: unknown }).template, { system: "promotion" });

  // システムテンプレート(メンテナンス): 中身と専用の埋め込み情報の入力、送る口に embedded
  await act(async () => m().setKind("announcement"));
  await act(async () => m().loadTemplate("system:maintenance"));
  assert.equal(m().pendingLoad, "system:maintenance", "解除の後の文(手で触った形)の上に読み込む時も確かめる");
  await act(async () => m().confirmLoad());
  assert.deepEqual(m().text.source, { type: "system", key: "maintenance", label: "メンテナンス" });
  assert.equal(m().text.values.subject, "メンテナンス {{開始}}");
  assert.match(m().contentError ?? "", /埋め込み情報「開始」を入力してください/);
  await act(async () => m().text.setEmbedded("startAt", "10 時"));
  assert.equal(m().contentError, null);
  assert.deepEqual(m().buildContent(), {
    template: { system: "maintenance" },
    values: { subject: "メンテナンス {{開始}}", blocks: [] },
    embedded: { startAt: "10 時" },
    category: "notice",
    channels: ["email", "inApp"],
  });
  await view.unmount();
});

test("sameAs: カテゴリー → 種別・宛先・中身を写す。テンプレートの回は今の版を読み込み、直した回は直した文、公開中でなければ白紙 + 知らせ", async () => {
  const roleDispatch = { ...SAME_AS_DISPATCH, category: "notice", target: { type: "role", roles: ["user"] } };
  const view = await open({ type: "sameAs", dispatch: roleDispatch });
  const m = () => view.value();
  assert.deepEqual([m().kind, m().category], ["announcement", "notice"]);
  assert.deepEqual([m().target.type, m().target.roles], ["role", ["user"]]);
  assert.deepEqual(m().text.source, { type: "system", key: "announcement", label: "シンプル" });
  assert.deepEqual(m().text.values, { subject: "元の件名", blocks: [] });
  assert.equal(m().sameAsNote, null);
  assert.equal(m().dirty, false, "写しただけでは書きかけにしない");
  await view.unmount();

  const fromTemplate = await open({ type: "sameAs", dispatch: { ...SAME_AS_DISPATCH, templateId: TEMPLATE_ID, templateVersion: 2, embeddedValues: { discount: "30" } } });
  const t = () => fromTemplate.value();
  assert.deepEqual(t().loadedTemplate, { type: "template", id: TEMPLATE_ID, name: "春", version: 3 }, "今の公開版を読み込む");
  assert.equal(t().text.locked, true);
  assert.deepEqual(t().text.values, template.values);
  assert.deepEqual(t().text.state?.embedded, { discount: "30" }, "専用の値も写す");
  assert.equal(t().contentError, null);
  assert.equal(t().sameAsNote, null);
  await fromTemplate.unmount();

  // 直して送った回: 直した文で文面を直す状態から(直した印つき)。選んだ利用者の回は同じ利用者
  const editedValues = { subject: "直した件名", blocks: [{ type: "paragraph", text: "直した本文" }] };
  const edited = await open({
    type: "sameAs",
    dispatch: {
      ...SAME_AS_DISPATCH,
      target: { type: "recipients", count: 1 },
      targetUserIds: ["u9"],
      templateId: TEMPLATE_ID,
      templateVersion: 2,
      templateEdited: true,
      content: { layout: "notice", layoutVersion: 1, values: editedValues },
    },
  });
  const e = () => edited.value();
  assert.equal(e().loadedTemplate?.version, 3);
  assert.equal(e().text.locked, false);
  assert.deepEqual(e().text.values, editedValues);
  assert.equal(e().text.edited, true);
  assert.deepEqual([e().target.type, e().target.userIds], ["users", ["u9"]]);
  await edited.unmount();

  // 公開中でないテンプレート: 白紙に回の values を写し、知らせを出す
  const gone = await open({ type: "sameAs", dispatch: { ...SAME_AS_DISPATCH, templateId: "gone", templateVersion: 1, templateEdited: true } });
  assert.deepEqual(gone.value().text.source, { type: "system", key: "promotion", label: "宣伝の白紙" });
  assert.deepEqual(gone.value().text.values, SAME_AS_DISPATCH.content.values);
  assert.match(gone.value().sameAsNote ?? "", /白紙のテンプレートにコピーしました/);
  await gone.unmount();

  const nothing = await open({ type: "sameAs", dispatch: { ...SAME_AS_DISPATCH, templateId: "gone", templateVersion: 1, content: null } });
  assert.match(nothing.value().sameAsNote ?? "", /内容を入力し直してください/);
  assert.deepEqual(nothing.value().text.values, BLANK_VALUES);
  await nothing.unmount();
});

test("bulk: 選んだ記録が宛先、defaults を白紙に重ねる、bulk の API、予約は無い、見込みは取らない、onSent", async () => {
  const sentResults: unknown[] = [];
  const view = await open(
    {
      type: "bulk",
      target: "bankTransferReview",
      recordIds: ["r1", "r2"],
      recordNoun: "振込レビュー",
      defaults: { values: { subject: "題", blocks: [{ type: "paragraph", text: "本文" }] } },
    },
    (result) => sentResults.push(result),
  );
  const m = () => view.value();
  assert.equal(m().showSchedule, false);
  assert.deepEqual([m().kind, m().category], ["direct", "operatorDirect"], "既定のカテゴリーとその種別");
  assert.equal(m().channels.find((channel) => channel.key === "inApp")?.label, "お知らせ", "経路の名前は送るモーダルと同じ");
  assert.equal(m().targetError, null);
  await act(async () => m().toggleChannel("email", false));
  assert.equal(m().contentError, null);
  await act(async () => {
    await m().runPreview();
    await m().sendTest();
    await m().requestConfirm();
  });
  assert.deepEqual(
    calls.map((c) => c[0]),
    ["bulkPreview", "bulkTest"],
    "見込みは取らない",
  );
  assert.equal(m().step, "confirm");
  await act(async () => {
    await m().confirmSend();
  });
  assert.equal(calls[2][0], "bulk");
  const input = calls[2][1] as Record<string, unknown>;
  assert.equal(input.target, "bankTransferReview");
  assert.deepEqual(input.recordIds, ["r1", "r2"]);
  assert.deepEqual(input.template, { system: "direct" });
  assert.deepEqual(input.values, { subject: "題", blocks: [{ type: "paragraph", text: "本文" }] });
  assert.equal(input.category, "operatorDirect");
  assert.deepEqual(input.channels, ["inApp"]);
  assert.equal("scheduledAt" in input, false);
  assert.equal(typeof input.idempotencyKey, "string");
  assert.equal(sentResults.length, 1);
  assert.equal(m().step, "done");
  await view.unmount();
});

test("グループ宛て: 選ぶまで止まる、体は target group、見込みが上限を超えたら確認で送れない(理由つき)", async () => {
  const view = await open(NEW);
  const m = () => view.value();
  await act(async () => m().setKind("promotion"));
  assert.deepEqual(m().groups, [{ id: "g1", label: "常連", kindLabel: "動的" }]);
  await act(async () => m().setTarget({ type: "group" }));
  assert.equal(m().targetError, "グループを選んでください");
  assert.equal(m().canSend, false);
  await act(async () => m().setTarget({ groupId: "g1" }));
  assert.equal(m().targetError, null);
  assert.deepEqual(m().buildSendInput().target, { type: "group", groupId: "g1" });
  await typeField(m, "subject", "件名");
  await act(async () => m().requestConfirm());
  assert.equal(m().step, "confirm");
  assert.equal(m().estimateOverLimit, true);
  calls.length = 0;
  await act(async () => {
    await assert.rejects(m().confirmSend(), /上限 100,000 人を超えている/);
  });
  assert.equal(calls.filter((c) => c[0] === "send").length, 0, "送らない");
  await view.unmount();
});

test("sameAs のグループ: 今も選べれば同じグループ、選べなければ選んでいない形 + 知らせ(全員に広げない)", async () => {
  const same = (groupId: string) => ({ ...SAME_AS, dispatch: { ...SAME_AS_DISPATCH, target: { type: "group" }, targetGroup: { id: groupId, name: "前の" } } });
  const kept = await open(same("g1"));
  assert.deepEqual([kept.value().target.type, kept.value().target.groupId, kept.value().targetNote], ["group", "g1", null]);
  await kept.unmount();
  const gone = await open(same("archived"));
  assert.deepEqual([gone.value().target.type, gone.value().target.groupId], ["group", ""]);
  assert.equal(gone.value().targetNote, hooks.TARGET_GROUP_GONE_NOTE);
  assert.equal(gone.value().targetError, "グループを選んでください");
  assert.equal(gone.value().canSend, false);
  await gone.unmount();
});

test("sameAs の経路: 元の回の経路だけオン(お知らせだけの回はお知らせだけ)、触るまで書きかけにしない、戻せる", async () => {
  const view = await open({ ...SAME_AS, dispatch: { ...SAME_AS_DISPATCH, channels: ["inApp"] } });
  const m = () => view.value();
  assert.deepEqual(m().sendChannels, ["inApp"]);
  assert.deepEqual(
    m().channels.map((c) => [c.key, c.on]),
    [
      ["email", false],
      ["inApp", true],
    ],
  );
  assert.equal(m().dirty, false, "写しただけでは書きかけにしない");
  await act(async () => m().toggleChannel("email", true));
  assert.deepEqual(m().sendChannels, ["email", "inApp"]);
  assert.equal(m().dirty, true);
  await act(async () => m().toggleChannel("email", false));
  assert.equal(m().dirty, false, "元に戻せば書きかけでない");
  await view.unmount();

  // 今のカテゴリーに無い経路しか使っていない回 = 全部外さず全部オン(送れない形にしない)
  const other = await open({ ...SAME_AS, dispatch: { ...SAME_AS_DISPATCH, channels: ["line"] } });
  assert.deepEqual(other.value().sendChannels, ["email", "inApp"]);
  await other.unmount();
});
