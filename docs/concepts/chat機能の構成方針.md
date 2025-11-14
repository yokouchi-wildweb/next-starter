# チャットドメイン構成方針

## 🎯 概要

本サービスにおけるチャット機能は、1on1 および将来的なグループチャット拡張を見越し、以下の構成ポリシーで設計する。

- Firestore をデータストアとし、リアルタイム同期に対応
- ルーム（チャットスレッド）を中心とした構造設計
- メッセージはサブコレクションで管理
- 一覧表示高速化のため、**冗長保存（lastMessageSnapshot）を導入**

---

## 🗂 データ構造

### 🔹 chatRooms コレクション

| フィールド名          | 型                      | 説明                                 |
| --------------------- | ----------------------- | ------------------------------------ |
| `id`                  | `string`（doc ID）      | Firestore 上のルーム識別子           |
| `type`                | `"direct"` \| `"group"` | チャットの種別                       |
| `participants`        | `string[]`              | userId の配列                        |
| `name`                | `string`（optional）    | グループ名（groupのみ）              |
| `createdAt`           | `Timestamp`             | 作成日時                             |
| `updatedAt`           | `Timestamp`             | 最終更新日時                         |
| `lastMessageSnapshot` | `object`（optional）    | 最新メッセージの冗長保存（下記構造） |

#### lastMessageSnapshot の構造

```ts
{
  content: string;
  senderId: string;
  createdAt: Timestamp;
}
```

> 💡 備考：将来的に `lastMessageId` を追加することで、snapshot併用型への移行も容易。

---

### 🔹 chatRooms/{roomId}/messages サブコレクション

| フィールド名 | 型          | 説明                        |
| ------------ | ----------- | --------------------------- |
| `id`         | `string`    | Firestore 上のメッセージ ID |
| `senderId`   | `string`    | メッセージ送信者の userId   |
| `content`    | `string`    | メッセージ内容              |
| `createdAt`  | `Timestamp` | 作成日時                    |

---

## 💬 運用ポリシー

- **すべてのチャットは `chatRoom` を単位として管理する（1on1 もグループも）**
- **新しいメッセージが送信された際は、対応する `chatRoom` の `lastMessageSnapshot` を更新する**
- **`lastMessageId` は今は不要。将来的に必要になれば追加対応する**
- ルームごとの履歴取得は、`chatRooms/{roomId}/messages` を `createdAt` 降順でクエリ

---

## 🔮 将来的な拡張を想定した項目（未実装）

| フィールド名         | 用途                           |
| -------------------- | ------------------------------ |
| `createdBy`          | グループ作成者の ID            |
| `readStatus`         | 各ユーザーの既読タイムスタンプ |
| `avatarUrl` / `icon` | グループ用アイコン画像         |
| `isArchived`         | アーカイブ状態フラグ           |

---

## ✅ 現時点での選定理由まとめ

| 設計要素                         | 採用理由                                            |
| -------------------------------- | --------------------------------------------------- |
| `chatRoom` 単位管理              | 1on1・グループを共通化し拡張性を確保するため        |
| `messages` サブコレクション      | Firestoreの階層構造による柔軟な取得と権限管理のため |
| `lastMessageSnapshot` の冗長保存 | 一覧表示の高速化・コスト削減を優先                  |
| `lastMessageId` の未使用         | 現段階では不要・後付けでも安全に移行可能なため      |
