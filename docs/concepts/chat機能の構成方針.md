# チャットドメイン構成方針 V2

## 概要

ユーザー間チャット機能の設計方針。1on1 およびグループチャットに対応。

- Firestore をデータストアとし、リアルタイム同期に対応
- chatRoom を中心とした構造設計
- メッセージはサブコレクションで管理
- 一覧表示高速化のため lastMessageSnapshot（冗長保存）を導入
- 未読管理を chatRoom 内に統合（追加読取なし）

---

## データ構造

### chatRooms/{roomId}

| フィールド名          | 型                          | 説明                                              |
| --------------------- | --------------------------- | ------------------------------------------------- |
| `id`                  | `string`（doc ID）          | ルーム識別子                                      |
| `type`                | `"direct"` \| `"group"`     | チャット種別                                      |
| `participants`        | `string[]`                  | userId の配列。一覧取得用（array-contains）       |
| `participantPair`     | `string \| null`            | directのみ。ソート済みUID結合キー（重複チェック用）|
| `name`                | `string \| null`            | グループ名（groupのみ）                           |
| `readAt`              | `{ [userId]: Timestamp }`   | 各ユーザーの最終閲覧時刻（未読管理）              |
| `lastMessageSnapshot` | `object \| null`            | 最新メッセージの冗長保存（下記構造）              |
| `createdAt`           | `Timestamp`                 | 作成日時                                          |
| `updatedAt`           | `Timestamp`                 | 最終更新日時                                      |

#### lastMessageSnapshot の構造

```ts
{
  type: "text" | "image" | "file" | "system";
  content: string;
  senderId: string;
  createdAt: Timestamp;
}
```

#### participantPair の生成ルール

directルーム作成時に `[uid1, uid2].sort().join("_")` で正規化したキーを保存する。これにより `where("participantPair", "==", key)` で既存ルームの重複チェックが1クエリで完結する。groupルームでは `null`。

---

### chatRooms/{roomId}/messages/{messageId}

| フィールド名 | 型                                         | 説明                                    |
| ------------ | ------------------------------------------ | --------------------------------------- |
| `id`         | `string`（doc ID）                         | メッセージ ID                           |
| `type`       | `"text"` \| `"image"` \| `"file"` \| `"system"` | メッセージ種別                    |
| `content`    | `string`                                   | 本文（image/fileの場合はURL）           |
| `senderId`   | `string`                                   | 送信者の userId                         |
| `metadata`   | `object \| null`                           | image/file時の付加情報（下記構造）      |
| `createdAt`  | `Timestamp`                                | 作成日時                                |

#### metadata の構造（optional）

```ts
{
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  thumbnailUrl?: string;
}
```

---

## 未読管理

- chatRoom の `readAt` フィールドで管理。ユーザーごとの最終閲覧時刻を記録する
- 未読判定: `room.lastMessageSnapshot?.createdAt > room.readAt?.[myUid]`
- 更新タイミング: チャット画面を開いた時のみ。一覧画面のリアルタイムリスナーでは更新しない（読取コスト抑制）
- chatRoom 内に統合することで、一覧取得時に追加読取なしで未読判定が完結する

---

## lastMessageSnapshot の更新方式

writeBatch（クライアント側バッチ書き込み）を採用する。

- メッセージ作成と chatRoom の lastMessageSnapshot 更新をアトミックに実行
- Cloud Functions トリガーと比較して遅延がなく、送信直後に一覧へ反映される
- セキュリティルールで整合性を強制可能

```ts
const batch = writeBatch(db);
const messageRef = doc(collection(db, `chatRooms/${roomId}/messages`));
const roomRef = doc(db, `chatRooms/${roomId}`);

batch.set(messageRef, {
  type: "text",
  content,
  senderId: myUid,
  createdAt: serverTimestamp(),
});

batch.update(roomRef, {
  lastMessageSnapshot: {
    type: "text",
    content,
    senderId: myUid,
    createdAt: serverTimestamp(),
  },
  updatedAt: serverTimestamp(),
});

await batch.commit();
```

---

## ページネーション方針

カーソルベース（startAfter）を採用する。offset ベースはスキップ分も読取カウントされるため非効率。

- 1回あたり 20〜30件取得（limit）
- `createdAt` 降順、`startAfter` で最古メッセージの `createdAt` を渡す
- 上スクロールで過去メッセージを追加読み込み（逆無限スクロール）

2つのクエリを併用する:

1. **初回 + 過去取得**: `orderBy("createdAt", "desc").limit(30).startAfter(oldestCreatedAt)`
2. **新着リアルタイム受信**: `orderBy("createdAt", "asc").startAfter(latestCreatedAt)` で `onSnapshot`

---

## セキュリティルール方針

```
chatRooms:
  read:   request.auth.uid in resource.data.participants
  create: request.auth.uid in request.resource.data.participants
  update(readAt): 自分の readAt フィールドのみ更新可能
  update(lastMessageSnapshot): messages への書き込みとバッチで行う場合のみ

chatRooms/{roomId}/messages:
  read:   親ルームの participants に含まれること
  create: senderId == request.auth.uid かつ親ルームの participants に含まれること
  update/delete: 不可（メッセージ編集・削除は初期スコープ外）
```

---

## 運用ポリシー

- すべてのチャットは chatRoom を単位として管理する（1on1 もグループも）
- メッセージ送信時は writeBatch で lastMessageSnapshot を同時更新する
- directルーム作成前に participantPair で既存ルームの存在チェックを行う
- メッセージの type は初回から必ず設定する（後方互換ハンドリングを避けるため）

---

## 将来的な拡張候補（未実装）

| フィールド名         | 用途                           |
| -------------------- | ------------------------------ |
| `createdBy`          | グループ作成者の ID            |
| `avatarUrl` / `icon` | グループ用アイコン画像         |
| `isArchived`         | アーカイブ状態フラグ           |
| `lastMessageId`      | snapshot 併用型への移行        |
