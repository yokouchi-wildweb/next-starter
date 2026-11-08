// 入力部品がサイズの検査の前に整える（prepareFile → 用途の宣言の画像の縮小）ことの検査。
// MediaInput（prepareFile の口）・MediaUploader（呼び出し側の整え → 縮小）・MediaUploaderMulti（整えてから検査、件数の上限）。
// 縮小そのもの（shrinkImageForPurpose）は偽物: 用途 "album.photo" なら 1/4 の大きさの File を返す。本物は lib/storage/client の単体テスト
// 実行: pnpm test src/lib/mediaInputSuite/components/shrinkBeforeValidation.render.test.tsx
import { after, before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
const g = globalThis as Record<string, unknown>;
for (const key of ["window", "document", "HTMLElement", "HTMLInputElement", "Node", "Event", "MouseEvent", "File", "FileList", "navigator", "getComputedStyle"]) {
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

const uploaded: { name: string; size: number }[] = [];
const shrinkCalls: { name: string; purpose: string }[] = [];
let shrinkGate: Promise<void> | null = null;
let shrinkThrows = false;
mock.module("@/lib/storage/client", {
  namedExports: {
    uploadToStorage: (file: File) => {
      uploaded.push({ name: file.name, size: file.size });
      return { cancel: () => {} };
    },
    shrinkImageForPurpose: async (file: File, purpose: string) => {
      shrinkCalls.push({ name: file.name, purpose });
      if (shrinkGate) await shrinkGate;
      if (shrinkThrows) throw new Error("decode");
      if (purpose !== "album.photo") return file;
      return new dom.window.File([new Uint8Array(Math.floor(file.size / 4))], file.name, { type: file.type });
    },
    isStorageUploadCanceled: () => false,
    pickerAcceptFor: (accept: string | undefined) => accept,
    usePurposeMetadata: () => "strip",
    storageClient: { remove: async () => {} },
    usePrivateMediaRecovery: () => ({ status: "idle", onError: () => {}, src: undefined }),
    withMediaRetryQuery: (src: string) => src,
    MEDIA_RETRY_QUERY: "r",
  },
});

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let MediaInput: typeof import("./MediaInput").MediaInput;
let MediaUploader: typeof import("./MediaUploader").MediaUploader;
let MediaUploaderMulti: typeof import("./MediaUploaderMulti").MediaUploaderMulti;
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  ({ MediaInput } = await import("./MediaInput"));
  ({ MediaUploader } = await import("./MediaUploader"));
  ({ MediaUploaderMulti } = await import("./MediaUploaderMulti"));
});
after(() => dom.window.close());
beforeEach(() => {
  uploaded.length = 0;
  shrinkCalls.length = 0;
  shrinkGate = null;
  shrinkThrows = false;
});

const RULE = { allowedMimeTypes: ["image/jpeg"], maxSizeBytes: 1000 };
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const mount = async (element: ReturnType<typeof createElement>) => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(element));
  return { container, unmount: () => act(async () => root.unmount()) };
};

const jpeg = (name: string, size: number) => new dom.window.File([new Uint8Array(size)], name, { type: "image/jpeg" });

const pick = (container: HTMLElement, files: File[]) =>
  act(async () => {
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, "files", { configurable: true, value: files });
    input.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    await tick();
  });

test("MediaInput: prepareFile が無ければ今までどおり同期で検査する（大きければその場でエラー）", async () => {
  const errors: string[] = [];
  const selected: (File | null)[] = [];
  const { container, unmount } = await mount(
    createElement(MediaInput, { validationRule: RULE, onValidationError: (e) => errors.push(e.type), onFileChange: (f) => selected.push(f) }),
  );
  await pick(container, [jpeg("big.jpg", 4000)]);
  assert.deepEqual(errors, ["size"]);
  assert.deepEqual(selected, []);
  await unmount();
});

test("MediaInput: 整えている間は「画像を準備中…」、整えた物で検査し、後の選択だけを採る", async () => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  const selected: string[] = [];
  const prepareFile = async (file: File) => {
    if (file.name === "first.jpg") await gate;
    return jpeg(`prepared-${file.name}`, 10);
  };
  const { container, unmount } = await mount(
    createElement(MediaInput, { validationRule: RULE, prepareFile, onFileChange: (f) => f && selected.push(f.name) }),
  );
  await pick(container, [jpeg("first.jpg", 4000)]);
  assert.match(container.textContent ?? "", /画像を準備中…/);
  await pick(container, [jpeg("second.jpg", 4000)]);
  await act(async () => {
    release();
    await tick();
  });
  assert.deepEqual(selected, ["prepared-second.jpg"]);
  assert.doesNotMatch(container.textContent ?? "", /画像を準備中…/);
  await unmount();
});

