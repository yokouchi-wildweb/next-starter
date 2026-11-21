// src/lib/firebase/server/app.ts

import { cert, getApps, initializeApp } from "firebase-admin/app";
import type { AppOptions } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

import { firebaseConfig } from "../config";
import { FirebaseNotConfiguredError } from "../errors";
import { normalizeJsonString } from "../serviceAccountKey";
import { firebaseAdminOptions, readServiceAccountKey } from "./options";

/**
 * サーバー側 Firebase Admin が設定済み（サービスアカウントの鍵 = 上書きの serviceAccountKey() が非空）かどうか。
 *
 * `pnpm ops setup env` 直後は空で、その状態でも dev サーバーが起動することを手順書で約束している。
 * Firebase Admin を要する処理に未設定で到達すると FirebaseNotConfiguredError("server") が
 * 即座に投げられる（遅延初期化のため import だけでは失敗しない）。
 * 判定は「未設定」のみ。設定済みで初期化に失敗した場合は従来どおり理由付きの Error になる。
 */
export const isFirebaseServerConfigured = (): boolean => readServiceAccountKey(firebaseConfig).length > 0;

/** 未設定エラーは各層の「理由付き再 throw」で包まず、型を保ったまま素通しする */
function rethrowIfNotConfigured(error: unknown): void {
  if (error instanceof FirebaseNotConfiguredError) throw error;
}

function loadRawServiceAccountKey(): string {
  const key = readServiceAccountKey(firebaseConfig);
  if (!key) {
    throw new FirebaseNotConfiguredError("server");
  }
  return key;
}

function createCredential() {
  const serviceAccount = loadRawServiceAccountKey();
  let parsedServiceAccount: Record<string, unknown>;

  try {
    parsedServiceAccount = JSON.parse(normalizeJsonString(serviceAccount));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Firebase のサービスアカウント情報の解析に失敗しました。` +
        `MY_SERVICE_ACCOUNT_KEY の値: ${serviceAccount}。理由: ${reason}`,
    );
  }

  try {
    return cert(parsedServiceAccount);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Firebase のサービスアカウント証明書の作成に失敗しました。` +
        `MY_SERVICE_ACCOUNT_KEY の値: ${serviceAccount}。理由: ${reason}`,
    );
  }
}

const ADMIN_APP_NAME = "myapp";

function ensureServerApp() {
  const existingApp = getApps().find((app) => app.name === ADMIN_APP_NAME);
  if (existingApp) return existingApp;

  let credential: AppOptions["credential"];
  try {
    credential = createCredential();
  } catch (error) {
    rethrowIfNotConfigured(error);
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Firebase Admin アプリの認証情報の準備に失敗しました。理由: ${reason}`,
    );
  }
  const options: AppOptions = {
    credential,
    ...firebaseAdminOptions(firebaseConfig),
  };

  try {
    return initializeApp(options, ADMIN_APP_NAME);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const serializedOptions = {
      projectId: options.projectId,
      storageBucket: options.storageBucket,
      credentialSource: "environmentVariable",
    };

    throw new Error(
      `Firebase Admin アプリの初期化に失敗しました。設定内容: ${JSON.stringify(
        serializedOptions,
      )}。理由: ${reason}`,
    );
  }
}

/** Firebase Admin アプリを取得（未初期化なら初期化） */
export function getServerApp() {
  try {
    const app = ensureServerApp();
    if (!app) {
      throw new Error("ensureServerApp() がアプリのインスタンスを返しませんでした。");
    }
    return app;
  } catch (error) {
    rethrowIfNotConfigured(error);
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Firebase Admin アプリの取得に失敗しました。理由: ${reason}`);
  }
}

export function getServerAuth() {
  try {
    const app = getServerApp();
    return getAuth(app);
  } catch (error) {
    rethrowIfNotConfigured(error);
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Firebase Admin Auth の取得に失敗しました。理由: ${reason}`);
  }
}

export function getServerFirestore() {
  try {
    const app = getServerApp();
    const firestore = getFirestore(app);
    if (!firestore) {
      throw new Error("Firestore インスタンスが未定義です。");
    }
    return firestore;
  } catch (error) {
    rethrowIfNotConfigured(error);
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Firebase Firestore の取得に失敗しました。理由: ${reason}`);
  }
}

export function getServerStorage() {
  try {
    const app = getServerApp();
    const storage = getStorage(app);
    if (!storage) {
      throw new Error("Storage インスタンスが未定義です。");
    }
    return storage;
  } catch (error) {
    rethrowIfNotConfigured(error);
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Firebase Storage の取得に失敗しました。理由: ${reason}`);
  }
}
