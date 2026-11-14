// 管理のモーダルと一覧・回の画面の流れの hook の検査(jsdom の上で描く。client service・toast・離れる前の確認は偽物)。
// - useAdminDispatchFilters: 入力と確定を分ける・期間は日付 → ISO(まで = 翌日未満)・clear
// - useAdminDispatchDetail: 配達の絞り / 取り消す・取り下げる・再送(includeUnknown を渡して戻す)・続きを送る → 知らせ、失敗も知らせ
// - useAdminMessageTemplateList / useAdminMessageOverrideList: 絞り・モーダルの開き先
// - useMessageTemplateModal: 閉じている間は取らない / 作る → 同じモーダルで直す形 / 開き直すと作った id とタブが戻る
// - useMessageTemplateVersion: id と版がそろった時だけ 1 版を取る / useModalSession: 開く度に増える
// - closeConfirm: テンプレートの書く欄・文言の上書きの下書き
// - C9: モーダルの操作の後の一覧(作った = 取り直す・公開 / 取り下げ = 行を置き換える・絞りから外れた行は外す)、onChanged は form から
// - 作った直後に 1 件がまだ無い間は読み込み中(空の中身を出さない)
// 実行: pnpm test src/features/core/messaging/hooks/adminModalHooks.test.tsx
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
  category: "marketing",
  status: "draft",
  currentVersion: null,
  createdAt: "2026-11-12T00:00:00.000Z",
  updatedAt: null,
  content: { email: { subject: "件名" } },
  variables: [],
  allowedKeys: ["serviceName"],
  hasUnpublishedChanges: true,
  ...extra,
});
const OPTIONS = {
  channels: [{ key: "email", label: "メール" }],
  categories: [{ key: "marketing", label: "お知らせ", description: null }],
  baseAllowedKeys: ["serviceName"],
};

