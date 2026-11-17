// 文言の編集の hook の検査(jsdom の上で描く。client service・toast・離れる前の確認は偽物)。
// - useMessageOverrides: 一覧を取る
// - useMessageOverrideEditor: 初めは送る時の値 / 下書き(元に戻せば消える)/ 知らない {{鍵}} / プレビュー(下書きを重ね、待ってから取る。
//   入力中の欄の枠)/ 1 回の保存(D132): 下書きと「元の文言に戻す」の印をまとめて PUT { fields } で送り、下書き・印を捨て、1 連絡と一覧を取り直す /
//   元の文言に戻す = 保存してある欄は印(画面はコードの値)、下書きだけの欄は下書きを捨てる / 400 override_fields_invalid は欄ごとの誤り(下書きは残す)/
//   下書きか印がある間だけ離れる前の確認
// - unknownKeysOf / toEditable / withFocusStyle(純粋な関数)
// 実行: pnpm test src/features/core/messaging/hooks/overrideHooks.test.tsx
import { after, before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { JSDOM } from "jsdom";

import { HttpError } from "@/lib/errors";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.HTMLElement = dom.window.HTMLElement;
g.Node = dom.window.Node;
g.IS_REACT_ACT_ENVIRONMENT = true;

const field = (path: string, effective: unknown, extra: Record<string, unknown> = {}) => ({
  path,
  spec: { type: "line", label: path },
  channels: ["email"],
  editable: true,
  codeValue: effective,
  value: null,
  effective,
  edited: false,
  codeChanged: false,
  unusable: false,
  problem: null,
  updatedAt: null,
  ...extra,
});
const detail = () => ({
  key: "user.registrationComplete",
  label: "登録の完了",
  kind: "transactional",
  category: "account",
  categoryLabel: null,
  allowedKeys: ["displayName", "serviceName"],
  // J126(D132): 経路の一覧と欄(ひな形の欄の鍵・宣言・使う経路)
  channels: [{ key: "email", label: "メール" }],
  fields: [
    field("subject", "ようこそ {{serviceName}}"),
    field("paragraphs", ["a", "b"], { spec: { type: "list", of: { type: "paragraph" }, label: "段落" } }),
  ],
});

let listCalls = 0;
let detailCalls = 0;
const saves: { key: string; input: unknown }[] = [];
const resets: { key: string; path: string }[] = [];
const previews: { key: string; input: unknown }[] = [];
/** 次の保存で投げる誤り(無ければ成功) */
let saveError: unknown = null;
mock.module("@/features/core/messaging/services/client/overrideClient", {
  namedExports: {
    // J99(D86): 編集の hook が下書きを重ねたプレビューを取る
    previewMessageOverride: async (key: string, input: { channel: string; values: Record<string, unknown> }) => {
      previews.push({ key, input });
      return {
        channel: input.channel,
        html: `<html><head></head><body><p>${input.channel}</p></body></html>`,
        text: null,
        layout: "notice",
        values: input.values,
        summary: { title: "題" },
        cannotRender: null,
      };
    },
    listMessageOverrides: async () => {
      listCalls += 1;
      return [{ key: "user.registrationComplete", kind: "transactional", category: "account", editableCount: 3, editedCount: 0, unusableCount: 0, codeChangedCount: 0 }];
    },
    getMessageOverride: async () => {
      detailCalls += 1;
      return detail();
    },
    saveMessageOverride: async (key: string, input: unknown) => {
      saves.push({ key, input });
      if (saveError) {
        const error = saveError;
        saveError = null;
        throw error;
      }
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
/** 入口から書き出していない純粋な関数(hook のファイルから読む) */
let editorModule: typeof import("./useMessageOverrideEditor");
let SWRConfig: typeof import("swr").SWRConfig;
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  ({ SWRConfig } = await import("swr"));
  hooks = await import("./index");
  editorModule = await import("./useMessageOverrideEditor");
});
after(() => dom.window.close());
beforeEach(() => {
  listCalls = 0;
  detailCalls = 0;
  saves.length = 0;
  resets.length = 0;
  previews.length = 0;
  guarded.length = 0;
  saveError = null;
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

/** プレビューの待ち(400ms)の後まで進める */
const waitPreview = () => act(async () => new Promise((r) => setTimeout(r, 450)));

test("unknownKeysOf / toEditable / withFocusStyle", () => {
  assert.deepEqual(hooks.unknownKeysOf("{{a}} {{b}} {{a}}", ["a"]), ["b"]);
  assert.deepEqual(hooks.unknownKeysOf(["{{x}}", "{{y}}"], ["y"]), ["x"]);
  // ひな形の欄の中身の中(組・ブロックの並び)の文字も見る
  assert.deepEqual(hooks.unknownKeysOf([{ type: "paragraph", text: "{{z}}" }, { label: "{{a}}" }], ["a"]), ["z"]);
  // 値はひな形の欄の中身の形のまま(文字に変えない)。無い値は空の文字
  assert.deepEqual(hooks.toEditable(["a", 1]), ["a", 1]);
  assert.equal(hooks.toEditable(null), "");
  assert.equal(hooks.toEditable(undefined), "");
  // 入力中の欄の枠: head があれば head の中、無ければ先頭。欄の道の部分(.番号)にも当たる
  const framed = editorModule.withFocusStyle("<html><head></head><body></body></html>", "subject");
  assert.match(framed, /<style>\[data-field="subject"\],\[data-field\^="subject\."\]\{outline:2px solid #f59e0b;[^<]*<\/style><\/head>/);
  assert.match(editorModule.withFocusStyle("<p>x</p>", "a"), /^<style>\[data-field="a"\]/);
  assert.equal(editorModule.withFocusStyle("<p>x</p>", null), "<p>x</p>");
});

test("useMessageOverrides: 一覧を取る", async () => {
  const view = await mount(() => hooks.useMessageOverrides());
  assert.equal(view.value().items[0].key, "user.registrationComplete");
  assert.equal(listCalls, 1);
  await view.unmount();
});

test("useMessageOverrideEditor: 下書き・知らない鍵・プレビュー・1 回の保存・元の文言に戻す・離れる前の確認", async () => {
  const view = await mount(() => ({ editor: hooks.useMessageOverrideEditor("user.registrationComplete"), list: hooks.useMessageOverrides() }));
  const editor = () => view.value().editor;
  const [subject, paragraphs] = editor().detail!.fields;
  assert.equal(editor().valueOf(subject), "ようこそ {{serviceName}}");
  assert.equal(editor().hasDrafts, false);
  assert.equal(guarded.at(-1), false);
  // 2 つの欄の編集(D80 / D86): 初めは最初の経路、少し待ってプレビューを取る
  assert.equal(editor().activeChannel, "email");
  assert.deepEqual(editor().activeFields.map((f) => f.path), ["subject", "paragraphs"]);
  await waitPreview();
  assert.deepEqual(previews, [{ key: "user.registrationComplete", input: { channel: "email", values: {} } }]);
  assert.equal(editor().previewLayout, "notice");
  assert.equal(editor().previewContent?.html, "<html><head></head><body><p>email</p></body></html>");
  assert.deepEqual(editor().previewContent?.summary, { title: "題" });
  assert.equal(editor().previewLoading, false);
  await act(async () => editor().setFocusedPath("subject"));
  assert.equal(editor().focusedPath, "subject");
  assert.match(editor().previewContent!.html!, /data-field="subject"/, "入力中の欄に枠");

  await act(async () => editor().setDraft(subject, "やあ {{nickname}}"));
  assert.equal(editor().isDirty(subject), true);
  assert.deepEqual(editor().unknownKeys(subject), ["nickname"]);
  assert.equal(guarded.at(-1), true, "下書きがある間は離れる前に確かめる");
  assert.equal(editor().closeConfirm.enabled, true);

  // 元の値に戻せば下書きは消える
  await act(async () => editor().setDraft(subject, "ようこそ {{serviceName}}"));
  assert.equal(editor().isDirty(subject), false);
  assert.equal(editor().hasDrafts, false);
  assert.equal(guarded.at(-1), false);

  await act(async () => editor().setDraft(paragraphs, ["a2", "b"]));
  assert.equal(editor().previewLoading, true, "下書きが変われば描き直し中");
  await waitPreview();
  assert.deepEqual(previews.at(-1), { key: "user.registrationComplete", input: { channel: "email", values: { paragraphs: ["a2", "b"] } } });
  assert.equal(editor().previewLoading, false);

  // 下書きだけの欄の「元の文言に戻す」= 下書きを捨てる(印は付けない、保存の要らない形)
  await act(async () => editor().setDraft(subject, "やあ"));
  await act(async () => editor().reset(subject));
  assert.equal(editor().isDirty(subject), false);
  assert.equal(editor().isResetPending(subject), false);
  assert.equal(editor().pendingCount, 1);

  // 欄の誤り(400 override_fields_invalid): 何も捨てず、欄ごとの理由を返す
  saveError = new HttpError({
    message: "保存できない項目があります(1 件)",
    status: 400,
    responseData: { message: "保存できない項目があります(1 件)", code: "override_fields_invalid", details: { fields: { paragraphs: "段落は必須です" } } },
  });
  await act(async () => {
    await editor().saveAll();
  });
  assert.deepEqual(saves, [{ key: "user.registrationComplete", input: { fields: [{ fieldPath: "paragraphs", value: ["a2", "b"] }] } }]);
  assert.deepEqual(editor().fieldErrors, { paragraphs: "段落は必須です" });
  assert.equal(editor().isDirty(paragraphs), true, "通らなければ下書きは残る");
  // 直すと、その欄の誤りは消える
  await act(async () => editor().setDraft(paragraphs, ["a3", "b"]));
  assert.deepEqual(editor().fieldErrors, {});

  // 1 回の保存(D132): 下書きをまとめて送り、下書きを捨て、1 連絡と一覧を取り直す
  const beforeDetail = detailCalls;
  const beforeList = listCalls;
  await act(async () => {
    await editor().saveAll();
  });
  assert.deepEqual(saves.at(-1), { key: "user.registrationComplete", input: { fields: [{ fieldPath: "paragraphs", value: ["a3", "b"] }] } });
  assert.equal(editor().isDirty(paragraphs), false);
  assert.equal(editor().hasDrafts, false);
  assert.ok(detailCalls > beforeDetail && listCalls > beforeList, "保存の後に 1 連絡と一覧を取り直す");
  assert.equal(resets.length, 0, "欄 1 つを戻す DELETE は使わない");
  await view.unmount();
});

test("useMessageOverrideEditor: 保存してある欄の「元の文言に戻す」は印を付け、保存で reset を送る", async () => {
  const view = await mount(() => hooks.useMessageOverrideEditor("user.registrationComplete"));
  const editor = () => view.value();
  // 保存してある(行のある)欄: 送る時の値 = 管理画面の値、コードの値は元の文言
  const subject = field("subject", "直した件名", { codeValue: "ようこそ {{serviceName}}", value: "直した件名", edited: true });

  await act(async () => editor().reset(subject as never));
  assert.equal(editor().isResetPending(subject as never), true);
  assert.equal(editor().isDirty(subject as never), true, "印も保存していない変更");
  assert.equal(editor().valueOf(subject as never), "ようこそ {{serviceName}}", "画面はコードの値を見せる");
  assert.equal(editor().hasDrafts, true);
  assert.equal(guarded.at(-1), true);

  // 直すと印は外れる
  await act(async () => editor().setDraft(subject as never, "また直した"));
  assert.equal(editor().isResetPending(subject as never), false);
  await act(async () => editor().reset(subject as never));
  assert.equal(editor().isResetPending(subject as never), true);
  assert.equal(editor().isDirty(subject as never), true);

  await act(async () => {
    await editor().saveAll();
  });
  assert.deepEqual(saves, [{ key: "user.registrationComplete", input: { fields: [{ fieldPath: "subject", reset: true }] } }]);
  assert.equal(editor().isResetPending(subject as never), false);
  assert.equal(editor().hasDrafts, false);
  assert.equal(resets.length, 0);
  await view.unmount();
});
