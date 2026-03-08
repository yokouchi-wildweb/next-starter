// src/features/chatRoom/services/client/messageClient.ts
//
// チャットメッセージの Firestore クライアント操作。
// メッセージ送信・過去メッセージ取得・新着メッセージ購読を提供する。

import {
  type QueryDocumentSnapshot,
  collection,
  doc,
  limit as firestoreLimit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
} from "firebase/firestore";

import { fstore } from "@/lib/firebase/client/app";
import {
  executeBatch,
  queryDocs,
  subscribeCollectionChanges,
} from "@/lib/firestore/client";
import type { BatchOperation, CollectionChangesSnapshot } from "@/lib/firestore/client";
import type { Unsubscribe } from "@/lib/firestore/types";

import type { ChatMessage, LastMessageSnapshot, MessageMetadata, MessageType } from "@/features/chatRoom/entities/message";
import { messagesSubcollectionPath } from "@/features/chatRoom/entities/message";
import { collectionPath } from "@/features/chatRoom/entities/firestore";
import { MESSAGES_PER_PAGE } from "@/features/chatRoom/constants/chat";
import { updateDoc } from "@/lib/firestore/client";

// ---------------------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------------------

/**
 * メッセージ ID を事前生成する。
 *
 * 楽観的UI で PendingMessage.id と Firestore ドキュメント ID を
 * 一致させるために使用する。
 */
export function generateMessageId(roomId: string): string {
  const messagesRef = collection(fstore, messagesSubcollectionPath(roomId));
  return doc(messagesRef).id;
}

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

/** テキストメッセージ送信パラメータ */
export type SendTextMessageParams = {
  roomId: string;
  content: string;
  senderId: string;
  /** 事前生成したメッセージ ID（楽観的UI 用） */
  messageId?: string;
};

/** ファイル/画像メッセージ送信パラメータ */
export type SendFileMessageParams = {
  roomId: string;
  /** ダウンロード URL */
  content: string;
  /** "image" または "file" */
  type: Extract<MessageType, "image" | "file">;
  senderId: string;
  metadata: MessageMetadata;
  /** 事前生成したメッセージ ID（楽観的UI 用） */
  messageId?: string;
};

/** 過去メッセージ取得の結果 */
export type FetchMessagesResult = {
  messages: ChatMessage[];
  /**
   * 次ページ取得用カーソル。
   * これ以上メッセージがない場合は null。
   */
  nextCursor: QueryDocumentSnapshot | null;
  /** 取得件数が limit 未満で、これ以上過去のメッセージがないことを示す */
  hasMore: boolean;
};

// ---------------------------------------------------------------------------
// メッセージ送信
// ---------------------------------------------------------------------------

/**
 * テキストメッセージを送信する。
 *
 * writeBatch でメッセージ作成と lastMessageSnapshot 更新をアトミックに実行する。
 *
 * @returns 作成されたメッセージの ID
 */
export async function sendTextMessage(
  params: SendTextMessageParams,
): Promise<string> {
  const { roomId, content, senderId, messageId } = params;
  return sendMessage({
    roomId,
    type: "text",
    content,
    senderId,
    metadata: null,
    messageId,
  });
}

/**
 * ファイル/画像メッセージを送信する。
 *
 * ファイルアップロード完了後に呼び出す。
 * writeBatch でメッセージ作成と lastMessageSnapshot 更新をアトミックに実行する。
 *
 * @returns 作成されたメッセージの ID
 */
export async function sendFileMessage(
  params: SendFileMessageParams,
): Promise<string> {
  const { roomId, type, content, senderId, metadata, messageId } = params;
  return sendMessage({
    roomId,
    type,
    content,
    senderId,
    metadata,
    messageId,
  });
}

// ---------------------------------------------------------------------------
// メッセージ編集
// ---------------------------------------------------------------------------

/** メッセージ編集パラメータ */
export type EditMessageParams = {
  roomId: string;
  messageId: string;
  content: string;
  senderId: string;
  /**
   * このメッセージが最新メッセージかどうか。
   * true の場合、lastMessageSnapshot も同時更新する。
   * 呼び出し側で lastMessageSnapshot.createdAt と比較して判定する。
   */
  isLatestMessage: boolean;
};

/**
 * メッセージを編集する。
 *
 * - editedAt を設定し、content を更新する
 * - 最新メッセージの場合は writeBatch で lastMessageSnapshot も同時更新
 * - 最新でない場合はメッセージのみ更新
 */
