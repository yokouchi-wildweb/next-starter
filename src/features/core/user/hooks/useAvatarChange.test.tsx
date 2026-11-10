// useAvatarChange の検査(jsdom の上でフックを動かす。アップロードと保存は偽物):
// 成功・型の拒否・サイズの拒否・アップロードの失敗(保存しない)・保存の失敗(取り消す)・削除・鍵(処理中の 2 回目は何もしない)・clearError
// 実行: pnpm test src/features/core/user/hooks/useAvatarChange.test.tsx
// (tsx + node:test のモジュールモック + jsdom。type: module が無いので tsx は CJS = top-level await 不可 → before() で import)
import { after, before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { JSDOM } from "jsdom";

import type { User } from "@/features/core/user/entities";

import type { UseAvatarChangeReturn } from "./useAvatarChange";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.HTMLElement = dom.window.HTMLElement;
g.Node = dom.window.Node;
g.IS_REACT_ACT_ENVIRONMENT = true;

// 偽物の振る舞い(テストごとに beforeEach で戻す)
let uploadFails = false;
let saveFails = false;
let holdUpload: Promise<void> | null = null;
let uploads = 0;
const saved: Array<string | null> = [];
const discarded: string[] = [];
let resets = 0;

mock.module("@/features/core/user/hooks/useAvatarUpload", {
  namedExports: {
    AVATAR_STORAGE_PURPOSE: "user.avatar",
    useAvatarUpload: () => ({
      upload: async () => {
        uploads += 1;
        const n = uploads;
        if (holdUpload) await holdUpload;
        if (uploadFails) throw new Error("アップロードに失敗しました(テスト)");
        return { ref: `storage://user.avatar/${n}`, objectId: `o${n}`, src: "" };
      },
      discard: async (objectId: string) => {
        discarded.push(objectId);
      },
    }),
  },
});
// 保存の失敗の文言は本物と同じく hook の state に入れる
mock.module("@/features/core/user/hooks/useUpdateMyProfile", {
  namedExports: {
    useUpdateMyProfile: () => {
      const { useState, useCallback } = require("react") as typeof import("react");
      const [error, setError] = useState<string | null>(null);
      const updateProfile = useCallback(async (input: { name: string; avatarUrl: string | null }) => {
        saved.push(input.avatarUrl);
        if (saveFails) {
          setError("保存に失敗しました(テスト)");
          return null;
        }
        setError(null);
        return { id: "u1", name: input.name, avatarUrl: input.avatarUrl };
      }, []);
      const reset = useCallback(() => {
        resets += 1;
        setError(null);
      }, []);
      return { updateProfile, isLoading: false, error, reset };
    },
  },
});

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let useAvatarChange: typeof import("./useAvatarChange").useAvatarChange;
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  ({ useAvatarChange } = await import("./useAvatarChange"));
});
after(() => dom.window.close());
beforeEach(() => {
  uploadFails = false;
  saveFails = false;
  holdUpload = null;
  uploads = 0;
  saved.length = 0;
  discarded.length = 0;
  resets = 0;
});

const baseUser = { id: "u1", name: "太郎", avatarUrl: null } as unknown as User;
const png = (size = 10) => new dom.window.File(["x".repeat(size)], "me.png", { type: "image/png" }) as unknown as File;

/** フックを描いて、最新の戻り値と onAvatarUpdated の呼び出しを返す */
async function mount(user: User = baseUser, maxFileSize?: number) {
  let latest: UseAvatarChangeReturn | null = null;
  const report = (value: UseAvatarChangeReturn) => {
    latest = value;
  };
  const updated: User[] = [];
  function Probe() {
    report(useAvatarChange({ user, maxFileSize, onAvatarUpdated: (u) => updated.push(u) }));
    return null;
  }
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(createElement(Probe)));
  const hook = () => latest as unknown as UseAvatarChangeReturn;
  return { hook, updated, unmount: () => act(async () => root.unmount()) };
}

test("成功: アップロードした ref を保存し、avatarUrl と onAvatarUpdated に反映して true", async () => {
  const { hook, updated, unmount } = await mount();
  let ok = false;
  await act(async () => {
    ok = await hook().change(png());
  });
  assert.equal(ok, true);
  assert.deepEqual(saved, ["storage://user.avatar/1"]);
  assert.equal(hook().avatarUrl, "storage://user.avatar/1");
  assert.equal(updated.length, 1);
  assert.equal(hook().error, null);
  assert.equal(hook().isBusy, false);
  await unmount();
});

