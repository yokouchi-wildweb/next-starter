// useAdminLogin の Firebase の扱いの検査(jsdom の上でフックを動かす。HTTP・Firebase は偽物)。
// - サーバーがトークンを出さない(null)・クライアントの Firebase が未設定: signInWithCustomToken を呼ばず、ログインは進む
// - 両方そろう: 今まで通り Firebase Auth にもサインインする
// - signInWithCustomToken が呼んだ時点で投げても、ログインは進む
// 実行: pnpm test:local-login
// (package.json に type: module が無いので tsx は CJS として読む = top-level await 不可 → before() で import)
import { after, before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { createElement, useEffect } from "react";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.HTMLElement = dom.window.HTMLElement;
g.Node = dom.window.Node;
g.IS_REACT_ACT_ENVIRONMENT = true;

let clientConfigured = true;
let serverToken: string | null = "custom-token";
let signInThrows = false;
const signIns: string[] = [];
const pushed: string[] = [];

mock.module(pathToFileURL(require.resolve("firebase/auth")).href, {
  namedExports: {
    signInWithCustomToken: (_auth: unknown, token: string) => {
      if (signInThrows) throw new Error("auth/invalid-api-key");
      signIns.push(token);
      return Promise.resolve();
    },
  },
});
mock.module("@/lib/firebase/client/app", {
  namedExports: { auth: {}, isFirebaseClientConfigured: () => clientConfigured },
});
mock.module("@/features/core/auth/services/client/localLogin", {
  namedExports: {
    localLogin: async () => ({ user: { userId: "u1" }, session: { expiresAt: "" }, requiresReactivation: false, firebaseCustomToken: serverToken }),
  },
});
mock.module("@/features/core/auth/hooks/useAuthSession", {
  namedExports: { useAuthSession: () => ({ refreshSession: async () => {} }) },
});
mock.module("@/lib/unsavedGuard", {
  namedExports: { useRouter: () => ({ push: (path: string) => pushed.push(path) }) },
});

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let useAdminLogin: typeof import("./useAdminLogin").useAdminLogin;
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  ({ useAdminLogin } = await import("./useAdminLogin"));
});
after(() => dom.window.close());
beforeEach(() => {
  clientConfigured = true;
  serverToken = "custom-token";
  signInThrows = false;
  signIns.length = 0;
  pushed.length = 0;
});

/** フックを描き、signIn を 1 回呼んで、エラーの表示を返す */
const login = async () => {
  const latest: { signIn?: ReturnType<typeof useAdminLogin>["signIn"]; error?: string | null } = {};
  const report = (signIn: ReturnType<typeof useAdminLogin>["signIn"], error: string | null) => {
    latest.signIn = signIn;
    latest.error = error;
  };
  const Probe = () => {
    const { signIn, errorMessage } = useAdminLogin();
    useEffect(() => report(signIn, errorMessage), [signIn, errorMessage]);
    return null;
  };
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(createElement(Probe)));
  await act(async () => latest.signIn?.({ email: "a@example.test", password: "pw" }));
  await act(async () => root.unmount());
  return latest.error ?? null;
};

test("サーバーがトークンを出さない(Firebase のサーバー側が未設定): Firebase に触れずにログインを進める", async () => {
  serverToken = null;
  assert.equal(await login(), null);
  assert.deepEqual(signIns, []);
  assert.deepEqual(pushed, ["/admin"]);
});

test("クライアントの Firebase が未設定: トークンがあっても Firebase に触れない", async () => {
  clientConfigured = false;
  assert.equal(await login(), null);
  assert.deepEqual(signIns, []);
  assert.deepEqual(pushed, ["/admin"]);
});

test("両方そろう: 今まで通り Firebase Auth にもサインインする", async () => {
  assert.equal(await login(), null);
  assert.deepEqual(signIns, ["custom-token"]);
  assert.deepEqual(pushed, ["/admin"]);
});

test("signInWithCustomToken が呼んだ時点で投げても、ログインは進む", async () => {
  signInThrows = true;
  assert.equal(await login(), null);
  assert.deepEqual(pushed, ["/admin"]);
});
