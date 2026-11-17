// EditProfile の保存の後の行き先 afterSaveHref の検査(jsdom の上で送信する。保存のフック・router・トースト・見出しは偽物で呼び出しを記録)。
// - 省略 / 文字列: 保存に成功すると router.push(href) → refresh、トースト無し。戻る先は afterSaveHref(今のまま)
// - null: push せず refresh と成功のトーストだけ、戻る先の既定は "/mypage/account"(backHref を渡せばそれ)
// - 保存に失敗した時は何もしない
// 実行: pnpm test src/features/core/user/components/EditProfile.render.test.tsx
import { after, before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true });
const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.HTMLElement = dom.window.HTMLElement;
g.Node = dom.window.Node;
g.Element = dom.window.Element;
g.NodeFilter = dom.window.NodeFilter;
g.MutationObserver = dom.window.MutationObserver;
g.Event = dom.window.Event;
g.CustomEvent = dom.window.CustomEvent;
g.FocusEvent = dom.window.FocusEvent;
g.KeyboardEvent = dom.window.KeyboardEvent;
g.MouseEvent = dom.window.MouseEvent;
g.getComputedStyle = dom.window.getComputedStyle;
g.requestAnimationFrame = dom.window.requestAnimationFrame;
g.cancelAnimationFrame = dom.window.cancelAnimationFrame;
g.HTMLFormElement = dom.window.HTMLFormElement;
g.SubmitEvent = dom.window.SubmitEvent;
g.IS_REACT_ACT_ENVIRONMENT = true;

const calls: string[] = [];
let saveResult: unknown = { ok: true };
mock.module("@/lib/unsavedGuard", {
  namedExports: {
    useRouter: () => ({ push: (href: string) => calls.push(`push:${href}`), refresh: () => calls.push("refresh") }),
  },
});
mock.module("@/lib/toast", {
  namedExports: {
    useToast: () => ({ showToast: (message: string, variant: string) => calls.push(`toast:${variant}:${message}`) }),
    // フォームの部品(AppForm)が読む。この検査では使わない
    useLoadingToast: () => {},
  },
});
mock.module("@/features/core/user/hooks/useUpdateMyProfile", {
  namedExports: {
    useUpdateMyProfile: () => ({
      updateProfile: async () => {
        calls.push("save");
        return saveResult;
      },
      isLoading: false,
      error: null,
    }),
  },
});
let headerBackHref: unknown;
mock.module("@/features/core/user/components/common/AccountPageHeader", {
  namedExports: {
    AccountPageHeader: (props: { backHref?: string }) => {
      headerBackHref = props.backHref;
      return null;
    },
  },
});

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let EditProfile: typeof import("./EditProfile").EditProfile;
before(async () => {
  act = (await import("react")).act;
  createRoot = (await import("react-dom/client")).createRoot;
  EditProfile = (await import("./EditProfile")).EditProfile;
});
after(() => dom.window.close());
beforeEach(() => {
  calls.length = 0;
  saveResult = { ok: true };
  headerBackHref = undefined;
});

const user = { id: "u1", name: "たろう", role: "user" } as unknown as Parameters<typeof EditProfile>[0]["user"];

async function submit(props: Record<string, unknown>) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(createElement(EditProfile, { user, ...props })));
  const form = host.querySelector("form")!;
  await act(async () => {
    form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 30));
  });
  await act(async () => root.unmount());
  host.remove();
}

test("省略: 保存の後 /mypage/account へ移り refresh、トースト無し。戻る先も /mypage/account", async () => {
  await submit({});
  assert.deepEqual(calls, ["save", "push:/mypage/account", "refresh"]);
  assert.equal(headerBackHref, "/mypage/account");
});

test("文字列: その住所へ移る。戻る先も同じ(今のまま)", async () => {
  await submit({ afterSaveHref: "/mypage" });
  assert.deepEqual(calls, ["save", "push:/mypage", "refresh"]);
  assert.equal(headerBackHref, "/mypage");
});

test("null: 移らず refresh と成功のトースト。戻る先の既定は /mypage/account、backHref が勝つ", async () => {
  await submit({ afterSaveHref: null });
  assert.deepEqual(calls, ["save", "toast:success:プロフィールを保存しました", "refresh"]);
  assert.equal(headerBackHref, "/mypage/account");
  calls.length = 0;
  await submit({ afterSaveHref: null, backHref: "/mypage/settings" });
  assert.equal(headerBackHref, "/mypage/settings");
});

test("保存に失敗した時は移らず、トーストも refresh も無い", async () => {
  saveResult = null;
  await submit({ afterSaveHref: null });
  assert.deepEqual(calls, ["save"]);
});
