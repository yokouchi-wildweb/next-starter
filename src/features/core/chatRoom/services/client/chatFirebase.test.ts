// src/features/core/chatRoom/services/client/chatFirebase.test.ts
//
// chatRoom 専用の Firebase アプリのサインインの検査（Firebase 不要）。
// - サインインしていない・uid が違うとき、カスタムトークンでサインインし直す。同時に呼ばれたら 1 回にまとめる
// - サインインした uid が期待と違えば投げる
// - 購読はサインインの後に始まり、その前に解除されたら始まらない。失敗は onError に渡る
// (package.json に type: module が無いので tsx は CJS として読む → before() で import)
import { before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const fakeAuth: { currentUser: { uid: string } | null } = { currentUser: null };
let tokenFetches = 0;
let signInUid = "user-1";
const appNames: string[] = [];

mock.module(pathToFileURL(require.resolve("firebase/app")).href, {
  namedExports: {
    getApps: () => appNames.map((name) => ({ name })),
    getApp: (name: string) => ({ name }),
    initializeApp: (_options: unknown, name: string) => {
      appNames.push(name);
      return { name };
    },
  },
});
mock.module(pathToFileURL(require.resolve("firebase/auth")).href, {
  namedExports: {
    getAuth: () => fakeAuth,
    inMemoryPersistence: {},
    initializeAuth: () => fakeAuth,
    signInWithCustomToken: async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      fakeAuth.currentUser = { uid: signInUid };
    },
  },
});
mock.module(pathToFileURL(require.resolve("firebase/firestore")).href, {
  namedExports: { getFirestore: (app: { name: string }) => ({ app }) },
});
mock.module("@/lib/firebase/client/app", {
  namedExports: { app: { options: {} }, isFirebaseClientConfigured: () => true },
});
mock.module("@/features/core/auth/services/client/firebaseToken", {
  namedExports: {
    fetchFirebaseCustomToken: async () => {
      tokenFetches += 1;
      return "custom-token";
    },
  },
});

let chat: typeof import("./chatFirebase");
before(async () => {
  chat = await import("./chatFirebase");
});

beforeEach(() => {
  fakeAuth.currentUser = null;
  tokenFetches = 0;
  signInUid = "user-1";
});

const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

test("Firestore は chatRoom という名前の別のアプリのもの", () => {
  const firestore = chat.getChatFirestore() as unknown as { app: { name: string } };
  assert.equal(firestore.app.name, "chatRoom");
});

test("サインインしていなければカスタムトークンでサインインし、同時の呼び出しは 1 回にまとめる", async () => {
  await Promise.all([chat.ensureChatAuth("user-1"), chat.ensureChatAuth("user-1"), chat.ensureChatAuth()]);
  assert.equal(tokenFetches, 1);
  assert.equal(fakeAuth.currentUser?.uid, "user-1");
  await chat.ensureChatAuth("user-1");
  assert.equal(tokenFetches, 1);
});

test("サインイン済みの uid が期待と違えばサインインし直す", async () => {
  fakeAuth.currentUser = { uid: "provider-uid" };
  await chat.ensureChatAuth("user-1");
  assert.equal(tokenFetches, 1);
  assert.equal(fakeAuth.currentUser?.uid, "user-1");
});

test("サインインした uid が期待と違えば投げる", async () => {
  signInUid = "someone-else";
  await assert.rejects(() => chat.ensureChatAuth("user-1"), /一致しません/);
});

test("購読はサインインの後に始まる", async () => {
  let started = 0;
  let stopped = 0;
  const off = chat.subscribeAfterChatAuth(() => {
    started += 1;
    return () => void (stopped += 1);
  });
  assert.equal(started, 0);
  await tick();
  assert.equal(started, 1);
  off();
  assert.equal(stopped, 1);
});

test("サインインの前に解除されたら購読を始めない", async () => {
  let started = 0;
  const off = chat.subscribeAfterChatAuth(() => {
    started += 1;
    return () => {};
  });
  off();
  await tick();
  assert.equal(started, 0);
});

test("サインインに失敗したら onError に渡す", async () => {
  signInUid = "someone-else";
  const errors: Error[] = [];
  chat.subscribeAfterChatAuth(() => () => {}, (error) => errors.push(error), "user-1");
  await tick();
  assert.equal(errors.length, 1);
});