const calls: unknown[][] = [];
/** 作った直後の 1 件の取り出しを止めておく(読み込み中の検査) */
let slowTemplate = Promise.withResolvers<void>();
let failNext = false;
const maybeFail = () => {
  if (failNext) {
    failNext = false;
    throw new Error("だめ");
  }
};
mock.module("@/features/core/messaging/services/client/templateClient", {
  namedExports: {
    listMessageTemplates: async (params: Record<string, unknown>) => {
      calls.push(["listTemplates", params.status ?? null]);
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
      return { version, content: {}, variables: [], publishedAt: "2026-11-12T00:00:00.000Z" };
    },
    createMessageTemplate: async (input: { key: string }) => {
      calls.push(["create", input.key]);
      return detail({ id: "new-id", key: input.key });
    },
    updateMessageTemplate: async () => detail(),
    publishMessageTemplate: async () => detail(),
    archiveMessageTemplate: async () => detail({ status: "archived" }),
  },
});
const DISPATCH = { id: "d1", status: "processing", operations: {} };
mock.module("@/features/core/messaging/services/client/adminMessagingClient", {
  namedExports: {
    getAdminDispatch: async () => DISPATCH,
    listAdminDispatches: async () => ({ items: [], nextCursor: null }),
    listAdminDispatchDeliveries: async (_id: string, params: Record<string, unknown>) => {
      calls.push(["deliveries", params.status ?? null, params.channel ?? null]);
      return { items: [], nextCursor: null };
    },
    cancelAdminDispatch: async () => {
      maybeFail();
      calls.push(["cancel"]);
      return { canceledDeliveries: 1 };
    },
    retractAdminDispatch: async () => {
      calls.push(["retract"]);
      return { deletedInboxItems: 2, canceledDeliveries: 3 };
    },
    resendAdminDispatch: async (_id: string, input: { includeUnknown?: boolean }) => {
      calls.push(["resend", input.includeUnknown]);
      return { mode: "same_dispatch", failed: 1, unknown: 1 };
    },
    continueAdminDispatch: async () => {
      calls.push(["continue"]);
      return { completed: false, sent: 4, failed: 0 };
    },
  },
});
mock.module("@/features/core/messaging/services/client/overrideClient", {
  namedExports: {
    listMessageOverrides: async () => [{ key: "user.welcome", kind: "transactional", category: "x", editableCount: 1, editedCount: 0, codeChangedCount: 0, orphanCount: 0 }],
    getMessageOverride: async (key: string) => ({
      key,
      kind: "transactional",
      category: "x",
      allowedKeys: [],
      fields: [{ path: "email.subject", effective: "件名", code: "件名", override: null }],
    }),
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

test("useAdminDispatchFilters: 入力は「絞り込む」で確定、期間は日付 → ISO、clear で空", async () => {
  const view = await mount(() => hooks.useAdminDispatchFilters({ kind: "marketing" }), {});
  const f = () => view.value();
  assert.deepEqual(f().filters, { kind: "marketing" });
  assert.equal(f().fields.kind, "marketing");
  await act(async () => {
    f().fields.setFromDate("2026-11-01");
    f().fields.setToDate("2026-11-03");
    f().fields.setMessageKey("  messaging.x  ");
    f().fields.setStatus("completed");
  });
  assert.deepEqual(f().filters, { kind: "marketing" }, "入力だけでは変わらない");
  await act(async () => f().apply());
  assert.equal(f().filters.from, new Date("2026-11-01T00:00:00").toISOString());
  assert.equal(f().filters.to, new Date("2026-11-04T00:00:00").toISOString());
  assert.equal(f().filters.messageKey, "messaging.x");
  assert.equal(f().filters.status, "completed");
  assert.equal(f().filters.channel, undefined);
  await act(async () => f().clear());
  assert.deepEqual(f().filters, {});
  assert.equal(f().fields.fromDate, "");
  assert.equal(hooks.dispatchFilterStartOf(""), undefined);
  assert.equal(hooks.dispatchFilterNextDay("x"), undefined);
  await view.unmount();
});

test("useAdminDispatchDetail: 配達の絞り・操作の知らせ・再送は includeUnknown を渡して戻す", async () => {
  const view = await mount(() => hooks.useAdminDispatchDetail("d1"), {});
  const d = () => view.value();
  await settle();
  assert.equal(d().dispatch?.id, "d1");
  await act(async () => d().deliveryFilters.setStatus("failed"));
  await settle();
  assert.deepEqual(calls.filter((c) => c[0] === "deliveries").at(-1), ["deliveries", "failed", null]);

  await act(async () => d().cancel());
  await act(async () => d().retract());
  await act(async () => d().setIncludeUnknown(true));
  await act(async () => d().resend());
  assert.equal(d().includeUnknown, false, "送った後は戻す");
  await act(async () => d().continueDispatch());
  assert.deepEqual(
    calls.filter((c) => c[0] !== "deliveries"),
    [["cancel"], ["retract"], ["resend", true], ["continue"]],
  );
  assert.deepEqual(toasts, [
    "success:予約を取り消しました",
    "success:取り下げました(お知らせ 2 件を消し、配達 3 件を止めました)",
    "success:2 件を送り直しました",
    "success:続きを送りました(送信 4 / 失敗 0)",
  ]);
  failNext = true;
  await act(async () => d().cancel());
  assert.equal(toasts.at(-1), "error:だめ");
  await view.unmount();
});

test("useAdminMessageTemplateList: 状態で絞る・作る / 直すの開き先", async () => {
  const view = await mount(() => hooks.useAdminMessageTemplateList(), {});
  const l = () => view.value();
  await settle();
  await act(async () => l().setStatus("draft"));
  await settle();
  assert.deepEqual(calls.filter((c) => c[0] === "listTemplates").at(-1), ["listTemplates", "draft"]);
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

test("useModalSession: 閉 → 開 の度に増える", async () => {
  const view = await mount((p: { open: boolean }) => hooks.useModalSession(p.open), { open: false });
  assert.equal(view.value(), 0);
  await view.rerender({ open: true });
  assert.equal(view.value(), 1);
  await view.rerender({ open: false });
  assert.equal(view.value(), 1);
  await view.rerender({ open: true });
  assert.equal(view.value(), 2);
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
  await act(async () => m().setTab("variables"));
  assert.equal(m().tab, "variables");

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
  await act(async () => {
    f().fields.setKey("autumn");
    f().fields.setName("秋");
    f().fields.setChannelContent("email", { subject: "件名" });
  });
  assert.equal(f().closeConfirm.enabled, true);
  await act(async () => f().save());
  assert.deepEqual(created, ["new-id"]);
  assert.equal(f().closeConfirm.enabled, false);
  await view.unmount();
});

test("useMessageOverrideEditor: closeConfirm は下書きのある間だけ", async () => {
  const view = await mount(() => hooks.useMessageOverrideEditor("user.welcome"), {});
  await settle();
  const e = () => view.value();
  assert.equal(e().closeConfirm.enabled, false);
  await act(async () => e().setDraft(e().detail!.fields[0] as never, "直した件名"));
  assert.equal(e().closeConfirm.enabled, true);
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

test("useAdminMessageTemplateList.onChanged: 作った = 取り直す、公開 = 行を置き換える、絞りから外れた行は外す", async () => {
  const view = await mount(() => hooks.useAdminMessageTemplateList(), {});
  const l = () => view.value();
  await settle();
  const listCalls = () => calls.filter((c) => c[0] === "listTemplates").length;
  const before = listCalls();
  await act(async () => l().modal.onChanged(detail({ id: "other" }) as never, "create"));
  await settle();
  assert.equal(listCalls(), before + 1, "作った → 先頭から取り直す");
  await act(async () => l().modal.onChanged(detail({ status: "published", currentVersion: 1, name: "春(公開)" }) as never, "publish"));
  assert.deepEqual([l().query.items[0].status, l().query.items[0].name, l().query.items[0].currentVersion], ["published", "春(公開)", 1]);
  assert.equal(listCalls(), before + 1, "置き換えは取り直さない");
  await act(async () => l().setStatus("published"));
  await settle();
  await act(async () => l().modal.onChanged(detail({ status: "archived" }) as never, "archive"));
  assert.equal(l().query.items.length, 0, "公開中で絞っている時に取り下げた行は外す");
  await view.unmount();
});

test("useMessageTemplateForm: 作る・保存・公開・取り下げの後に onChanged(返った 1 件と操作)", async () => {
  const changed: string[] = [];
  const onChanged = (template: { id: string }, action: string) => void changed.push(`${action}:${template.id}`);
  const create = await mount(() => hooks.useMessageTemplateForm({ template: null, options: OPTIONS as never, onChanged }), {});
  await act(async () => {
    create.value().fields.setKey("autumn");
    create.value().fields.setName("秋");
    create.value().fields.setChannelContent("email", { subject: "件名" });
  });
  await act(async () => create.value().save());
  await create.unmount();
  const edit = await mount(() => hooks.useMessageTemplateForm({ template: detail() as never, options: OPTIONS as never, onChanged }), {});
  await act(async () => edit.value().fields.setName("春2"));
  await act(async () => edit.value().save());
  await act(async () => edit.value().publish());
  await act(async () => edit.value().archive());
  assert.deepEqual(changed, ["create:new-id", `update:${ID}`, `publish:${ID}`, `archive:${ID}`]);
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
