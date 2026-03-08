// src/lib/firestore/client/subscribe.ts
//
// Firestore onSnapshot のクライアント用ラッパー。
// snapshot → データ変換（Timestamp → Date, doc.id → id フィールド統合）を自動適用する。
// ドメインの ClientService がこのモジュールを使い、Hook は ClientService を呼ぶ。

import {
  type DocumentChange,
  type DocumentReference,
  type FirestoreError,
  type Query,
  type SnapshotListenOptions,
  type SnapshotMetadata,
  onSnapshot,
} from "firebase/firestore";

import type { Unsubscribe } from "../types";
import { convertTimestamps } from "./converter";

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

/** subscribeCollection / subscribeDoc 共通のオプション */
export type SubscribeOptions = {
  /** snapshot.metadata を含めるか（hasPendingWrites 等の確認用） */
  includeMetadataChanges?: boolean;
};

/** docChanges の変更種別ごとの変換済みデータ */
export type DocChange<T> = {
  type: DocumentChange["type"];
  doc: T;
};

/** subscribeCollectionChanges のコールバックに渡されるデータ */
export type CollectionChangesSnapshot<T> = {
  changes: DocChange<T>[];
  metadata: SnapshotMetadata;
};

// ---------------------------------------------------------------------------
// コレクション購読（全体スナップショット）
// ---------------------------------------------------------------------------

/**
 * コレクション（Query）をリアルタイム購読する
 *
 * 毎回全ドキュメントの最新スナップショットをコールバックに渡す。
 * ルーム一覧のような「常に全体を表示する」用途に最適。
 *
 * @example
 * ```ts
 * // ClientService 側
 * export function subscribeToChatRooms(uid: string, callback: (rooms: ChatRoom[]) => void) {
 *   const q = query(collection(fstore, "chatRooms"), where("participants", "array-contains", uid));
 *   return subscribeCollection<ChatRoom>(q, callback);
 * }
 * ```
 */
export function subscribeCollection<T extends { id: string }>(
  q: Query,
  callback: (items: T[]) => void,
  onError?: (error: FirestoreError) => void,
  options?: SubscribeOptions,
): Unsubscribe {
  const listenOptions = buildListenOptions(options);

  return onSnapshot(
    q,
    listenOptions,
    (snapshot) => {
      const items = snapshot.docs.map((doc) =>
        convertTimestamps({ id: doc.id, ...doc.data() } as T),
      );
      callback(items);
    },
    onError ?? defaultErrorHandler,
  );
}

// ---------------------------------------------------------------------------
// コレクション購読（差分）
// ---------------------------------------------------------------------------

/**
 * コレクション（Query）の差分変更をリアルタイム購読する
 *
 * docChanges() を使い、追加・変更・削除されたドキュメントのみをコールバックに渡す。
 * 新着メッセージの追記など、差分処理が効率的な用途に最適。
 *
 * @example
 * ```ts
 * // ClientService 側 — 新着メッセージのリアルタイム受信
 * export function subscribeToNewMessages(
 *   roomId: string,
 *   latestCreatedAt: Date,
 *   callback: (snapshot: CollectionChangesSnapshot<Message>) => void,
 * ) {
 *   const q = query(
 *     collection(fstore, `chatRooms/${roomId}/messages`),
 *     orderBy("createdAt", "asc"),
 *     startAfter(Timestamp.fromDate(latestCreatedAt)),
 *   );
 *   return subscribeCollectionChanges<Message>(q, callback);
 * }
 * ```
 */
export function subscribeCollectionChanges<T extends { id: string }>(
  q: Query,
  callback: (snapshot: CollectionChangesSnapshot<T>) => void,
  onError?: (error: FirestoreError) => void,
  options?: SubscribeOptions,
): Unsubscribe {
  const listenOptions = buildListenOptions(options);

  return onSnapshot(
    q,
    listenOptions,
    (snapshot) => {
      const changes: DocChange<T>[] = snapshot.docChanges().map((change) => ({
        type: change.type,
        doc: convertTimestamps({ id: change.doc.id, ...change.doc.data() } as T),
      }));
      callback({ changes, metadata: snapshot.metadata });
    },
    onError ?? defaultErrorHandler,
  );
}

// ---------------------------------------------------------------------------
// 単一ドキュメント購読
// ---------------------------------------------------------------------------

/**
 * 単一ドキュメントをリアルタイム購読する
 *
 * @example
 * ```ts
 * // ClientService 側
 * export function subscribeToChatRoom(roomId: string, callback: (room: ChatRoom | null) => void) {
 *   const ref = doc(fstore, "chatRooms", roomId);
 *   return subscribeDoc<ChatRoom>(ref, callback);
 * }
 * ```
 */
export function subscribeDoc<T extends { id: string }>(
  ref: DocumentReference,
  callback: (item: T | null) => void,
  onError?: (error: FirestoreError) => void,
  options?: SubscribeOptions,
): Unsubscribe {
  const listenOptions = buildListenOptions(options);

  return onSnapshot(
    ref,
    listenOptions,
    (snapshot) => {
      if (!snapshot.exists()) {
        callback(null);
        return;
      }
      const item = convertTimestamps({ id: snapshot.id, ...snapshot.data() } as T);
      callback(item);
    },
    onError ?? defaultErrorHandler,
  );
}

// ---------------------------------------------------------------------------
// 内部関数
// ---------------------------------------------------------------------------

function buildListenOptions(options?: SubscribeOptions): SnapshotListenOptions {
  return {
    includeMetadataChanges: options?.includeMetadataChanges ?? false,
  };
}

function defaultErrorHandler(error: FirestoreError): void {
  console.error("[Firestore subscription error]", error.code, error.message);
}
