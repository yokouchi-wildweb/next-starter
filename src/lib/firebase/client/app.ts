// src/lib/firebase/client/app.ts

import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import {
  type Firestore,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";

import { firebaseConfig } from "../config";
import { FirebaseNotConfiguredError } from "../errors";
import { firebaseClientOptions, isClientConfigComplete } from "./options";

/**
 * クライアント側 Firebase が設定済み（API key と projectId が非空）かどうか。
 *
 * `pnpm ops setup env` 直後は NEXT_PUBLIC_FIREBASE_* が全て空で、その状態でも dev サーバーが
 * 起動しトップページが表示できることを手順書で約束している。root layout に常時マウントされる
 * 経路（useFirebaseAuthSync / analytics）はこの判定で Firebase への接触をスキップする。
 *
 * 値は上書き src/config/lib/firebase.config.ts の NEXT_PUBLIC_* から(ビルド時に埋め込まれる)。
 */
export const isFirebaseClientConfigured = (): boolean => isClientConfigComplete(firebaseConfig);

// Initialize Firebase (client side)
// initializeApp は設定が空でも throw しない（遅延評価）。
// getAuth は apiKey が空だと同期的に auth/invalid-api-key を投げ、Firestore は空の projectId のまま
// 接続を試みるため、未設定時はどちらも初期化せず、触れた時点で投げる代替を置く。
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseClientOptions(firebaseConfig));

/**
 * 未設定時の `auth` / `fstore` 代替。どのプロパティに触れても FirebaseNotConfiguredError を投げる。
 * named export の形状（`import { auth, fstore }`）を維持したまま、使用時点で fail-fast にする。
 * `collection(fstore, …)` などの SDK 関数も内部でプロパティに触れるので、接続を待たずに同じエラーになる。
 * 常時マウントされる消費者は isFirebaseClientConfigured() で事前にスキップすること。
 */
function createUnconfiguredClient<T extends object>(): T {
  return new Proxy({} as T, {
    get(_target, prop) {
      // `await auth` / ログ出力などで暗黙に参照されるキーだけは素通しする
      if (prop === "then" || typeof prop === "symbol") return undefined;
      throw new FirebaseNotConfiguredError("client");
    },
  });
}

/**
 * クライアント側 Firestore を初期化する。
 * initializeFirestore は同一アプリに対して1回しか呼べない。
 * 開発時のホットリロードでモジュールが再評価された場合は getFirestore にフォールバックする。
 */
function initClientFirestore(): Firestore {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch {
    return getFirestore(app);
  }
}

const configured = isFirebaseClientConfigured();
const auth: Auth = configured ? getAuth(app) : createUnconfiguredClient<Auth>();
const fstore: Firestore = configured ? initClientFirestore() : createUnconfiguredClient<Firestore>();

export { app, auth, fstore };
