// 単体のアップローダーの欄(ControlledMediaField)が失敗したまま AppForm を送らないことの検査。
// 失敗 → 送信を止めてトースト → やり直して成功 → 送れる。AdminNotificationSend の画像欄も同じ道。
// 実行: pnpm test src/components/Form/backgroundFailure.render.test.tsx(tsx + node:test のモジュールモック + jsdom の上で描画)
// (package.json に type: module が無いので tsx は CJS として読む = top-level await 不可 → before() で import)
import { after, before, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createElement, useEffect, type ReactNode } from "react";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
const g = globalThis as Record<string, unknown>;
for (const key of ["window", "document", "HTMLElement", "HTMLInputElement", "Node", "Event", "MouseEvent", "File", "FileList", "navigator", "getComputedStyle"]) {
  // navigator は Node の組み込み(getter だけ)なので defineProperty で差し替える
  const value = key === "window" ? dom.window : (dom.window as unknown as Record<string, unknown>)[key];
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
}
g.IS_REACT_ACT_ENVIRONMENT = true;
g.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
URL.createObjectURL = () => "blob:preview";
URL.revokeObjectURL = () => {};

// アップロードの結果を手で決める: 呼ばれるたびに次の結果(true = 成功)を使う
type UploadCallbacks = { onComplete: (r: { ref: string }) => void; onError: (e: Error) => void };
const outcomes: boolean[] = [];
let uploads = 0;
mock.module("@/lib/storage/client", {
  namedExports: {
    uploadToStorage: (_file: File, callbacks: UploadCallbacks) => {
      uploads += 1;
      const ok = outcomes.shift() ?? true;
      queueMicrotask(() => (ok ? callbacks.onComplete({ ref: `storage://notification.image/${uploads}` }) : callbacks.onError(new Error("ネットワークエラー"))));
      return { cancel: () => {} };
    },
    isStorageUploadCanceled: () => false,
    pickerAcceptFor: (accept: string | undefined) => accept,
    shrinkImageForPurpose: async (file: File) => file,
    usePurposeMetadata: () => "strip",
    storageClient: { remove: async () => {} },
    usePrivateMediaRecovery: () => ({ status: "idle", onError: () => {}, src: undefined }),
    withMediaRetryQuery: (src: string) => src,
    MEDIA_RETRY_QUERY: "r",
  },
});

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let useForm: typeof import("react-hook-form").useForm;
let AppForm: typeof import("@/components/Form").AppForm;
let ControlledMediaField: typeof import("@/components/Form").ControlledMediaField;
let useToastStore: typeof import("@/lib/toast").useToastStore;
let BACKGROUND_FAILURE_MESSAGE: string;
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  ({ useForm } = await import("react-hook-form"));
  ({ AppForm, ControlledMediaField } = await import("@/components/Form"));
  ({ useToastStore } = await import("@/lib/toast"));
  ({ BACKGROUND_FAILURE_MESSAGE } = await import("./backgroundFailure"));
});
after(() => dom.window.close());

type Values = { image: string | null };

/** 出たトーストの文を外へ渡す(トーストは 1 枚ずつ。描画中に外の変数を直接書き換えない) */
const ToastSpy = ({ report }: { report: (message: string) => void }): ReactNode => {
  const { toast } = useToastStore();
  useEffect(() => {
    if (toast) report(toast.message);
  }, [toast, report]);
  return null;
};

const toasts: string[] = [];
const reportToast = (message: string) => {
  toasts.push(message);
};

const mount = async (onSubmit: (values: Values) => void) => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const Probe = (): ReactNode => {
    const methods = useForm<Values>({ defaultValues: { image: null } });
    // children を props で渡す(AppForm の props 型は children が必須。createElement の第 3 引数では型に乗らない)
    const children = [
      createElement(ControlledMediaField<Values, "image">, {
        key: "image",
        control: methods.control,
        methods,
        name: "image",
        label: "画像",
        purpose: "notification.image",
        accept: "image/*",
      }),
      createElement("button", { key: "submit", type: "submit" }, "送信"),
      createElement(ToastSpy, { key: "toast", report: reportToast }),
    ];
    const props = { methods, onSubmit: async (values: Values) => onSubmit(values), children };
    return createElement(AppForm<Values>, props);
  };
  await act(async () => root.render(createElement(Probe)));
  return { container, unmount: () => act(async () => root.unmount()) };
};

/** 隠しのファイル入力にファイルを渡す(MediaInput の onChange が拾う) */
const pick = (container: HTMLElement) =>
  act(async () => {
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new dom.window.File(["x"], "a.png", { type: "image/png" });
    Object.defineProperty(input, "files", { configurable: true, value: [file] });
    input.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

const submit = (container: HTMLElement) =>
  act(async () => {
    const form = container.querySelector("form") as HTMLFormElement;
    form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });


test("失敗したままは送らずトースト、やり直して成功すれば送れる", async () => {
  outcomes.push(false, true);
  const sent: Values[] = [];
  const view = await mount((values) => sent.push(values));

  await pick(view.container);
  assert.equal(uploads, 1);
  assert.match(view.container.textContent ?? "", /ネットワークエラー/, "欄にエラーが出る");

  await submit(view.container);
  assert.deepEqual(sent, [], "失敗したままなら送らない");
  assert.ok(toasts.includes(BACKGROUND_FAILURE_MESSAGE), "送信を止めたトーストが出る");

  await pick(view.container);
  assert.equal(uploads, 2);
  assert.doesNotMatch(view.container.textContent ?? "", /ネットワークエラー/, "やり直しでエラーが消える");

  await submit(view.container);
  assert.deepEqual(sent, [{ image: "storage://notification.image/2" }], "成功した値で送る");
  await view.unmount();
});
