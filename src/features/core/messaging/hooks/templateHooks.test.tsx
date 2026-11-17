// 保存されたテンプレートの hook の検査(jsdom の上で描く。client service・toast・離れる前の確認は偽物)。
// - compactLayoutValues / canonicalJson / emptyEmbeddedDraft(純粋な関数)
// - useMessageTemplates: 種別を渡し、先頭は cursor なし → 続きは nextCursor
// - useMessageTemplateForm(作る): 種別を先に選ばない(D110)→ 種別でカテゴリーを自動(D118)・ひな形が 1 つなら自動 → 中身(ひな形の欄)/
//   書きかけの印と離れる前の確認 / 知らない {{名前}} = 共通 + 専用の外 / 専用の埋め込み情報のモーダル / 保存 = 1 回の POST(鍵なし、D134)・作った id
// - useMessageTemplateForm(直す): 開いた時は書きかけでない(jsonb の鍵の順でも、J142)/ 保存 = 1 回の PATCH(新しい版 or 変更はありません)・
//   1 件のキャッシュと版を取り直す / ひな形を替えると確かめて中身を消す(D113)/ 削除(D137)
// - システムテンプレートは読むだけ(保存・削除しない、D117)
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
const NOTICE = {
  key: "notice",
  label: "汎用のお知らせ",
  description: null,
  version: 1,
  fields: {
    subject: { type: "line", label: "件名", required: true },
    blocks: { type: "blocks", label: "本文" },
  },
};
const ALERT = { key: "alert", label: "警告", description: null, version: 1, fields: { title: { type: "line", label: "題", required: true } } };
const OPTIONS = {
  channels: [
    { key: "email", label: "メール" },
    { key: "inApp", label: "お知らせ" },
  ],
  categories: [
    { key: "operatorNews", label: "運営からのお知らせ", description: null, kind: "announcement", channels: ["email", "inApp"] },
    { key: "marketing", label: "キャンペーン", description: null, kind: "promotion", channels: ["email", "inApp"] },
    { key: "marketingSale", label: "セール", description: null, kind: "promotion", channels: ["email"] },
  ],
  layouts: [NOTICE],
  baseCatalog: [{ key: "displayName", alias: "表示名", source: "common", description: null }],
};
const OPTIONS_TWO_LAYOUTS = { ...OPTIONS, layouts: [NOTICE, ALERT] };
const detail = (extra: Record<string, unknown> = {}) => ({
  id: ID,
  key: "spring",
  name: "春",
  description: null,
  category: "marketing",
  categoryLabel: "キャンペーン",
  status: "published",
  currentVersion: 1,
  createdBy: null,
  updatedBy: null,
  createdAt: "2026-11-12T00:00:00.000Z",
  updatedAt: null,
  system: false,
  kind: null,
  layout: "notice",
  // DB の jsonb は鍵を並べ直して返す(フォームの宣言の順と違う。書きかけの判定は順に依らない、J142)
  values: { blocks: [], subject: "{{discount}} 割引" },
  layoutVersion: 1,
  embedded: [{ key: "discount", alias: "割引", type: "number", required: true }],
  catalog: [],
  hasUnpublishedChanges: false,
  ...extra,
});

