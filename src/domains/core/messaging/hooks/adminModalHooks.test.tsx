// 管理のモーダルと一覧・送信の画面の流れの hook の検査(jsdom の上で描く。client service・toast・離れる前の確認は偽物)。
// - useAdminDispatchFilters: 選んだらすぐ効く・期間の指定は日付 → ISO(まで = 翌日未満)・種別 → カテゴリー(種別を変えると空)・clearAll(送った側は残す)
// - useAdminDispatchCategories: 種別ごとの選択肢・表示名(鍵は出さない)
// - useAdminDispatchDetail: 配達の絞り / 削除の見込み(確認を開いている間だけ)・削除する(onDeleted)・再送(includeUnknown を渡して戻す)・送信を再開 → 知らせ、失敗も知らせ。
//   中身を残していない送信はプレビューを取らない
// - useAdminMessageTemplateList / useAdminMessageOverrideList: 種別で絞る・モーダルの開き先
// - useMessageTemplateModal: 閉じている間は取らない / 作る → 同じモーダルで直す形 / 開き直すと作った id とタブが戻る
// - useMessageTemplateVersion: id と版がそろった時だけ 1 版を取る (useModalSession は src/hooks/useModalSession.test.ts)
// - closeConfirm: テンプレートの書く欄(作った後は消える)・テキストの編集の下書き(元の文言に戻すと消える)
// - C9: モーダルの操作の後の一覧(作った = 取り直す・保存 = 行を置き換える・削除 = 行を外す・種別で絞っている時の保存は取り直す)、
//   onChanged は form から(作る = create、新しい版 = publish、変わらない = update、削除 = delete、D134 D137)
// - 作った直後に 1 件がまだ無い間は読み込み中(空の中身を出さない)
// 実行: pnpm test src/domains/core/messaging/hooks/adminModalHooks.test.tsx
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
g.IntersectionObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const ID = "11111111-1111-4111-8111-111111111111";
const detail = (extra: Record<string, unknown> = {}) => ({
  id: ID,
  key: "spring",
  name: "春",
  description: null,
  category: "promotion",
  categoryLabel: "お知らせ",
  currentVersion: 1,
  createdBy: null,
  updatedBy: null,
  createdAt: "2026-11-12T00:00:00.000Z",
  updatedAt: "2026-11-12T00:00:00.000Z",
  layout: "notice",
  values: { subject: "件名" },
  layoutVersion: 1,
  vars: [],
  catalog: [],
  ...extra,
});
// 選択肢: 種別 → カテゴリー(送信チャンネルつき)→ レイアウト(欄の宣言)・埋め込み情報の一覧(D115)
const OPTIONS = {
  channels: [{ key: "email", label: "メール" }],
  categories: [{ key: "promotion", label: "お知らせ", description: null, kind: "promotion", channels: ["email"] }],
  layouts: [{ key: "notice", label: "汎用のお知らせ", description: null, version: 1, fields: { subject: { type: "line", label: "件名", required: true } } }],
  initialLayout: "notice",
  baseCatalog: [{ key: "serviceName", alias: "サービス名", source: "common", description: null }],
};

