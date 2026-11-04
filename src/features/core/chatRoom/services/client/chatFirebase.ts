// src/features/core/chatRoom/services/client/chatFirebase.ts
//
// chatRoom 専用の Firebase アプリ（名前 "chatRoom"）。chatRoom のクライアントの内側だけで使う（index から export しない）。
//
// なぜ別のアプリか:
//   参加者・送信者・readAt のキーは users.id で、Firestore のルールは request.auth.uid == users.id を前提にする
//   （chatRoom/firestore.rules.example）。既定のアプリはメール+パスワード・OAuth でログインするとプロバイダーの uid の
//   ままになり、chatRoom の読み書きがすべて拒否される。既定のアプリ（ログイン・電話番号の紐づけ・パスワード変更）を
//   入れ替えずに、chatRoom だけをカスタムトークン（uid = users.id）でサインインさせる。
//
// つなぎの修正: ブラウザからの配信の形はバックエンド評議会の決定（R4: 購読だけをブラウザに残し、書き込みは API へ）待ち。
// 認証の状態はメモリにだけ持つ（ログアウト後にサインインが残らない。ページを読み込むたびにトークンを 1 回取り直す）。

import { type FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { type Auth, getAuth, inMemoryPersistence, initializeAuth, signInWithCustomToken } from "firebase/auth";
import { type Firestore, getFirestore } from "firebase/firestore";

import { fetchFirebaseCustomToken } from "@/features/core/auth/services/client/firebaseToken";
import { app as defaultApp, isFirebaseClientConfigured } from "@/lib/firebase/client/app";
import { FirebaseNotConfiguredError } from "@/lib/firebase/errors";

const CHAT_APP_NAME = "chatRoom";

let chatAuth: Auth | null = null;
let chatFirestore: Firestore | null = null;
let signingIn: Promise<void> | null = null;

function getChatApp(): FirebaseApp {
  if (!isFirebaseClientConfigured()) throw new FirebaseNotConfiguredError("client");
  const existing = getApps().find((a) => a.name === CHAT_APP_NAME);
  return existing ?? initializeApp(defaultApp.options, CHAT_APP_NAME);
}

function getChatAuth(): Auth {
  if (!chatAuth) {
    const chatApp = getChatApp();
    try {
      chatAuth = initializeAuth(chatApp, { persistence: inMemoryPersistence });
    } catch {
      // ホットリロードでモジュールが再評価され、同じアプリに initializeAuth 済みのとき
      chatAuth = getAuth(getApp(CHAT_APP_NAME));
    }
  }
  return chatAuth;
}

/** chatRoom の Firestore（chatRoom 専用のアプリのもの） */
export function getChatFirestore(): Firestore {
  if (!chatFirestore) chatFirestore = getFirestore(getChatApp());
  return chatFirestore;
}

/**
 * chatRoom 専用のアプリが、今のセッションのユーザー（uid = users.id）でサインインしていることを保証する。
 * - サインインしていない・expectedUid と違う → カスタムトークン（/api/auth/firebase-token）でサインインし直す
 * - 同時に呼ばれたら 1 回のサインインにまとめる
 * - サインインした uid が expectedUid と違えば投げる（セッションが別のユーザーに変わった等）
 */
export async function ensureChatAuth(expectedUid?: string): Promise<void> {
  const auth = getChatAuth();
  const current = auth.currentUser?.uid;
  if (current && (!expectedUid || current === expectedUid)) return;

  if (!signingIn) {
    signingIn = (async () => {
      const token = await fetchFirebaseCustomToken();
      await signInWithCustomToken(auth, token);
    })().finally(() => {
      signingIn = null;
    });
  }
  await signingIn;

  const signedIn = auth.currentUser?.uid;
  if (expectedUid && signedIn !== expectedUid) {
    throw new Error("チャットの認証がセッションのユーザーと一致しません");
  }
}

/**
 * サインインを待ってから購読を始める。戻り値は同期の解除関数（購読の前に解除されたら購読しない）。
 * サインインに失敗したら onError に渡す。
 */
export function subscribeAfterChatAuth(
  start: () => () => void,
  onError?: (error: Error) => void,
  expectedUid?: string,
): () => void {
  let cancelled = false;
  let unsubscribe: (() => void) | null = null;

  ensureChatAuth(expectedUid)
    .then(() => {
      if (!cancelled) unsubscribe = start();
    })
    .catch((error: unknown) => {
      if (!cancelled) onError?.(error instanceof Error ? error : new Error(String(error)));
    });

  return () => {
    cancelled = true;
    unsubscribe?.();
  };
}
