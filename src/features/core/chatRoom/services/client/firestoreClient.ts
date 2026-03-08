// src/features/chatRoom/services/client/firestoreClient.ts
//
// チャットルームの Firestore クライアント操作。
// リアルタイム購読・ルーム作成・既読更新など、REST API を経由しない直接操作を提供する。

import {
  collection,
  doc,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";

import { fstore } from "@/lib/firebase/client/app";
import {
  executeBatch,
  queryDocs,
  subscribeCollection,
  subscribeDoc,
  updateDoc,
} from "@/lib/firestore/client";
import type { BatchOperation } from "@/lib/firestore/client";
import type { Unsubscribe } from "@/lib/firestore/types";

import type { ChatRoom } from "@/features/chatRoom/entities";
import type { ChatRoomType, LastMessageSnapshot } from "@/features/chatRoom/entities/message";
import { messagesSubcollectionPath } from "@/features/chatRoom/entities/message";
import { collectionPath } from "@/features/chatRoom/entities/firestore";
import { SYSTEM_MESSAGE_ROOM_CREATED } from "@/features/chatRoom/constants/chat";

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

/** ダイレクトルーム作成パラメータ */
export type CreateDirectRoomParams = {
  /** 自分の userId */
  myUid: string;
  /** 相手の userId */
  otherUid: string;
};

/** グループルーム作成パラメータ */
export type CreateGroupRoomParams = {
  /** 自分の userId */
  myUid: string;
  /** 参加者の userId 配列（自分を含む） */
  participants: string[];
  /** グループ名 */
  name: string;
};

/** ルーム作成の結果 */
export type CreateRoomResult = {
  /** 作成または既存のルーム ID */
  roomId: string;
  /** 既存ルームが見つかった場合 true */
  alreadyExists: boolean;
};

// ---------------------------------------------------------------------------
// participantPair ヘルパー
// ---------------------------------------------------------------------------

/**
 * ソート済み UID 結合キーを生成する。
 * direct ルームの重複チェック用。
 */
export function buildParticipantPair(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join("_");
}

// ---------------------------------------------------------------------------
// ルーム作成
// ---------------------------------------------------------------------------

/**
 * ダイレクトルームを作成する。
 *
 * participantPair で既存ルームを検索し、存在すればそれを返す。
 * 存在しなければ writeBatch でルーム＋初期システムメッセージをアトミック作成する。
 */
export async function createDirectRoom(
  params: CreateDirectRoomParams,
): Promise<CreateRoomResult> {
  const { myUid, otherUid } = params;
  const participantPair = buildParticipantPair(myUid, otherUid);

  // 既存ルームの検索
  const q = query(
    collection(fstore, collectionPath),
    where("participantPair", "==", participantPair),
  );
  const { docs: existing } = await queryDocs<ChatRoom>(q);

  if (existing.length > 0) {
    return { roomId: existing[0].id, alreadyExists: true };
  }

  // 新規作成
  const roomId = doc(collection(fstore, collectionPath)).id;
  return createRoomWithSystemMessage({
    roomId,
    type: "direct",
    name: null,
    participants: [myUid, otherUid],
    participantPair,
    senderId: myUid,
  });
}

/**
 * グループルームを作成する。
 *
 * writeBatch でルーム＋初期システムメッセージをアトミック作成する。
 */
export async function createGroupRoom(
  params: CreateGroupRoomParams,
): Promise<CreateRoomResult> {
  const { myUid, participants, name } = params;
  const roomId = doc(collection(fstore, collectionPath)).id;

  return createRoomWithSystemMessage({
    roomId,
    type: "group",
    name,
    participants,
    participantPair: null,
    senderId: myUid,
  });
}

// ---------------------------------------------------------------------------
// ルーム購読
// ---------------------------------------------------------------------------

/**
 * ユーザーが参加しているルーム一覧をリアルタイム購読する。
 *
 * lastMessageSnapshot.createdAt 降順でソートされる。
 */
export function subscribeRooms(
  uid: string,
  callback: (rooms: ChatRoom[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(fstore, collectionPath),
    where("participants", "array-contains", uid),
    orderBy("lastMessageSnapshot.createdAt", "desc"),
  );
  return subscribeCollection<ChatRoom>(q, callback, onError as any);
}

/**
 * 単一ルームをリアルタイム購読する。
 */
export function subscribeRoom(
  roomId: string,
  callback: (room: ChatRoom | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const ref = doc(fstore, collectionPath, roomId);
  return subscribeDoc<ChatRoom>(ref, callback, onError as any);
}

// ---------------------------------------------------------------------------
// 既読更新
// ---------------------------------------------------------------------------

/**
 * ルームの readAt を更新する。
 *
 * チャット画面を開いた時に呼び出す。
 * Firestore のドット記法で自分のフィールドのみ更新する。
 */
export async function updateReadAt(
  roomId: string,
  uid: string,
): Promise<void> {
  const ref = doc(fstore, collectionPath, roomId);
  await updateDoc(ref, {
    [`readAt.${uid}`]: serverTimestamp(),
  });
}

// ---------------------------------------------------------------------------
// 内部関数
// ---------------------------------------------------------------------------

type CreateRoomInternalParams = {
  roomId: string;
  type: ChatRoomType;
  name: string | null;
  participants: string[];
  participantPair: string | null;
  senderId: string;
};

/**
 * ルームとシステムメッセージを writeBatch でアトミック作成する。
 *
 * 設計方針: lastMessageSnapshot が null になるのを防ぐため、
 * ルーム作成時に必ずシステムメッセージを同時作成する。
 */
async function createRoomWithSystemMessage(
  params: CreateRoomInternalParams,
): Promise<CreateRoomResult> {
  const { roomId, type, name, participants, participantPair, senderId } = params;

  const roomRef = doc(fstore, collectionPath, roomId);
  const messageRef = doc(collection(fstore, messagesSubcollectionPath(roomId)));

  const snapshot: Omit<LastMessageSnapshot, "createdAt"> & { createdAt: ReturnType<typeof serverTimestamp> } = {
    type: "system",
    content: SYSTEM_MESSAGE_ROOM_CREATED,
    senderId,
    createdAt: serverTimestamp(),
  };

  // readAt の初期値: 全参加者の既読時刻を現在時刻に設定
  const readAt: Record<string, ReturnType<typeof serverTimestamp>> = {};
  for (const uid of participants) {
    readAt[uid] = serverTimestamp();
  }

  const operations: BatchOperation[] = [
    {
      type: "set",
      ref: roomRef,
      data: {
        type,
        name,
        participants,
        participantPair,
        readAt,
        lastMessageSnapshot: snapshot,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    },
    {
      type: "set",
      ref: messageRef,
      data: {
        type: "system",
        content: SYSTEM_MESSAGE_ROOM_CREATED,
        senderId,
        metadata: null,
        createdAt: serverTimestamp(),
      },
    },
  ];

  await executeBatch(operations);

  return { roomId, alreadyExists: false };
}