const calls: unknown[][] = [];
/** 作った直後の 1 件の取り出しを止めておく(読み込み中の検査) */
let slowTemplate = Promise.withResolvers<void>();
let failNext = false;
/** 次の直すが中身の同じ保存か(D134 unchanged) */
let nextUnchanged = false;
const maybeFail = () => {
  if (failNext) {
    failNext = false;
    throw new Error("だめ");
  }
};
mock.module("@/domains/core/messaging/services/client/templateClient", {
  namedExports: {
    listMessageTemplates: async (params: Record<string, unknown>) => {
      calls.push(["listTemplates", params.kind ?? null]);
      return { items: [detail()], nextCursor: null };
    },
    getMessageTemplateOptions: async () => {
      calls.push(["options"]);
      return OPTIONS;
    },
    getMessageTemplate: async (id: string) => {
      calls.push(["template", id]);
      if (id === "slow-id") await slowTemplate.promise;
      return detail({ id });
    },
    listMessageTemplateVersions: async (id: string) => {
      calls.push(["versions", id]);
      return [];
    },
    getMessageTemplateVersion: async (id: string, version: number) => {
      calls.push(["version", id, version]);
      return { version, layout: "notice", layoutVersion: 1, values: {}, vars: [], category: "promotion", categoryLabel: null, editedBy: null, createdAt: "2026-11-12T00:00:00.000Z" };
    },
    // D134: 作る = 1 回で版 1 を公開
    createMessageTemplate: async (input: Record<string, unknown>) => {
      calls.push(["create", input]);
      return detail({ id: "new-id", name: input.name });
    },
    // D134: 直す = 1 回で公開(中身が同じなら unchanged)
    updateMessageTemplate: async (id: string, input: Record<string, unknown>) => {
      calls.push(["update", id, input.name]);
      const unchanged = nextUnchanged;
      nextUnchanged = false;
      return { ...detail({ name: input.name, currentVersion: unchanged ? 1 : 2 }), unchanged };
    },
    // D137: 削除
    deleteMessageTemplate: async (id: string) => {
      calls.push(["deleteTemplate", id]);
      return { id, deleted: true };
    },
    previewMessageLayout: async (input: { channel: string }) => ({ channel: input.channel, html: null, text: null, title: null, summary: null, cannotRender: null }),
  },
});
const DISPATCH = {
  id: "d1",
  status: "processing",
  deletedAt: null,
  operations: {
    canDelete: { allowed: true, reason: null },
    canResend: { allowed: true, reason: null, mode: "requeue", failed: 1, unknown: 1 },
    canContinue: { allowed: true, reason: null },
    canEdit: { allowed: false, reason: "not_scheduled", content: { allowed: false, reason: "not_scheduled" } },
  },
};
const DELETE_SUMMARY = {
  found: 1,
  deleted: 0,
  scheduled: 0,
  unsent: 3,
  channels: [{ key: "inApp", label: "お知らせ", removable: true, sent: 2 }],
  sharedInbox: 0,
};
mock.module("@/domains/core/messaging/services/client/adminMessagingClient", {
  namedExports: {
    // D88: 取り消し・取り下げは削除(戻せない)に替わった
    deleteAdminDispatch: async (id: string) => {
      maybeFail();
      calls.push(["delete"]);
      return { dispatchId: id, alreadyDeleted: false, canceledDeliveries: 3, removed: [{ channel: "inApp", removed: 2 }], failedChannels: [] };
    },
    bulkDeleteAdminDispatches: async () => ({ results: [] }),
    adminDispatchDeleteSummary: async (ids: readonly string[]) => {
      calls.push(["deleteSummary", [...ids]]);
      return DELETE_SUMMARY;
    },
    getAdminDispatch: async () => DISPATCH,
    getAdminDispatchCategories: async () => [
      { key: "campaign", label: "キャンペーン", kind: "promotion" },
      { key: "spring", label: "春の案内", kind: "promotion" },
      { key: "operatorDirect", label: "運営からのご連絡", kind: "direct" },
    ],
    listAdminDispatches: async () => ({ items: [], nextCursor: null }),
    listAdminDispatchDeliveries: async (_id: string, params: Record<string, unknown>) => {
      calls.push(["deliveries", params.status ?? null, params.channel ?? null]);
      return { items: [], nextCursor: null };
    },
    resendAdminDispatch: async (id: string, input: { includeUnknown?: boolean }) => {
      calls.push(["resend", input.includeUnknown]);
      return { dispatchId: id, mode: "requeue", failed: 1, unknown: 1, newDispatchId: null };
    },
    continueAdminDispatch: async () => {
      calls.push(["continue"]);
      return { completed: false, sent: 4, failed: 0 };
    },
    getAdminDispatchPreview: async () => {
      calls.push(["dispatchPreview"]);
      return { dispatchId: "d1", layout: null, cannotRender: null, channels: [] };
    },
    getAdminBulkSendOptions: async () => ({ channels: [], categories: [], templates: [], layouts: [] }),
    previewAdminBulkMessage: async () => ({ channels: [] }),
    sendAdminBulkTestMessage: async () => ({}),
    adminBulkSend: async () => ({}),
  },
});
mock.module("@/domains/core/messaging/services/client/overrideClient", {
  namedExports: {
    // J99(D86): 編集の hook がプレビューを取る(この file では検査しない。overrideHooks.test.tsx が見る)
    previewMessageOverride: async (_key: string, input: { channel: string }) => ({ channel: input.channel, html: null, text: null }),
    listMessageOverrides: async () => [{ key: "user.welcome", kind: "transactional", category: "x", editableCount: 1, editedCount: 0, codeChangedCount: 0, unusableCount: 0 }],
    getMessageOverride: async (key: string) => ({
      key,
      label: "ようこそ",
      kind: "transactional",
      category: "x",
      categoryLabel: null,
      allowedKeys: [],
      vars: [],
      // J126(D132): 送信チャンネルの一覧と欄(レイアウトの欄の鍵・宣言・使う送信チャンネル)
      channels: [{ key: "email", label: "メール" }],
      fields: [
        {
          path: "subject",
          spec: { type: "line", label: "件名" },
          channels: ["email"],
          editable: true,
          codeValue: "件名",
          value: null,
          effective: "件名",
          edited: false,
          codeChanged: false,
          unusable: false,
          problem: null,
          updatedAt: null,
        },
      ],
    }),
    // D132: 保存はまとめて 1 回(この file では呼ばない。overrideHooks.test.tsx が見る)
    saveMessageOverride: async () => ({}),
    resetMessageOverride: async () => ({}),
  },
});
const toasts: string[] = [];
mock.module("@/lib/toast", { namedExports: { useToast: () => ({ showToast: (m: string, kind: string) => void toasts.push(`${kind}:${m}`) }) } });
mock.module("@/lib/unsavedGuard", { namedExports: { useUnsavedGuard: () => {} } });

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
  toasts.length = 0;
  failNext = false;
  nextUnchanged = false;
});

