// 保存されたテンプレートの hook の検査(jsdom の上で描く。client service・toast・離れる前の確認は偽物)。
// - useMessageTemplates: 状態を渡し、先頭は cursor なし → 続きは nextCursor
// - useMessageTemplateForm: 作る(鍵つき POST、作った id)/ 直す(PATCH、選んだ経路だけ・空の任意の欄を落とす)/
//   書きかけの印と離れる前の確認 / 使える鍵 = baseAllowedKeys ∪ 変数、知らない鍵 / 公開・取り下げは 1 件と版を取り直す
// - contentForInput / emptyChannelContent(純粋な関数)
// 実行: pnpm test src/features/core/messaging/hooks/templateHooks.test.tsx
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
  status: "published",
  currentVersion: 1,
  createdBy: null,
  updatedBy: null,
  createdAt: "2026-11-12T00:00:00.000Z",
  updatedAt: null,
  content: { email: { subject: "{{discount}} 割引" } },
  variables: [{ key: "discount", label: "割引", type: "string", required: true, source: "dispatch" }],
  allowedKeys: ["serviceName", "discount"],
  hasUnpublishedChanges: true,
  ...extra,
});
const OPTIONS = {
  channels: [
    { key: "email", label: "メール" },
    { key: "inApp", label: "お知らせ" },
  ],
  categories: [{ key: "marketing", label: "お知らせ", description: null }],
  baseAllowedKeys: ["serviceName", "displayName"],
};

const listCalls: Record<string, unknown>[] = [];
const calls: unknown[][] = [];
let detailCalls = 0;
let versionCalls = 0;
mock.module("@/features/core/messaging/services/client/templateClient", {
  namedExports: {
    listMessageTemplates: async (params: Record<string, unknown>) => {
      listCalls.push(params);
      if (!params.cursor) return { items: [detail()], nextCursor: "c1" };
      return { items: [detail({ id: "x" })], nextCursor: null };
    },
    getMessageTemplateOptions: async () => OPTIONS,
    getMessageTemplate: async () => {
      detailCalls += 1;
      return detail();
    },
    listMessageTemplateVersions: async () => {
      versionCalls += 1;
      return [];
    },
    createMessageTemplate: async (input: unknown) => {
      calls.push(["create", input]);
      return detail({ id: "new-id" });
    },
    updateMessageTemplate: async (id: string, input: unknown) => {
      calls.push(["update", id, input]);
      return detail();
    },
    publishMessageTemplate: async (id: string) => {
      calls.push(["publish", id]);
      return detail();
    },
    archiveMessageTemplate: async (id: string) => {
      calls.push(["archive", id]);
      return detail({ status: "archived" });
    },
  },
});
mock.module("@/lib/toast", { namedExports: { useToast: () => ({ showToast: () => {} }) } });
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
  listCalls.length = 0;
  calls.length = 0;
  guarded.length = 0;
  detailCalls = 0;
  versionCalls = 0;
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

test("contentForInput / emptyChannelContent", () => {
  assert.deepEqual(hooks.emptyChannelContent("inApp"), { title: "", body: "" });
  assert.deepEqual(
    hooks.contentForInput(
      {
        email: { subject: "s", heading: " ", paragraphs: [], cta: { label: "", url: "" } },
        inApp: { title: "t", body: "", image: "" },
        line: { text: "x" },
      },
      ["email", "inApp"],
    ),
    { email: { subject: "s" }, inApp: { title: "t", body: "" } },
  );
});

test("useMessageTemplates: 状態を渡し、cursor で続きを取る", async () => {
  const view = await mount(() => hooks.useMessageTemplates({ status: "draft", limit: 1 }));
  await act(async () => view.value().loadMore());
  assert.deepEqual(view.value().items.map((item) => item.id), [ID, "x"]);
  assert.deepEqual(listCalls, [
    { status: "draft", cursor: null, limit: 1 },
    { status: "draft", cursor: "c1", limit: 1 },
  ]);
  await view.unmount();
});

test("useMessageTemplateForm(作る): 鍵なしで POST し(鍵はサーバーが作る)、作った id を返す。知らない鍵を数える", async () => {
  const view = await mount(() => hooks.useMessageTemplateForm({ template: null, options: OPTIONS }));
  const form = () => view.value();
  assert.equal(form().mode, "create");
  assert.equal(form().fields.category, "marketing");
  assert.equal(form().dirty, false);
  await act(async () => {
    form().fields.setName("春");
  });
  // 経路は選ばない: 文言を書いた経路がテンプレートの経路(D85)
  assert.deepEqual(form().fields.channels, []);
  await act(async () => form().fields.setChannelContent("email", { subject: "{{coupon}} {{displayName}}" }));
  await act(async () => form().fields.setChannelContent("inApp", { title: "", body: "" }));
  assert.deepEqual(form().fields.channels, ["email"], "空の経路は経路にしない");
  assert.equal(form().dirty, true);
  assert.equal(guarded.at(-1), true);
  assert.deepEqual(form().unknownKeys, ["coupon"]);
  await act(async () =>
    form().fields.setVariables([{ key: "coupon", label: "クーポン", type: "string", required: false, source: "dispatch", default: "" }]),
  );
  assert.deepEqual(form().unknownKeys, []);
  await act(async () => {
    await form().save();
  });
  assert.equal(calls[0][0], "create");
  assert.deepEqual(calls[0][1], {
    name: "春",
    description: null,
    category: "marketing",
    content: { email: { subject: "{{coupon}} {{displayName}}" } },
    variables: [{ key: "coupon", label: "クーポン", type: "string", required: false, source: "dispatch" }],
  });
  assert.equal(form().createdId, "new-id");
  assert.equal(form().dirty, false, "作った後は書きかけとみなさない(移る前の確認を出さない)");
  await view.unmount();
});

test("useMessageTemplateForm(直す): PATCH・公開・取り下げは 1 件と版を取り直す", async () => {
  const view = await mount(() => ({
    one: hooks.useMessageTemplate(ID),
    versions: hooks.useMessageTemplateVersions(ID),
    form: hooks.useMessageTemplateForm({ template: detail() as never, options: OPTIONS }),
  }));
  const form = () => view.value().form;
  assert.equal(form().mode, "edit");
  assert.equal(form().canPublish, true);
  await act(async () => form().fields.setName("春の"));
  assert.equal(form().canPublish, false, "書きかけがあれば公開できない(先に保存)");
  await act(async () => {
    await form().save();
  });
  assert.deepEqual(calls[0], [
    "update",
    ID,
    {
      name: "春の",
      description: null,
      category: "marketing",
      content: { email: { subject: "{{discount}} 割引" } },
      variables: [{ key: "discount", label: "割引", type: "string", required: true, source: "dispatch" }],
    },
  ]);
  const before = { detailCalls, versionCalls };
  await act(async () => {
    await form().publish();
    await form().archive();
  });
  assert.deepEqual(calls.slice(1), [
    ["publish", ID],
    ["archive", ID],
  ]);
  assert.ok(detailCalls > before.detailCalls && versionCalls > before.versionCalls, "1 件と版を取り直す");
  await view.unmount();
});
