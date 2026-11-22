// AccountAvatarSection の検査: アップロードと保存が 1 つの操作なので、失敗したら保存を呼ばない(古い値で黙って保存しない)、
// 欄にエラーを出し、選び直して成功すれば保存して消える。実行: pnpm test src/domains/core/user/components/common/AccountAvatarSection.test.tsx
// (tsx + node:test のモジュールモック + jsdom。type: module が無いので tsx は CJS = top-level await 不可 → before() で import)
import { after, before, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
// Element 以下は浮く物(ActionPopover = Radix の Popover)が開く時に使う物
for (const key of ["window", "document", "HTMLElement", "HTMLInputElement", "Node", "Event", "MouseEvent", "File", "navigator", "getComputedStyle", "Element", "NodeFilter", "MutationObserver", "CustomEvent", "FocusEvent", "KeyboardEvent"]) {
  // navigator は Node の組み込み(getter だけ)なので defineProperty で差し替える
  const value = key === "window" ? dom.window : (dom.window as unknown as Record<string, unknown>)[key];
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
}
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
// ResizeObserver(浮く物の位置の計算)は jsdom に無いので空の物を置く
(globalThis as Record<string, unknown>).ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// アップロードの結果を手で決める: 呼ばれるたびに次の結果(true = 成功)を使う
const outcomes: boolean[] = [];
let uploads = 0;
const saved: Array<{ avatarUrl: string | null }> = [];
mock.module("@/domains/core/user/hooks/useAvatarUpload", {
  namedExports: {
    AVATAR_STORAGE_PURPOSE: "user.avatar",
    useAvatarUpload: () => ({
      upload: async () => {
        uploads += 1;
        if (!(outcomes.shift() ?? true)) throw new Error("アップロードに失敗しました(テスト)");
        return { ref: `storage://user.avatar/${uploads}`, objectId: `o${uploads}`, src: "" };
      },
      discard: async () => {},
    }),
  },
});
mock.module("@/domains/core/user/hooks/useUpdateMyProfile", {
  namedExports: {
    useUpdateMyProfile: () => ({
      updateProfile: async (input: { name: string; avatarUrl: string | null }) => {
        saved.push({ avatarUrl: input.avatarUrl });
        return { id: "u1", name: input.name, avatarUrl: input.avatarUrl };
      },
      isLoading: false,
      error: null,
      reset: () => {},
    }),
  },
});
// 保存後のアバター表示(AppImage)は next/image を通るので、素の img に置き換える
mock.module("@/components/Media/AppImage", {
  namedExports: { AppImage: ({ src, alt }: { src: string; alt: string }) => createElement("img", { src, alt }) },
});

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let AccountAvatarSection: typeof import("./AccountAvatarSection").AccountAvatarSection;
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  ({ AccountAvatarSection } = await import("./AccountAvatarSection"));
});
after(() => dom.window.close());

const pick = (container: HTMLElement) =>
  act(async () => {
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new dom.window.File(["x"], "me.png", { type: "image/png" });
    Object.defineProperty(input, "files", { configurable: true, value: [file] });
    input.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

test("失敗したら保存を呼ばずエラーを出す → 選び直して成功すれば保存してエラーが消える", async () => {
  outcomes.push(false, true);
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const user = { id: "u1", name: "太郎", avatarUrl: null } as unknown as Parameters<typeof AccountAvatarSection>[0]["user"];
  await act(async () => root.render(createElement(AccountAvatarSection, { user })));

  await pick(container);
  assert.equal(uploads, 1);
  assert.deepEqual(saved, [], "失敗したら保存しない");
  assert.match(container.textContent ?? "", /アップロードに失敗しました\(テスト\)/, "欄にエラーが出る");

  await pick(container);
  assert.deepEqual(saved, [{ avatarUrl: "storage://user.avatar/2" }], "成功した画像で保存する");
  assert.doesNotMatch(container.textContent ?? "", /アップロードに失敗しました/, "やり直しでエラーが消える");
  await act(async () => root.unmount());
});

// 丸を押した時の分かれ道(メニュー = ActionPopover、body へ portal する浮く物)
const mount = async (avatarUrl: string | null) => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const user = { id: "u1", name: "太郎", avatarUrl } as unknown as Parameters<typeof AccountAvatarSection>[0]["user"];
  await act(async () => root.render(createElement(AccountAvatarSection, { user })));
  const trigger = container.querySelector('button[aria-label="アバター画像を変更"]') as HTMLButtonElement;
  const press = (el: Element) => act(async () => void el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })));
  const menuItem = (label: string) => [...document.body.querySelectorAll("button")].find((b) => b.textContent?.trim() === label);
  return { container, root, trigger, press, menuItem };
};

test("画像あり: 丸を押すとメニュー(画像を変更・画像を削除)、画像を変更でファイル選択を開いてメニューが閉じる", async () => {
  const clicks = mock.method(dom.window.HTMLInputElement.prototype, "click", () => {});
  const { root, trigger, press, menuItem } = await mount("https://example.test/a.png");
  assert.equal(menuItem("画像を変更"), undefined);
  await press(trigger);
  assert.ok(menuItem("画像を変更"));
  assert.ok(menuItem("画像を削除"));
  await press(menuItem("画像を変更") as HTMLButtonElement);
  assert.equal(clicks.mock.callCount(), 1);
  assert.equal(menuItem("画像を変更"), undefined);
  clicks.mock.restore();
  await act(async () => root.unmount());
});

test("画像なし: 丸を押すとメニューを出さずにファイル選択を開く", async () => {
  const clicks = mock.method(dom.window.HTMLInputElement.prototype, "click", () => {});
  const { root, trigger, press, menuItem } = await mount(null);
  await press(trigger);
  assert.equal(menuItem("画像を変更"), undefined);
  assert.equal(clicks.mock.callCount(), 1);
  clicks.mock.restore();
  await act(async () => root.unmount());
});