/** hook を描き、props を変えて描き直せる */
const mount = async <T, P>(useHook: (props: P) => T, initial: P) => {
  const latest: { current: T | null } = { current: null };
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const Probe = ({ props, report }: { props: P; report: (value: T) => void }) => {
    report(useHook(props));
    return null;
  };
  const draw = (props: P) =>
    act(async () => {
      root.render(
        createElement(
          SWRConfig,
          { value: { provider: () => new Map(), dedupingInterval: 0 } },
          createElement(Probe, { props, report: (value: T) => (latest.current = value) }),
        ),
      );
    });
  await draw(initial);
  return { value: () => latest.current!, rerender: draw, unmount: () => act(async () => root.unmount()) };
};
const settle = () => act(async () => new Promise((r) => setTimeout(r, 0)));

test("useAdminDispatchFilters: 選んだらすぐ効く、期間の指定は日付 → ISO、clearAll で空(送った側は残す)", async () => {
  const view = await mount(() => hooks.useAdminDispatchFilters({ kind: "promotion" }), {});
  const f = () => view.value();
  assert.equal(f().filters.kind, "promotion");
  assert.equal(f().filters.sentBy, "admin", "既定 = 手動送信");
  assert.equal(f().fields.kind, "promotion");
  await act(async () => f().fields.setPeriod("custom"));
  await act(async () => {
    f().fields.setFromDate("2026-11-01");
    f().fields.setToDate("2026-11-03");
    f().fields.setCategory("campaign");
    f().fields.setStatus("completed");
  });
  assert.equal(f().filters.from, new Date("2026-11-01T00:00:00").toISOString());
  assert.equal(f().filters.to, new Date("2026-11-04T00:00:00").toISOString());
  assert.equal(f().filters.category, "campaign");
  assert.equal("messageKey" in f().filters, false, "定義の鍵では絞らない");
  assert.equal(f().filters.status, "completed");
  assert.equal(f().filters.channel, undefined);
  assert.equal(f().detailCount, 3, "種別・カテゴリー・状態");
  await act(async () => f().clearAll());
  assert.equal(f().filters.kind, undefined);
  assert.equal(f().filters.from, undefined);
  assert.equal(f().filters.sentBy, "admin");
  assert.equal(f().fields.fromDate, "");
  assert.equal(f().fields.period, "all");
  // 種別を変えるとカテゴリーは空に戻る / 種別が無ければカテゴリーは送らない
  await act(async () => f().fields.setKind("promotion"));
  await act(async () => f().fields.setCategory("campaign"));
  await act(async () => f().fields.setKind("direct"));
  assert.equal(f().fields.category, "");
  await act(async () => {
    f().fields.setKind("");
    f().fields.setCategory("orphan");
  });
  assert.equal(f().filters.category, undefined);
  assert.equal(hooks.dispatchFilterStartOf(""), undefined);
  assert.equal(hooks.dispatchFilterNextDay("x"), undefined);
  await view.unmount();
});

