// 必須の印とプレビューの未入力の警告が requiredFor を送る送信チャンネルに対して読む検査(D211。jsdom の上で描く。プレビューの口は偽物)。
// - fieldRequiredIn: 宣言の required、または requiredFor が channels に当たる / channels を渡さなければ required だけ
// - LayoutFields: 件名(requiredFor email)はメールを選んだ時だけ必須の印、メールが無ければ印なし。required の欄はいつも印
// - useLayoutPreview の incompleteChannels: メールがある時だけ件名の空を未入力に数える
// 実行: pnpm test src/domains/core/messaging/components/common/LayoutFields/requiredFor.test.tsx
import { after, before, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { JSDOM } from "jsdom";
import type { FieldValues } from "react-hook-form";

import type { MessageFieldSpec } from "@/lib/messaging";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true });
const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.HTMLElement = dom.window.HTMLElement;
g.Node = dom.window.Node;
g.IS_REACT_ACT_ENVIRONMENT = true;

// プレビューの口(描き直しは呼ばせない: enabled false。呼ばれても空を返す)
mock.module("@/domains/core/messaging/services/client/templateClient", {
  namedExports: { previewMessageLayout: async () => ({ channel: "email", html: "", subject: null, summary: null }) },
});

const FIELDS: Record<"subject" | "body" | "note", MessageFieldSpec> = {
  subject: { type: "line", label: "件名", requiredFor: ["email"] },
  body: { type: "paragraph", label: "本文", required: true },
  note: { type: "line", label: "補足" },
};

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let useForm: typeof import("react-hook-form").useForm;
let messaging: typeof import("@/lib/messaging");
let LayoutFields: typeof import("./index").LayoutFields;
let useLayoutPreview: typeof import("@/domains/core/messaging/hooks/useLayoutPreview").useLayoutPreview;
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  ({ useForm } = await import("react-hook-form"));
  messaging = await import("@/lib/messaging");
  ({ LayoutFields } = await import("./index"));
  ({ useLayoutPreview } = await import("@/domains/core/messaging/hooks/useLayoutPreview"));
});
after(() => dom.window.close());

const renderFields = async (channels: readonly string[]) => {
  function Host() {
    const form = useForm<FieldValues>({ defaultValues: { subject: "", body: "", note: "" } });
    return createElement(LayoutFields, { control: form.control, fields: FIELDS, channels });
  }
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(createElement(Host)));
  /** 必須の印のついた欄の見出し */
  const marked = () =>
    [...container.querySelectorAll('[data-slot="layout-field"]')]
      .filter((field) => field.querySelector('[data-slot="layout-field-required-mark"]'))
      .map((field) => (field.querySelector("label")?.textContent ?? "").replace("*", "").trim());
  return { marked, unmount: () => act(async () => root.unmount()) };
};

test("fieldRequiredIn: required、または requiredFor が channels に当たる。channels なしは required だけ", () => {
  assert.equal(messaging.fieldRequiredIn(FIELDS.subject, ["email", "inApp"]), true);
  assert.equal(messaging.fieldRequiredIn(FIELDS.subject, ["inApp"]), false);
  assert.equal(messaging.fieldRequiredIn(FIELDS.subject), false);
  assert.equal(messaging.fieldRequiredIn(FIELDS.body, ["inApp"]), true);
  assert.equal(messaging.fieldRequiredIn(FIELDS.note, ["email"]), false);
});

test("LayoutFields: 件名はメールを選んだ時だけ必須の印、本文はいつも", async () => {
  const withEmail = await renderFields(["email", "inApp"]);
  assert.deepEqual(withEmail.marked(), ["件名", "本文"]);
  await withEmail.unmount();

  const inAppOnly = await renderFields(["inApp"]);
  assert.deepEqual(inAppOnly.marked(), ["本文"]);
  await inAppOnly.unmount();
});

test("useLayoutPreview: 件名の空はメールがある時だけ未入力に数える", async () => {
  const seen: { current: readonly string[] } = { current: [] };
  const renderPreview = async (channels: string[]) => {
    function Probe() {
      const preview = useLayoutPreview({ layout: "simple", fields: FIELDS, values: { subject: "", body: "本文あり" }, channels, category: null, enabled: false });
      seen.current = preview.incompleteChannels;
      return null;
    }
    const root = createRoot(document.createElement("div"));
    await act(async () => root.render(createElement(Probe)));
    await act(async () => root.unmount());
    return seen.current;
  };
  assert.deepEqual(await renderPreview(["email", "inApp"]), ["email", "inApp"], "件名はどの送信チャンネルにも渡るので、メールを送る時は両方のタブで未入力");
  assert.deepEqual(await renderPreview(["inApp"]), [], "メールが無ければ件名は任意");
});