export async function editMessage(params: EditMessageParams): Promise<void> {
  const { roomId, messageId, content, senderId, isLatestMessage } = params;

  const messageRef = doc(fstore, messagesSubcollectionPath(roomId), messageId);
  const roomRef = doc(fstore, collectionPath, roomId);

  if (isLatestMessage) {
    const operations: BatchOperation[] = [
      {
        type: "update",
        ref: messageRef,
        data: {
          content,
          editedAt: serverTimestamp(),
        },
      },
      {
        type: "update",
        ref: roomRef,
        data: {
          "lastMessageSnapshot.content": content,
          updatedAt: serverTimestamp(),
        },
      },
    ];
    await executeBatch(operations);
  } else {
    await updateDoc(messageRef, {
      content,
      editedAt: serverTimestamp(),
    });
  }
}

// ---------------------------------------------------------------------------
// メッセージ削除（論理削除）
// ---------------------------------------------------------------------------

/** メッセージ削除パラメータ */
export type DeleteMessageParams = {
  roomId: string;
  messageId: string;
};

/**
 * メッセージを論理削除する。
 *
 * - deletedAt を設定する
 * - lastMessageSnapshot は変更しない（設計方針に準拠）
 * - 表示側で deletedAt を確認して「メッセージが削除されました」と表示する
 */
export async function deleteMessage(params: DeleteMessageParams): Promise<void> {
  const { roomId, messageId } = params;
  const messageRef = doc(fstore, messagesSubcollectionPath(roomId), messageId);

  await updateDoc(messageRef, {
    deletedAt: serverTimestamp(),
  });
}

// ---------------------------------------------------------------------------
// メッセージ取得（ページネーション）
// ---------------------------------------------------------------------------

/**
 * 過去メッセージをカーソルベースで取得する。
 *
 * createdAt 降順で取得し、startAfter カーソルで過去方向にページネーションする。
 * 上スクロール時の過去メッセージ読み込み用。
 */
export async function fetchPastMessages(
  roomId: string,
  cursor?: QueryDocumentSnapshot | null,
  limit: number = MESSAGES_PER_PAGE,
): Promise<FetchMessagesResult> {
  const messagesRef = collection(fstore, messagesSubcollectionPath(roomId));

  const constraints = [
    orderBy("createdAt", "desc"),
    firestoreLimit(limit),
  ];

  if (cursor) {
    constraints.splice(1, 0, startAfter(cursor));
  }

  const q = query(messagesRef, ...constraints);
  const { docs, lastSnapshot } = await queryDocs<ChatMessage>(q);

  return {
    // 降順で取得したものを昇順に戻す（表示は古い→新しい）
    messages: docs.reverse(),
    nextCursor: lastSnapshot,
    hasMore: docs.length >= limit,
  };
}

// ---------------------------------------------------------------------------
// 新着メッセージ購読
// ---------------------------------------------------------------------------

/**
 * 新着メッセージをリアルタイム購読する。
 *
 * 指定した createdAt より後のメッセージを差分で受信する。
 * 初回メッセージ取得後に呼び出し、以降の新着をリアルタイムで受け取る。
 */
export function subscribeNewMessages(
  roomId: string,
  after: Date,
  callback: (snapshot: CollectionChangesSnapshot<ChatMessage>) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const messagesRef = collection(fstore, messagesSubcollectionPath(roomId));
  const q = query(
    messagesRef,
    orderBy("createdAt", "asc"),
    startAfter(after),
  );
  return subscribeCollectionChanges<ChatMessage>(q, callback, onError as any);
}

// ---------------------------------------------------------------------------
// 内部関数
// ---------------------------------------------------------------------------

type SendMessageInternalParams = {
  roomId: string;
  type: MessageType;
  content: string;
  senderId: string;
  metadata: MessageMetadata | null;
  /** 事前生成したメッセージ ID（楽観的UI 用。省略時は自動生成） */
  messageId?: string;
};

/**
 * メッセージ送信の共通処理。
 *
 * writeBatch で以下をアトミック実行:
 * 1. messages サブコレクションにメッセージを作成
 * 2. chatRoom の lastMessageSnapshot と updatedAt を更新
 */
async function sendMessage(
  params: SendMessageInternalParams,
): Promise<string> {
  const { roomId, type, content, senderId, metadata, messageId } = params;

  const messagesRef = collection(fstore, messagesSubcollectionPath(roomId));
  const messageRef = messageId ? doc(messagesRef, messageId) : doc(messagesRef);
  const roomRef = doc(fstore, collectionPath, roomId);

  const snapshotData = {
    type,
    content,
    senderId,
    createdAt: serverTimestamp(),
  };

  const operations: BatchOperation[] = [
    {
      type: "set",
      ref: messageRef,
      data: {
        type,
        content,
        senderId,
        metadata,
        createdAt: serverTimestamp(),
      },
    },
    {
      type: "update",
      ref: roomRef,
      data: {
        lastMessageSnapshot: snapshotData,
        updatedAt: serverTimestamp(),
      },
    },
  ];

  await executeBatch(operations);

  return messageRef.id;
}