test("useAdminDispatchDetail: 配達の絞り・操作の知らせ・削除の後に onDeleted・再送は includeUnknown を渡して戻す", async () => {
  let deleted = 0;
  const view = await mount(() => hooks.useAdminDispatchDetail("d1", { onDeleted: () => void (deleted += 1) }), {});
  const d = () => view.value();
  await settle();
  assert.equal(d().dispatch?.id, "d1");
  assert.equal(d().preview, null, "中身を残していない送信はプレビューを出さない");
  assert.equal(calls.some((c) => c[0] === "dispatchPreview"), false, "中身が無ければプレビューを取らない");
  await act(async () => d().deliveryFilters.setStatus("failed"));
  await settle();
  assert.deepEqual(calls.filter((c) => c[0] === "deliveries").at(-1), ["deliveries", "failed", null]);

  // 削除の見込みは確認を開いている間だけ取る(D88)
  assert.equal(d().deleteSummary, null);
  assert.equal(calls.some((c) => c[0] === "deleteSummary"), false, "確認を開くまで取らない");
  await act(async () => d().setDeleteConfirmOpen(true));
  await settle();
  assert.deepEqual(d().deleteSummary, DELETE_SUMMARY);
  assert.equal(d().deleteSummaryLoading, false);
  assert.equal(d().deleteSummaryError, null);

  await act(async () => d().remove());
  assert.equal(deleted, 1, "削除が通ったら onDeleted");
  await act(async () => d().setIncludeUnknown(true));
  await act(async () => d().resend());
  assert.equal(d().includeUnknown, false, "送った後は戻す");
  await act(async () => d().continueDispatch());
  assert.deepEqual(
    calls.filter((c) => c[0] !== "deliveries"),
    [["deleteSummary", ["d1"]], ["delete"], ["resend", true], ["continue"]],
  );
  assert.deepEqual(toasts, [
    "success:送信を削除しました(サービス内通知 2 件を削除し、未送信 3 件を止めました)",
    "success:2 件を再送しました",
    "success:送信を再開しました(送信 4 / 失敗 0)",
  ]);
  failNext = true;
  await act(async () => d().remove());
  assert.equal(toasts.at(-1), "error:だめ");
  assert.equal(deleted, 1, "失敗は onDeleted を呼ばない");
  await view.unmount();
});

test("useAdminMessageTemplateList: 種別で絞る・作る / 直すの開き先", async () => {
  const view = await mount(() => hooks.useAdminMessageTemplateList(), {});
  const l = () => view.value();
  await settle();
  assert.deepEqual(calls.filter((c) => c[0] === "listTemplates").at(-1), ["listTemplates", null], "既定はすべて");
  await act(async () => l().setKind("promotion"));
  await settle();
  assert.equal(l().kind, "promotion");
  assert.deepEqual(calls.filter((c) => c[0] === "listTemplates").at(-1), ["listTemplates", "promotion"]);
  assert.equal(l().modal.open, false);
  await act(async () => l().modal.openTemplate(ID));
  assert.equal(l().modal.open, true);
  assert.equal(l().modal.templateId, ID);
  await act(async () => l().modal.setOpen(false));
  assert.equal(l().modal.templateId, ID, "閉じても開き先は残す");
  await act(async () => l().modal.openNew());
  assert.equal(l().modal.templateId, null);
  await view.unmount();
});

test("useAdminMessageOverrideList: 一覧と開き先", async () => {
  const view = await mount(() => hooks.useAdminMessageOverrideList(), {});
  await settle();
  assert.equal(view.value().items.length, 1);
  await act(async () => view.value().modal.openMessage("user.welcome"));
  assert.deepEqual([view.value().modal.open, view.value().modal.messageKey], [true, "user.welcome"]);
  await view.unmount();
});