const listCalls: Record<string, unknown>[] = [];
const calls: unknown[][] = [];
const toasts: [string, string][] = [];
let detailCalls = 0;
let versionCalls = 0;
let updateUnchanged = false;
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
    getMessageTemplateVersion: async () => null,
    createMessageTemplate: async (input: unknown) => {
      calls.push(["create", input]);
      return detail({ id: "new-id" });
    },
    updateMessageTemplate: async (id: string, input: unknown) => {
      calls.push(["update", id, input]);
      return { ...detail({ currentVersion: updateUnchanged ? 1 : 2 }), unchanged: updateUnchanged };
    },
    deleteMessageTemplate: async (id: string) => {
      calls.push(["delete", id]);
      return { id, deleted: true };
    },
    previewMessageLayout: async () => null,
  },
});
const showToast = (message: string, type: string) => void toasts.push([message, type]);
mock.module("@/lib/toast", { namedExports: { useToast: () => ({ showToast }) } });
const guarded: boolean[] = [];
mock.module("@/lib/unsavedGuard", { namedExports: { useUnsavedGuard: (when: boolean) => void guarded.push(when) } });

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let hooks: typeof import("./index");
let pure: typeof import("./useMessageTemplateForm");
let SWRConfig: typeof import("swr").SWRConfig;
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  ({ SWRConfig } = await import("swr"));
  hooks = await import("./index");
  pure = await import("./useMessageTemplateForm");
});
after(() => dom.window.close());
beforeEach(() => {
  listCalls.length = 0;
  calls.length = 0;
  toasts.length = 0;
  guarded.length = 0;
  updateUnchanged = false;
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

test("compactLayoutValues / canonicalJson / emptyEmbeddedDraft", () => {
  // 空の欄(空白だけの文字・0 個の並び・中が全部空の object)は落とす。0 や false は空でない
  assert.deepEqual(
    pure.compactLayoutValues({ subject: "s", heading: " ", blocks: [], cta: { label: "", url: "" }, count: 0, on: false }),
    { subject: "s", count: 0, on: false },
  );
  // 鍵の順に依らない(並びの順は保つ)
  assert.equal(
    pure.canonicalJson({ b: 1, a: { d: [{ y: 1, x: 2 }], c: 2 } }),
    pure.canonicalJson({ a: { c: 2, d: [{ x: 2, y: 1 }] }, b: 1 }),
  );
  assert.equal(pure.canonicalJson({ b: 1, a: [2, 1] }), '{"a":[2,1],"b":1}');
  assert.notEqual(pure.canonicalJson([1, 2]), pure.canonicalJson([2, 1]));
  assert.deepEqual(pure.emptyEmbeddedDraft(), { key: "", alias: "", type: "line", required: false, default: "", options: [] });
});

test("useMessageTemplates: 種別を渡し、cursor で続きを取る", async () => {
  const view = await mount(() => hooks.useMessageTemplates({ kind: "promotion", limit: 1 }));
  await act(async () => view.value().loadMore());
  assert.deepEqual(view.value().items.map((item) => item.id), [ID, "x"]);
  assert.deepEqual(listCalls, [
    { kind: "promotion", cursor: null, limit: 1 },
    { kind: "promotion", cursor: "c1", limit: 1 },
  ]);
  await view.unmount();
});

test("useMessageTemplateForm(作る): 種別 → カテゴリー(自動)→ ひな形 → 中身、知らない名前、専用の埋め込み情報、1 回の POST で作った id", async () => {
  const created: string[] = [];
  const changed: [string, string][] = [];
  const view = await mount(() =>
    hooks.useMessageTemplateForm({
      template: null,
      options: OPTIONS as never,
      onCreated: (id) => created.push(id),
      onChanged: (template, action) => changed.push([template.id, action]),
    }),
  );
  const form = () => view.value();
  assert.equal(form().mode, "create");
  // 種別は先に選ばない(D110)。ひな形は 1 つなら自動
  assert.equal(form().fields.kind, "");
  assert.equal(form().fields.category, "");
  assert.deepEqual(form().fields.categoryChoices, []);
  assert.deepEqual(form().fields.kindOptions.map((option) => option.value), ["announcement", "promotion"]);
  assert.equal(form().fields.layout, "notice");
  assert.equal(form().fieldsReady, false);
  assert.equal(form().fieldsHint, "種別・カテゴリーを選ぶと入力欄が出ます");
  assert.equal(form().dirty, false);

  // 種別を選ぶとその種別の最初のカテゴリー(D118)。経路はカテゴリーの物
  await act(async () => form().fields.setKind("promotion"));
  assert.equal(form().fields.category, "marketing");
  assert.deepEqual(form().fields.categoryChoices.map((choice) => choice.value), ["marketing", "marketingSale"]);
  assert.deepEqual(form().fields.channels, ["email", "inApp"]);
  assert.equal(form().fieldsReady, true);
  assert.equal(form().fieldsHint, null);
  await act(async () => form().fields.setCategory("marketingSale"));
  assert.deepEqual(form().fields.channels, ["email"]);
  await act(async () => form().fields.setCategory("marketing"));

  // 名前が無ければ保存しない(知らせだけ)
  await act(async () => {
    await form().save();
  });
  assert.equal(calls.length, 0);
  assert.deepEqual(toasts.at(-1), ["名前を入力してください", "error"]);

  await act(async () => form().fields.setName("春"));
  assert.equal(form().dirty, true);
  assert.equal(guarded.at(-1), true);
  assert.equal(form().closeConfirm.enabled, true);

  // 中身はひな形の欄。共通(鍵・別名)は使え、一覧に無い名前は知らない名前
  await act(async () => form().valuesForm.form.setValue("subject", "{{coupon}} {{表示名}} {{displayName}}"));
  assert.deepEqual(form().values, { subject: "{{coupon}} {{表示名}} {{displayName}}" });
  assert.deepEqual(form().unknownNames, ["coupon"]);
  await act(async () => {
    await form().save();
  });
  assert.equal(calls.length, 0, "知らない名前があれば保存しない");
  assert.deepEqual(toasts.at(-1), ["使えない埋め込み情報があります: coupon", "error"]);

  // 専用の埋め込み情報のモーダル: 適用は検査を通った時だけ(共通の名前と重なる行は止める)
  await act(async () => form().embeddedEditor.openEditor());
  await act(async () => form().embeddedEditor.addRow());
  await act(async () => form().embeddedEditor.updateRow(0, { key: "displayName", alias: "クーポン" }));
  let applied = true;
  await act(async () => {
    applied = form().embeddedEditor.apply();
  });
  assert.equal(applied, false);
  assert.ok(form().embeddedEditor.errors.length > 0);
  assert.equal(form().embeddedEditor.open, true);
  assert.equal(form().embeddedEditor.count, 0);
  await act(async () => form().embeddedEditor.updateRow(0, { key: "coupon", alias: "クーポン" }));
  await act(async () => {
    applied = form().embeddedEditor.apply();
  });
  assert.equal(applied, true);
  assert.equal(form().embeddedEditor.open, false);
  assert.equal(form().embeddedEditor.count, 1);
  assert.deepEqual(form().unknownNames, []);

  await act(async () => {
    await form().save();
  });
  assert.deepEqual(calls, [
    [
      "create",
      {
        name: "春",
        description: null,
        category: "marketing",
        layout: "notice",
        values: { subject: "{{coupon}} {{表示名}} {{displayName}}" },
        embedded: [{ key: "coupon", alias: "クーポン", type: "line", required: false }],
      },
    ],
  ]);
  assert.equal(form().createdId, "new-id");
  assert.deepEqual(created, ["new-id"]);
  assert.deepEqual(changed, [["new-id", "create"]]);
  assert.deepEqual(toasts.at(-1), ["保存しました(新しいバージョン)", "success"]);
  assert.equal(form().dirty, false, "作った後は書きかけとみなさない(移る前の確認を出さない)");
  await view.unmount();
});

// 直す 1 件は描くたびに作らない(呼び手は SWR の同じ値を渡す。毎回新しい物は書く欄を作り直し続ける)
const EDITING = detail();
const SYSTEM_BLANK = detail({ id: "system:announcement", system: true, kind: "announcement", category: "", embedded: [] });

test("useMessageTemplateForm(直す): 開いた時は書きかけでない・1 回の PATCH(新しい版 / 変更はありません)・版を取り直す・削除", async () => {
  const changed: [string, string][] = [];
  const view = await mount(() => ({
    one: hooks.useMessageTemplate(ID),
    versions: hooks.useMessageTemplateVersions(ID),
    form: hooks.useMessageTemplateForm({
      template: EDITING as never,
      options: OPTIONS as never,
      onChanged: (template, action) => changed.push([template.id, action]),
    }),
  }));
  const form = () => view.value().form;
  assert.equal(form().mode, "edit");
  assert.equal(form().fields.kind, "promotion", "直す時は保存したカテゴリーの種別");
  assert.equal(form().fields.category, "marketing");
  assert.equal(form().readOnly, false);
  assert.equal(form().dirty, false, "保存した中身の鍵の順が違っても書きかけにしない(J142)");
  assert.deepEqual(form().unknownNames, [], "専用の別名 割引 は使える");

  await act(async () => form().fields.setName("春の"));
  assert.equal(form().dirty, true);
  const before = { versionCalls };
  await act(async () => {
    await form().save();
  });
  assert.deepEqual(calls, [
    [
      "update",
      ID,
      {
        name: "春の",
        description: null,
        category: "marketing",
        layout: "notice",
        values: { subject: "{{discount}} 割引" },
        embedded: [{ key: "discount", alias: "割引", type: "number", required: true }],
      },
    ],
  ]);
  assert.deepEqual(changed, [[ID, "publish"]], "中身が違えば新しい版(公開)");
  assert.deepEqual(toasts.at(-1), ["保存しました(新しいバージョン)", "success"]);
  assert.ok(versionCalls > before.versionCalls, "版の一覧を取り直す");

  // 同じ中身 = 新しい版を作らない
  updateUnchanged = true;
  await act(async () => {
    await form().save();
  });
  assert.deepEqual(changed.at(-1), [ID, "update"]);
  assert.deepEqual(toasts.at(-1), ["変更はありません", "info"]);

  // 削除(D137): 消せたら true、onChanged は delete
  let removed = false;
  await act(async () => {
    removed = await form().remove();
  });
  assert.equal(removed, true);
  assert.deepEqual(calls.at(-1), ["delete", ID]);
  assert.deepEqual(changed.at(-1), [ID, "delete"]);
  assert.deepEqual(toasts.at(-1), ["削除しました", "success"]);
  assert.ok(detailCalls >= 1);
  await view.unmount();
});

test("useMessageTemplateForm: ひな形を替えると中身があれば確かめて消す(D113)、中身が無ければすぐ替える", async () => {
  const view = await mount(() => hooks.useMessageTemplateForm({ template: EDITING as never, options: OPTIONS_TWO_LAYOUTS as never }));
  const form = () => view.value();
  assert.deepEqual(form().fields.layoutOptions.map((option) => option.value), ["notice", "alert"]);
  assert.deepEqual(form().values, { subject: "{{discount}} 割引" });
  await act(async () => form().fields.requestLayoutChange("alert"));
  assert.equal(form().fields.pendingLayout, "alert", "中身があるので確かめる");
  assert.equal(form().fields.layout, "notice");
  await act(async () => form().fields.cancelLayoutChange());
  assert.equal(form().fields.pendingLayout, null);
  assert.equal(form().fields.layout, "notice");
  assert.deepEqual(form().values, { subject: "{{discount}} 割引" }, "取り消せば中身はそのまま");
  await act(async () => form().fields.requestLayoutChange("alert"));
  await act(async () => form().fields.confirmLayoutChange());
  assert.equal(form().fields.layout, "alert");
  assert.equal(form().fields.pendingLayout, null);
  assert.deepEqual(form().values, {}, "中身は付け替えず空から");
  assert.equal(form().layoutFields, ALERT.fields);
  assert.equal(form().dirty, true);
  // 中身が空なら確かめずに替える
  await act(async () => form().fields.requestLayoutChange("notice"));
  assert.equal(form().fields.pendingLayout, null);
  assert.equal(form().fields.layout, "notice");
  await view.unmount();
});

test("useMessageTemplateForm: システムテンプレートは読むだけ(保存・削除しない、D117)", async () => {
  const view = await mount(() =>
    hooks.useMessageTemplateForm({
      template: SYSTEM_BLANK as never,
      options: OPTIONS as never,
    }),
  );
  const form = () => view.value();
  assert.equal(form().system, true);
  assert.equal(form().readOnly, true);
  assert.equal(form().fields.kind, "announcement", "カテゴリーの無い白紙は種別で");
  await act(async () => form().fields.setName("書き換え"));
  assert.equal(form().dirty, false, "読むだけは書きかけにしない");
  await act(async () => {
    await form().save();
  });
  let removed = true;
  await act(async () => {
    removed = await form().remove();
  });
  assert.equal(removed, false);
  assert.deepEqual(calls, []);
  await view.unmount();
});
