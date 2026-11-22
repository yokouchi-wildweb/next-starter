# chatRoom/services/client

## Overview

- chatRoom のクライアント関数(Firestore SDK を直接操作する)。通常はフック(`../../hooks/firestore/README.md`)から呼ばれる
- `firestoreClient.ts` = ルーム操作、`messageClient.ts` = メッセージ操作、`bulkMessageClient.ts` = 一斉送信、`chatRoomClient.ts` = 管理画面用の REST クライアント。`chatFirebase.ts` = chatRoom 専用の Firebase アプリ(内側の部品)
- 未読のユーティリティは `utils/unread.ts`

## Usage

### ルーム操作（firestoreClient.ts）

#### ルーム作成

```ts
// ダイレクトルーム（既存ルームがあればそれを返す）
const { roomId, alreadyExists } = await createDirectRoom({
  myUid: currentUser.uid,
  otherUid: targetUser.uid,
});

// グループルーム
const { roomId } = await createGroupRoom({
  myUid: currentUser.uid,
  participants: [currentUser.uid, user2.uid, user3.uid],
  name: "プロジェクトA",
});
```

#### カスタムルーム作成

ダウンストリームで独自の `type` を持つルームを作成する場合:

```ts
import {
  createRoomWithSystemMessage,
  buildParticipantPair,
} from "@/domains/chatRoom/services/client/firestoreClient";

const { roomId } = await createRoomWithSystemMessage({
  roomId: doc(collection(fstore, "chat_rooms")).id,
  type: "scout" as any,
  name: null,
  participants: [recruiterUid, targetUid],
  participantPair: buildParticipantPair(recruiterUid, targetUid),
  senderId: recruiterUid,
});
```

#### 参加者管理

```ts
import { addParticipant, removeParticipant } from "@/domains/chatRoom/services/client/firestoreClient";

// 追加（システムメッセージ「{name}が参加しました」を自動作成）
await addParticipant({ roomId, uid: newUser.uid, operatorUid: currentUser.uid, displayName: newUser.name });

// 退出（readAt 削除 + システムメッセージ）
await removeParticipant({ roomId, uid: leavingUser.uid, operatorUid: currentUser.uid, displayName: leavingUser.name });
```

#### 既読更新

```ts
import { updateReadAt } from "@/domains/chatRoom/services/client/firestoreClient";

// 手動で既読更新（通常は useReadAt が自動で行う）
await updateReadAt(roomId, uid);
```

### メッセージ操作（messageClient.ts）

#### 送信

通常は `useChatMessageSender` 経由で呼ばれるが、直接使用も可能。

```ts
import { sendTextMessage, sendFileMessage, generateMessageId } from "@/domains/chatRoom/services/client/messageClient";

// テキスト
const messageId = await sendTextMessage({ roomId, content: "Hello", senderId: uid });

// ファイル（uploadToStorage で上げた ref を渡す。通常は useChatMessageSender.sendFile を使う）
const messageId = await sendFileMessage({
  roomId, content: ref, type: "image", senderId: uid,
  metadata: { fileName: "photo.jpg", fileSize: 1024 },
});
```

> 送信時は writeBatch で `messages` 作成 + `lastMessageSnapshot` 更新 + `readAt` 更新をアトミック実行する。

#### 編集

```ts
import { editMessage } from "@/domains/chatRoom/services/client/messageClient";

await editMessage({
  roomId,
  messageId,
  content: "修正後のテキスト",
  senderId: uid,
  isLatestMessage: true, // 最新メッセージなら lastMessageSnapshot も同時更新
});
```

#### 削除（論理削除）

```ts
import { deleteMessage } from "@/domains/chatRoom/services/client/messageClient";

await deleteMessage({ roomId, messageId });
// → deletedAt が設定される。lastMessageSnapshot は変更しない
```

#### 過去メッセージ取得

```ts
import { fetchPastMessages } from "@/domains/chatRoom/services/client/messageClient";

const { messages, nextCursor, hasMore } = await fetchPastMessages(roomId);
// 次ページ: await fetchPastMessages(roomId, nextCursor);
```

### 一斉メッセージ送信（bulkMessageClient.ts）

- 複数ユーザーに同一のダイレクトメッセージを一斉送信する。各宛先に対してルームの確保（find or create）→ メッセージ送信を並行実行する

```ts
import { sendBulkDirectMessage } from "@/domains/chatRoom/services/client/bulkMessageClient";

const result = await sendBulkDirectMessage({
  senderId: currentUser.uid,
  targetUserIds: ["user1", "user2", "user3"],
  content: "お知らせ：明日の会議は15時に変更になりました",
  concurrency: 5, // 同時実行数（デフォルト: 5）
  onProgress: ({ completed, total }) => {
    console.log(`${completed} / ${total} 件完了`);
  },
});

console.log(`成功: ${result.successCount}, 失敗: ${result.failedCount}`);

// 失敗した宛先の確認
const failed = result.results.filter((r) => r.status === "failed");
```

> 同時実行数を制限（デフォルト5）して Firestore のレート制限に配慮する。各宛先の処理は独立しており、一部の失敗が他に影響しない。

### 未読ユーティリティ（utils/unread.ts）

```ts
import { isRoomUnread, countUnreadRooms } from "@/domains/chatRoom/utils/unread";

isRoomUnread(room, uid);      // 最新メッセージが自分の送信なら false
countUnreadRooms(rooms, uid); // 未読ルーム数
```