test("useMessageTemplateModal: 閉じている間は取らない・作る → 同じモーダルで直す・開き直すと戻る", async () => {
  const view = await mount((p: { open: boolean }) => hooks.useMessageTemplateModal({ open: p.open, templateId: null }), { open: false });
  const m = () => view.value();
  await settle();
  assert.deepEqual(calls, [], "閉じている間は何も取らない");
  await view.rerender({ open: true });
  await settle();
  assert.equal(m().state, "ready");
  assert.equal(m().mode, "create");
  assert.equal(m().template, null);
  await act(async () => m().setTab("versions"));
  assert.equal(m().tab, "versions");

  await act(async () => m().onCreated("new-id"));
  await settle();
  assert.equal(m().mode, "edit");
  assert.equal(m().template?.id, "new-id");
  assert.ok(calls.some((c) => c[0] === "template" && c[1] === "new-id"));
  assert.ok(m().formKey.includes("new-id"));

  await view.rerender({ open: false });
  await view.rerender({ open: true });
  await settle();
  assert.equal(m().mode, "create", "開き直すと作った id を捨てる");
  assert.equal(m().tab, "text");
  await view.unmount();
});

test("useMessageTemplateForm: onCreated に作った id、closeConfirm は書きかけの間だけ", async () => {
  const created: string[] = [];
  const view = await mount(
    () => hooks.useMessageTemplateForm({ template: null, options: OPTIONS as never, onCreated: (id) => void created.push(id) }),
    {},
  );
  const f = () => view.value();
  assert.equal(f().closeConfirm.enabled, false);
  assert.equal(f().fields.layout, "notice", "選べるレイアウトが 1 つなら選んだ形");
  await act(async () => {
    f().fields.setName("秋");
    f().fields.setKind("promotion");
  });
  assert.equal(f().fields.category, "promotion", "種別を選ぶと最初のカテゴリー");
  await act(async () => f().valuesForm.form.setValue("subject" as never, "件名" as never));
  assert.equal(f().closeConfirm.enabled, true);
  await act(async () => f().save());
  assert.deepEqual(created, ["new-id"]);
  // 作る = 1 回(鍵はサーバーが作る)、名前・カテゴリー・レイアウト・中身・専用の埋め込み情報
  assert.deepEqual(calls.find((c) => c[0] === "create")?.[1], {
    name: "秋",
    description: null,
    category: "promotion",
    layout: "notice",
    values: { subject: "件名" },
    vars: [],
  });
  assert.equal(f().closeConfirm.enabled, false);
  assert.equal(toasts.at(-1), "success:保存しました(新しいバージョン)");
  await view.unmount();
});

test("useMessageOverrideEditor: closeConfirm は下書きのある間だけ", async () => {
  const view = await mount(() => hooks.useMessageOverrideEditor("user.welcome"), {});
  await settle();
  const e = () => view.value();
  assert.equal(e().closeConfirm.enabled, false);
  await act(async () => e().setDraft(e().detail!.fields[0] as never, "直した件名"));
  assert.equal(e().closeConfirm.enabled, true);
  // 保存していない欄の「元の文言に戻す」は下書きを捨てる(D132)
  await act(async () => e().reset(e().detail!.fields[0] as never));
  assert.equal(e().closeConfirm.enabled, false);
  await view.unmount();
});

test("useMessageTemplateVersion: id と版がそろった時だけ取る", async () => {
  const view = await mount((p: { version: number | null }) => hooks.useMessageTemplateVersion(ID, p.version), { version: null as number | null });
  await settle();
  assert.equal(view.value().version, null);
  assert.deepEqual(calls, []);
  await view.rerender({ version: 2 });
  await settle();
  assert.deepEqual(calls, [["version", ID, 2]]);
  assert.equal(view.value().version?.version, 2);
  await view.unmount();
});

