// src/lib/firebase/client/app.ts

import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

import { FirebaseNotConfiguredError } from "../errors";

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || undefined,
};

/**
 * クライアント側 Firebase が設定済み（API key と projectId が非空）かどうか。
 *
 * `pnpm env:init` 直後は NEXT_PUBLIC_FIREBASE_* が全て空で、その状態でも dev サーバーが
 * 起動しトップページが表示できることを手順書で約束している。root layout に常時マウントされる
 * 経路（useFirebaseAuthSync / analytics）はこの判定で Firebase への接触をスキップする。
 *
 * NEXT_PUBLIC_* はビルド時にインライン展開されるため、process.env を直接参照すること。
 */
export const isFirebaseClientConfigured = (): boolean =>
  (process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "").trim().length > 0 &&
  (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "").trim().length > 0;

// Initialize Firebase (client side)
// initializeApp / initializeFirestore / getStorage は設定が空でも throw しない（遅延評価）。
// getAuth だけは apiKey が空だと同期的に auth/invalid-api-key を投げるため、未設定時は呼ばない。
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

/**
 * 未設定時の `auth` 代替。どのプロパティに触れても FirebaseNotConfiguredError を投げる。
 * named export の形状（`import { auth }`）を維持したまま、使用時点で fail-fast にする。
 * 常時マウントされる消費者は isFirebaseClientConfigured() で事前にスキップすること。
 */
function createUnconfiguredAuth(): Auth {
  return new Proxy({} as Auth, {
    get(_target, prop) {
      // `await auth` / ログ出力などで暗黙に参照されるキーだけは素通しする
      if (prop === "then" || typeof prop === "symbol") return undefined;
      throw new FirebaseNotConfiguredError("client");
    },
  });
}

const auth: Auth = isFirebaseClientConfigured() ? getAuth(app) : createUnconfiguredAuth();
// initializeFirestore は同一アプリに対して1回しか呼べない。
// 開発時のホットリロードでモジュールが再評価された場合は getFirestore にフォールバックする。
let fstore: ReturnType<typeof getFirestore>;
try {
  fstore = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });
} catch {
  fstore = getFirestore(app);
}
const storage = getStorage(app);

export { app, auth, fstore, storage };