test("MediaUploader: 上限を超える写真を縮めてから検査し、縮んだ物を送る", async () => {
  const errors: string[] = [];
  const { container, unmount } = await mount(
    createElement(MediaUploader, { purpose: "album.photo", validationRule: RULE, onValidationError: (e) => errors.push(e.type) }),
  );
  await pick(container, [jpeg("photo.jpg", 3200)]);
  assert.deepEqual(shrinkCalls, [{ name: "photo.jpg", purpose: "album.photo" }]);
  assert.deepEqual(errors, []);
  assert.deepEqual(uploaded, [{ name: "photo.jpg", size: 800 }]);
  await unmount();
});

test("MediaUploader: 呼び出し側の prepareFile が先、用途の縮小が後（Q2 = a）", async () => {
  const order: string[] = [];
  const prepareFile = async (file: File) => {
    order.push(`caller:${file.name}`);
    return jpeg(`cropped-${file.name}`, file.size);
  };
  const { container, unmount } = await mount(createElement(MediaUploader, { purpose: "album.photo", validationRule: RULE, prepareFile }));
  await pick(container, [jpeg("photo.jpg", 3200)]);
  assert.deepEqual(order, ["caller:photo.jpg"]);
  assert.deepEqual(shrinkCalls, [{ name: "cropped-photo.jpg", purpose: "album.photo" }]);
  assert.deepEqual(uploaded, [{ name: "cropped-photo.jpg", size: 800 }]);
  await unmount();
});

test("MediaUploader: 縮小が投げたら元のまま検査（大きければ検査のエラー、アップロードの失敗にはしない）", async () => {
  shrinkThrows = true;
  const errors: string[] = [];
  const failed: boolean[] = [];
  const warn = console.warn;
  console.warn = () => undefined;
  try {
    const { container, unmount } = await mount(
      createElement(MediaUploader, {
        purpose: "album.photo",
        validationRule: RULE,
        onValidationError: (e) => errors.push(e.type),
        onUploadFailedChange: (f) => failed.push(f),
      }),
    );
    await pick(container, [jpeg("photo.jpg", 3200)]);
    assert.deepEqual(errors, ["size"]);
    assert.deepEqual(uploaded, []);
    assert.deepEqual(failed, []);
    await unmount();
  } finally {
    console.warn = warn;
  }
});

test("MediaUploader: 縮小の指定の無い用途は元のまま（今までどおり）", async () => {
  const { container, unmount } = await mount(createElement(MediaUploader, { purpose: "album.plain", validationRule: RULE }));
  await pick(container, [jpeg("small.jpg", 900)]);
  assert.deepEqual(uploaded, [{ name: "small.jpg", size: 900 }]);
  await unmount();
});

test("MediaUploaderMulti: 整えてから検査し、通った物だけ枠を作る（縮んでも大きい物は検査のエラー）", async () => {
  const errors: string[] = [];
  const { container, unmount } = await mount(
    createElement(MediaUploaderMulti, { purpose: "album.photo", validationRule: RULE, onValidationError: (e) => errors.push(e.type) }),
  );
  await pick(container, [jpeg("a.jpg", 3200), jpeg("huge.jpg", 8000)]);
  assert.deepEqual(shrinkCalls.map((c) => c.name), ["a.jpg", "huge.jpg"]);
  assert.deepEqual(uploaded, [{ name: "a.jpg", size: 800 }]);
  assert.deepEqual(errors, ["size"]);
  await unmount();
});

test("MediaUploaderMulti: 整えている間の分も件数の上限に数える", async () => {
  let release: () => void = () => {};
  shrinkGate = new Promise<void>((resolve) => (release = resolve));
  const errors: string[] = [];
  const { container, unmount } = await mount(
    createElement(MediaUploaderMulti, {
      purpose: "album.photo",
      validationRule: { ...RULE, maxItems: 1 },
      onValidationError: (e) => errors.push(e.message),
    }),
  );
  await pick(container, [jpeg("a.jpg", 3200)]);
  assert.match(container.textContent ?? "", /画像を準備中…/);
  await pick(container, [jpeg("b.jpg", 3200)]);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /上限（1件）/);
  await act(async () => {
    release();
    await tick();
  });
  assert.deepEqual(uploaded, [{ name: "a.jpg", size: 800 }]);
  await unmount();
});