test("useAdminMessageTemplateList.onChanged: 作った = 取り直す、保存 = 行を置き換える、削除 = 行を外す、種別で絞っている時の保存は取り直す", async () => {
  const view = await mount(() => hooks.useAdminMessageTemplateList(), {});
  const l = () => view.value();
  await settle();
  const listCalls = () => calls.filter((c) => c[0] === "listTemplates").length;
  const before = listCalls();
  await act(async () => l().modal.onChanged(detail({ id: "other" }) as never, "create"));
  await settle();
  assert.equal(listCalls(), before + 1, "作った → 先頭から取り直す");
  await act(async () => l().modal.onChanged(detail({ currentVersion: 2, name: "春(新しい版)" }) as never, "publish"));
  assert.deepEqual([l().query.items[0].name, l().query.items[0].currentVersion], ["春(新しい版)", 2]);
  assert.equal(listCalls(), before + 1, "置き換えは取り直さない");
  await act(async () => l().modal.onChanged(detail() as never, "delete"));
  assert.equal(l().query.items.length, 0, "削除した行は外す(取り直さない)");
  assert.equal(listCalls(), before + 1);
  // 種別で絞っている時: テンプレートは種別を持たない(種別はカテゴリーから)ので、保存の後は取り直す(行を消さない)
  await act(async () => l().setKind("promotion"));
  await settle();
  const filtered = listCalls();
  assert.equal(l().query.items.length, 1);
  await act(async () => l().modal.onChanged(detail({ name: "春2" }) as never, "update"));
  await settle();
  assert.equal(listCalls(), filtered + 1, "絞りの中の保存 → 取り直す");
  assert.equal(l().query.items.length, 1, "種別を持たないテンプレートの行を外さない");
  await view.unmount();
});

test("useMessageTemplateForm: 作る・新しい版・変わらない保存・削除の後に onChanged(返った 1 件と操作)", async () => {
  const changed: string[] = [];
  const onChanged = (template: { id: string }, action: string) => void changed.push(`${action}:${template.id}`);
  const create = await mount(() => hooks.useMessageTemplateForm({ template: null, options: OPTIONS as never, onChanged }), {});
  await act(async () => {
    create.value().fields.setName("秋");
    create.value().fields.setKind("promotion");
  });
  await act(async () => create.value().valuesForm.form.setValue("subject" as never, "件名" as never));
  await act(async () => create.value().save());
  await create.unmount();
  // 1 件は描くたびに同じ物(画面では SWR の値。描くたびに新しい物を渡すと書く欄が作り直され続ける)
  const saved = detail();
  const edit = await mount(() => hooks.useMessageTemplateForm({ template: saved as never, options: OPTIONS as never, onChanged }), {});
  assert.equal(edit.value().fields.kind, "promotion", "直す時はカテゴリーの種別");
  await act(async () => edit.value().fields.setName("春2"));
  await act(async () => edit.value().save());
  nextUnchanged = true;
  await act(async () => edit.value().save());
  assert.equal(toasts.at(-1), "info:変更はありません");
  let removed: boolean | null = null;
  await act(async () => {
    removed = await edit.value().remove();
  });
  assert.equal(removed, true);
  assert.deepEqual(changed, ["create:new-id", `publish:${ID}`, `update:${ID}`, `delete:${ID}`]);
  assert.deepEqual(
    calls.filter((c) => c[0] === "update" || c[0] === "deleteTemplate"),
    [["update", ID, "春2"], ["update", ID, "春2"], ["deleteTemplate", ID]],
  );
  assert.equal(toasts.at(-1), "success:削除しました");
  await edit.unmount();
});

test("useMessageTemplateModal: 作った直後に 1 件がまだ無い間は読み込み中", async () => {
  slowTemplate = Promise.withResolvers<void>();
  const view = await mount((p: { open: boolean }) => hooks.useMessageTemplateModal({ open: p.open }), { open: true });
  await settle();
  assert.equal(view.value().state, "ready");
  await act(async () => view.value().onCreated("slow-id"));
  assert.equal(view.value().state, "loading", "空の中身を出さない");
  assert.equal(view.value().mode, "edit");
  await act(async () => slowTemplate.resolve());
  await settle();
  assert.equal(view.value().state, "ready");
  assert.equal(view.value().template?.id, "slow-id");
  await view.unmount();
});

test("useAdminDispatchCategories: 種別ごとの選択肢(表示名)と表示名の引き、種別が無ければ空", async () => {
  const view = await mount(() => hooks.useAdminDispatchCategories(), {});
  await settle();
  const c = () => view.value();
  assert.equal(c().loaded, true);
  assert.deepEqual(c().optionsOf("promotion"), [
    { value: "campaign", label: "キャンペーン" },
    { value: "spring", label: "春の案内" },
  ]);
  assert.deepEqual(c().optionsOf(""), []);
  assert.equal(c().labelOf("operatorDirect"), "運営からのご連絡");
  assert.equal(c().labelOf("gone"), null);
  assert.equal(c().labelOf(null), null);
  await view.unmount();
});
