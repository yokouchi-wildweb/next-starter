// 文言の上書きの hook の検査(jsdom の上で描く。client service・toast・離れる前の確認は偽物)。
// - useMessageOverrides: 一覧を取る
// - useMessageOverrideEditor: 初めは送る時の値 / 下書き(元に戻せば消える)/ 知らない {{鍵}} / 保存・既定に戻すは client を呼び、
//   下書きを捨て、1 連絡と一覧を取り直す / 下書きがある間だけ離れる前の確認
// - unknownKeysOf / toEditable(純粋な関数)
// 実行: pnpm test src/features/core/messaging/hooks/overrideHooks.test.tsx
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

const field = (path: string, effective: unknown, extra: Record<string, unknown> = {}) => ({
  path,
  editable: true,
  codeValue: effective,
  value: null,
  effective,
  edited: false,
  codeChanged: false,
  orphan: false,
  problem: null,
  updatedAt: null,
  ...extra,
});
const detail = () => ({
  key: "user.registrationComplete",
  kind: "transactional",
  category: "account",
  allowedKeys: ["displayName", "serviceName"],
  fields: [field("email.subject", "ようこそ {{serviceName}}"), field("email.paragraphs", ["a", "b"])],
});

let listCalls = 0;
let detailCalls = 0;
const saves: { key: string; input: unknown }[] = [];
const resets: { key: string; path: string }[] = [];
mock.module("@/features/core/messaging/services/client/overrideClient", {
  namedExports: {
    listMessageOverrides: async () => {
      listCalls += 1;
      return [{ key: "user.registrationComplete", kind: "transactional", category: "account", editableCount: 3, editedCount: 0, orphanCount: 0, codeChangedCount: 0 }];
    },
    getMessageOverride: async () => {
      detailCalls += 1;
      return detail();
    },
    saveMessageOverride: async (key: string, input: unknown) => {
      saves.push({ key, input });
      return detail();
    },
    resetMessageOverride: async (key: string, path: string) => {
      resets.push({ key, path });
      return detail();
    },
  },
});
mock.module("@/lib/toast", { namedExports: { useToast: () => ({ showToast: () => {} }) } });
const guarded: boolean[] = [];
mock.module("@/lib/unsavedGuard", {
  namedExports: {
    useUnsavedGuard: (when: boolean) => {
      guarded.push(when);
    },
  },
});

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
  listCalls = 0;
  detailCalls = 0;
  saves.length = 0;
  resets.length = 0;
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

test("unknownKeysOf / toEditable", () => {
  assert.deepEqual(hooks.unknownKeysOf("{{a}} {{b}} {{a}}", ["a"]), ["b"]);
  assert.deepEqual(hooks.unknownKeysOf(["{{x}}", "{{y}}"], ["y"]), ["x"]);
  assert.deepEqual(hooks.toEditable(["a", 1]), ["a", "1"]);
  assert.equal(hooks.toEditable(null), "");
});

test("useMessageOverrides: 一覧を取る", async () => {
  const view = await mount(() => hooks.useMessageOverrides());
  assert.equal(view.value().items[0].key, "user.registrationComplete");
  assert.equal(listCalls, 1);
  await view.unmount();
});

test("useMessageOverrideEditor: 下書き・知らない鍵・保存・既定に戻す・離れる前の確認", async () => {
  const view = await mount(() => ({ editor: hooks.useMessageOverrideEditor("user.registrationComplete"), list: hooks.useMessageOverrides() }));
  const editor = () => view.value().editor;
  const [subject, paragraphs] = editor().detail!.fields;
  assert.equal(editor().valueOf(subject), "ようこそ {{serviceName}}");
  assert.equal(editor().hasDrafts, false);
  assert.equal(guarded.at(-1), false);

  await act(async () => editor().setDraft(subject, "やあ {{nickname}}"));
  assert.equal(editor().isDirty(subject), true);
  assert.deepEqual(editor().unknownKeys(subject), ["nickname"]);
  assert.equal(guarded.at(-1), true, "下書きがある間は離れる前に確かめる");

  // 元の値に戻せば下書きは消える
  await act(async () => editor().setDraft(subject, "ようこそ {{serviceName}}"));
  assert.equal(editor().isDirty(subject), false);

  await act(async () => editor().setDraft(paragraphs, ["a2", "b"]));
  const beforeDetail = detailCalls;
  const beforeList = listCalls;
  await act(async () => {
    await editor().save(paragraphs);
  });
  assert.deepEqual(saves, [{ key: "user.registrationComplete", input: { fieldPath: "email.paragraphs", value: ["a2", "b"] } }]);
  assert.equal(editor().isDirty(paragraphs), false);
  assert.ok(detailCalls > beforeDetail && listCalls > beforeList, "保存の後に 1 連絡と一覧を取り直す");

  await act(async () => {
    await editor().reset(subject);
  });
  assert.deepEqual(resets, [{ key: "user.registrationComplete", path: "email.subject" }]);
  await view.unmount();
});
