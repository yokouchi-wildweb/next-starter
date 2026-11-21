// src/lib/firebase/server/authAdmin.ts
// Firebase Admin Auth ユーザー管理メソッド

import type { UserRecord } from "firebase-admin/auth";

import { hasFirebaseErrorCode } from "../errors";
import { getServerAuth } from "./app";

/**
 * Firebase Auth ユーザー情報を取得
 * @param uid Firebase Auth の UID（providerUid）
 * @returns ユーザーレコード、存在しない場合は null
 */
export async function getAuthUser(uid: string): Promise<UserRecord | null> {
  const auth = getServerAuth();
  try {
    return await auth.getUser(uid);
  } catch (error) {
    if (hasFirebaseErrorCode(error, "auth/user-not-found")) {
      return null;
    }
    throw error;
  }
}

/**
 * Firebase Auth ユーザーを削除
 * ハードデリート時に使用
 * @param uid Firebase Auth の UID（providerUid）
 */
export async function deleteAuthUser(uid: string): Promise<void> {
  const auth = getServerAuth();
  try {
    await auth.deleteUser(uid);
  } catch (error) {
    if (hasFirebaseErrorCode(error, "auth/user-not-found")) {
      console.warn(`Firebase Auth user already removed for uid: ${uid}`);
      return;
    }
    throw error;
  }
}

/**
 * Firebase Auth ユーザーを無効化
 * security_locked, banned 時に使用
 * @param uid Firebase Auth の UID（providerUid）
 */
export async function disableAuthUser(uid: string): Promise<void> {
  const auth = getServerAuth();
  try {
    await auth.updateUser(uid, { disabled: true });
  } catch (error) {
    if (hasFirebaseErrorCode(error, "auth/user-not-found")) {
      console.warn(`Firebase Auth user not found for uid: ${uid}`);
      return;
    }
    throw error;
  }
}

/**
 * Firebase Auth ユーザーを有効化
 * ロック解除、BAN解除時に使用
 * @param uid Firebase Auth の UID（providerUid）
 */
export async function enableAuthUser(uid: string): Promise<void> {
  const auth = getServerAuth();
  try {
    await auth.updateUser(uid, { disabled: false });
  } catch (error) {
    if (hasFirebaseErrorCode(error, "auth/user-not-found")) {
      console.warn(`Firebase Auth user not found for uid: ${uid}`);
      return;
    }
    throw error;
  }
}

/**
 * Firebase Auth のリフレッシュトークンを無効化（強制ログアウト）
 * security_locked, banned 時に使用
 * @param uid Firebase Auth の UID（providerUid）
 */
export async function revokeAuthTokens(uid: string): Promise<void> {
  const auth = getServerAuth();
  try {
    await auth.revokeRefreshTokens(uid);
  } catch (error) {
    if (hasFirebaseErrorCode(error, "auth/user-not-found")) {
      console.warn(`Firebase Auth user not found for uid: ${uid}`);
      return;
    }
    throw error;
  }
}
