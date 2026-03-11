// src/features/chatRoom/services/client/firestoreClient.ts
//
// チャットルームの Firestore クライアント操作。
// リアルタイム購読・ルーム作成・既読更新など、REST API を経由しない直接操作を提供する。

import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteField,
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
import {
  SYSTEM_MESSAGE_PARTICIPANT_ADDED,
  SYSTEM_MESSAGE_PARTICIPANT_REMOVED,
  SYSTEM_MESSAGE_ROOM_CREATED,
} from "@/features/chatRoom/constants/chat";

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

/** subscribeRooms のオプション */
export type SubscribeRoomsOptions = {
  /**
   * 含めるルームタイプでフィルタする（未指定時は全タイプ）。
   * - 単一指定: Firestore where でサーバーサイドフィルタ（効率的）
   * - 配列指定: 全件取得後にクライアントサイドでフィルタ（Firestore の in + array-contains 制約回避）
   */
  type?: ChatRoomType | ChatRoomType[];
  /**
   * 除外するルームタイプ。
   * 全件取得後にクライアントサイドでフィルタする。
   * type と同時指定した場合は type が優先される。
   */
  excludeTypes?: ChatRoomType[];
};

/**
 * ユーザーが参加しているルーム一覧をリアルタイム購読する。
 *
 * lastMessageSnapshot.createdAt 降順でソートされる。
 *
 * フィルタ動作:
 * - type（単一）: Firestore where でサーバーサイドフィルタ
 * - type（配列）: 全件取得後にクライアントサイドで include フィルタ
 * - excludeTypes: 全件取得後にクライアントサイドで exclude フィルタ
 * - type と excludeTypes の同時指定時は type が優先される
 */
export function subscribeRooms(
  uid: string,
  callback: (rooms: ChatRoom[]) => void,
  onError?: (error: Error) => void,
  options?: SubscribeRoomsOptions,
): Unsubscribe {
  // 単一 type のみ Firestore where を使用（効率的）
  const singleType = typeof options?.type === "string" ? options.type : undefined;

  const constraints = [
    where("participants", "array-contains", uid),
    ...(singleType ? [where("type", "==", singleType)] : []),
    orderBy("lastMessageSnapshot.createdAt", "desc"),
  ];
  const q = query(collection(fstore, collectionPath), ...constraints);

  // クライアントサイドフィルタが必要な場合はコールバックをラップ
  const typeArray = Array.isArray(options?.type) ? options.type : undefined;
  const excludeTypes = !typeArray && !singleType ? options?.excludeTypes : undefined;
  const needsClientFilter = typeArray || excludeTypes;

  const wrappedCallback = needsClientFilter
    ? (rooms: ChatRoom[]) => {
        const filtered = rooms.filter((room) => {
          if (typeArray) return typeArray.includes(room.type as ChatRoomType);
          if (excludeTypes) return !excludeTypes.includes(room.type as ChatRoomType);
          return true;
        });
        callback(filtered);
      }
    : callback;

  return subscribeCollection<ChatRoom>(q, wrappedCallback, onError as any);
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
// 参加者管理
// ---------------------------------------------------------------------------

/** 参加者追加パラメータ */
export type AddParticipantParams = {
  roomId: string;
  /** 追加する userId */
  uid: string;
  /** 操作者の userId（システムメッセージの senderId） */
  operatorUid: string;
  /** 表示用の名前（システムメッセージ用） */
  displayName: string;
};

/** 参加者退出パラメータ */
export type RemoveParticipantParams = {
  roomId: string;
  /** 退出する userId */
  uid: string;
  /** 操作者の userId（システムメッセージの senderId） */
  operatorUid: string;
  /** 表示用の名前（システムメッセージ用） */
  displayName: string;
};

/**
 * グループルームに参加者を追加する。
 *
 * writeBatch で以下をアトミック実行:
 * 1. participants 配列に追加（arrayUnion）
 * 2. readAt に新規参加者のエントリ追加
 * 3. システムメッセージ作成
 * 4. lastMessageSnapshot 更新
 */
export async function addParticipant(params: AddParticipantParams): Promise<void> {
  const { roomId, uid, operatorUid, displayName } = params;

  const roomRef = doc(fstore, collectionPath, roomId);
  const messageRef = doc(collection(fstore, messagesSubcollectionPath(roomId)));
  const content = SYSTEM_MESSAGE_PARTICIPANT_ADDED.replace("{name}", displayName);

  const snapshotData = {
    type: "system",
    content,
    senderId: operatorUid,
    createdAt: serverTimestamp(),
  };

  const operations: BatchOperation[] = [
    {
      type: "update",
      ref: roomRef,
      data: {
        participants: arrayUnion(uid),
        [`readAt.${uid}`]: serverTimestamp(),
        lastMessageSnapshot: snapshotData,
        updatedAt: serverTimestamp(),
      },
    },
    {
      type: "set",
      ref: messageRef,
      data: {
        type: "system",
        content,
        senderId: operatorUid,
        metadata: null,
        createdAt: serverTimestamp(),
      },
    },
  ];

  await executeBatch(operations);
}

/**
 * グループルームから参加者を退出させる。
 *
 * writeBatch で以下をアトミック実行:
 * 1. participants 配列から除去（arrayRemove）
 * 2. readAt から該当ユーザーのエントリ削除
 * 3. システムメッセージ作成
 * 4. lastMessageSnapshot 更新
 */
export async function removeParticipant(params: RemoveParticipantParams): Promise<void> {
  const { roomId, uid, operatorUid, displayName } = params;

  const roomRef = doc(fstore, collectionPath, roomId);
  const messageRef = doc(collection(fstore, messagesSubcollectionPath(roomId)));
  const content = SYSTEM_MESSAGE_PARTICIPANT_REMOVED.replace("{name}", displayName);

  const snapshotData = {
    type: "system",
    content,
    senderId: operatorUid,
    createdAt: serverTimestamp(),
  };

  const operations: BatchOperation[] = [
    {
      type: "update",
      ref: roomRef,
      data: {
        participants: arrayRemove(uid),
        [`readAt.${uid}`]: deleteField(),
        lastMessageSnapshot: snapshotData,
        updatedAt: serverTimestamp(),
      },
    },
    {
      type: "set",
      ref: messageRef,
      data: {
        type: "system",
        content,
        senderId: operatorUid,
        metadata: null,
        createdAt: serverTimestamp(),
      },
    },
  ];

  await executeBatch(operations);
}

// ---------------------------------------------------------------------------
// 汎用ルーム作成（ダウンストリーム拡張用）
// ---------------------------------------------------------------------------

/** createRoomWithSystemMessage のパラメータ */
export type CreateRoomInternalParams = {
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
export async function createRoomWithSystemMessage(
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