test("型の拒否: アップロードせずに文言、validate は状態を変えずに同じ文言", async () => {
  const { hook, unmount } = await mount();
  const gif = new dom.window.File(["x"], "a.txt", { type: "text/plain" }) as unknown as File;
  assert.equal(hook().validate(gif), "対応していないファイル形式です");
  assert.equal(hook().error, null);
  let ok = true;
  await act(async () => {
    ok = await hook().change(gif);
  });
  assert.equal(ok, false);
  assert.equal(uploads, 0);
  assert.equal(hook().error, "対応していないファイル形式です");
  await unmount();
});

test("サイズの拒否: 上限を超えるとアップロードせずに文言", async () => {
  const { hook, unmount } = await mount(baseUser, 2 * 1024 * 1024);
  const big = png(3 * 1024 * 1024);
  let ok = true;
  await act(async () => {
    ok = await hook().change(big);
  });
  assert.equal(ok, false);
  assert.equal(uploads, 0);
  assert.equal(hook().error, "ファイルサイズは2MB以下にしてください");
  assert.equal(hook().maxFileSize, 2 * 1024 * 1024);
  await unmount();
});

test("アップロードの失敗: 保存を呼ばず、エラーの文言を出す", async () => {
  uploadFails = true;
  const { hook, unmount } = await mount();
  let ok = true;
  await act(async () => {
    ok = await hook().change(png());
  });
  assert.equal(ok, false);
  assert.deepEqual(saved, []);
  assert.equal(hook().error, "アップロードに失敗しました(テスト)");
  assert.equal(hook().avatarUrl, null);
  await unmount();
});

test("保存の失敗: アップロードしたファイルを取り消し、保存の文言を出す", async () => {
  saveFails = true;
  const { hook, updated, unmount } = await mount();
  let ok = true;
  await act(async () => {
    ok = await hook().change(png());
  });
  assert.equal(ok, false);
  assert.deepEqual(discarded, ["o1"]);
  assert.equal(hook().error, "保存に失敗しました(テスト)");
  assert.equal(hook().avatarUrl, null);
  assert.equal(updated.length, 0);
  await unmount();
});

test("削除: avatarUrl を null で保存し、avatarUrl が null になる", async () => {
  const { hook, updated, unmount } = await mount({ ...baseUser, avatarUrl: "storage://user.avatar/old" } as User);
  assert.equal(hook().avatarUrl, "storage://user.avatar/old");
  let ok = false;
  await act(async () => {
    ok = await hook().remove();
  });
  assert.equal(ok, true);
  assert.deepEqual(saved, [null]);
  assert.equal(hook().avatarUrl, null);
  assert.equal(updated.length, 1);
  await unmount();
});

test("鍵: 変更の途中の 2 回目の変更・削除は何もせず false", async () => {
  let release: () => void = () => {};
  holdUpload = new Promise<void>((resolve) => {
    release = resolve;
  });
  const { hook, unmount } = await mount();
  let first: Promise<boolean> = Promise.resolve(false);
  await act(async () => {
    first = hook().change(png());
  });
  assert.equal(hook().isUploading, true);
  assert.equal(hook().isBusy, true);
  let second = true;
  let removed = true;
  await act(async () => {
    second = await hook().change(png());
    removed = await hook().remove();
  });
  assert.equal(second, false);
  assert.equal(removed, false);
  release();
  let ok = false;
  await act(async () => {
    ok = await first;
  });
  assert.equal(ok, true);
  assert.equal(uploads, 1);
  assert.deepEqual(saved, ["storage://user.avatar/1"]);
  assert.equal(hook().isBusy, false);
  await unmount();
});

test("clearError: 検査の文言も保存の文言も消す", async () => {
  saveFails = true;
  const { hook, unmount } = await mount();
  await act(async () => {
    await hook().change(png());
  });
  assert.equal(hook().error, "保存に失敗しました(テスト)");
  await act(async () => hook().clearError());
  assert.equal(hook().error, null);
  assert.ok(resets > 0);
  await unmount();
});
