// AccountAvatarSection のアバター未設定の時の中身(children)の検査(jsdom。アップロード・保存のフックと AppImage は偽物)。
// - children を渡さない時: アバターあり / なし / size の出力が記録した出力(__fixtures__/accountAvatarSection.before.json。包みの部品に替えた時に取り直した)と同じ
// - children を渡すと未設定の時に丸の箱(size × size)の中に既定の人の形の代わりに出て、アバターがある時は出ない
// 実行: pnpm test src/domains/core/user/components/common/AccountAvatarSection.render.test.tsx
import { readFileSync } from "node:fs";
import { after, before, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
for (const key of [
  "window",
  "document",
  "HTMLElement",
  "HTMLInputElement",
  "Node",
  "Event",
  "MouseEvent",
  "File",
  "navigator",
  "getComputedStyle",
]) {
  // navigator は Node の組み込み(getter だけ)なので defineProperty で差し替える
  const value = key === "window" ? dom.window : (dom.window as unknown as Record<string, unknown>)[key];
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
}
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

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

async function snap(props: Record<string, unknown>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(createElement(AccountAvatarSection, props as Parameters<typeof AccountAvatarSection>[0])),
  );
  const html = container.innerHTML;
  await act(async () => root.unmount());
  container.remove();
  return html;
}
const userWithout = { id: "u1", name: "太郎", avatarUrl: null } as unknown as Parameters<
  typeof AccountAvatarSection
>[0]["user"];
const userWith = { id: "u1", name: "太郎", avatarUrl: "https://example.test/a.png" } as unknown as Parameters<
  typeof AccountAvatarSection
>[0]["user"];

const BEFORE = JSON.parse(
  readFileSync(new URL("./__fixtures__/accountAvatarSection.before.json", import.meta.url), "utf8"),
) as Record<string, string>;

test("children なし: アバターあり / なし / size の出力が前と同じ", async () => {
  assert.equal(await snap({ user: userWithout }), BEFORE.without);
  assert.equal(await snap({ user: userWith }), BEFORE.with);
  assert.equal(await snap({ user: userWithout, size: 48 }), BEFORE.sized);
});

test("children は未設定の時だけ丸の箱の中に出て、既定の人の形の代わりになる", async () => {
  const initial = createElement("b", { id: "initial" }, "太");
  const html = await snap({ user: userWithout, size: 48, children: initial });
  assert.match(
    html,
    /<span data-component="InBlock" style="width: 48px; height: 48px;" class="flex items-center justify-center rounded-full bg-primary\/10"><b id="initial">太<\/b><\/span>/,
  );
  assert.doesNotMatch(html, /lucide-user/);
  const withAvatar = await snap({ user: userWith, children: initial });
  assert.doesNotMatch(withAvatar, /id="initial"/);
  assert.equal(withAvatar, BEFORE.with);
});
