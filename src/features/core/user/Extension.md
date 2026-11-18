# user — Extension

## Overview

user の README の Extension を分けた文書。設定の項目・受け口・連絡の差し替え。

## Extension

### マイページのアカウントの項目(account.editableItems)

- マイページのアカウント（`/mypage/account`）で利用者が変えられる項目は設定 `userConfig.account.editableItems`（`"email"`・`"password"`・`"profile"`・`"phone"`、既定 `["email", "password", "profile"]`）。fork は上書き `src/config/features/user.config.ts` に `account: { editableItems: [...] }` を書く（配列は丸ごと置き換え）
- 判定は `isAccountItemEditable(item)`（`utils/accountItems.ts`）。アカウントのトップのメニュー（`AccountDetails`）は一覧の項目の行だけを出し、各画面の loader は一覧に無ければ `/mypage/account` へ戻す（レコードの取得より前）
- 一覧のほかの条件: `password` はメール登録の利用者だけ
- `phone`: 電話番号の画面は SMS 認証の機能 `phoneVerification` が開なら SMS の手順（`src/features/core/phoneVerification/README.md`）、閉なら SMS なしの入力（`EditPhone` が出し分け）。SMS なしの番号は DB だけに書き `phoneVerifiedAt` は null（未認証。Firebase の電話番号は SMS 認証で link したときだけ）
  - 口: `PATCH /api/me/phone`（body `{ phoneNumber: E.164 | null }`、null で消す）→ `updateOwnPhoneNumber`（`services/server/phoneNumber`、重複は 409、同じ番号は書かない、`base.update` で監査を通す）。受け付けるのは `isPhoneNumberInputOpen`（一覧に phone があり、かつ phoneVerification が閉）のときだけ、それ以外は 404
  - client: `updateMyPhoneNumber`（`services/client/phoneNumberClient.ts`）・`useUpdateMyPhoneNumber`（入力の値・保存・消去）・表示の部品 `components/common/PhoneNumberForm`
  - 管理者が番号を変えると `phoneVerifiedAt` が今の時刻になる（`wrappers/update.ts`。既存の挙動）
- プロフィール編集の部品 `EditProfile`（`components/EditProfile`）の値の指定: `showHeader`（既定 true）、`afterSaveHref`（保存の後の行き先。既定 `"/mypage/account"`、`null` = 移らずその場に留まり「プロフィールを保存しました」のトースト。他の設定と同じページに置くとき）、`backHref`（見出しの戻る先。既定 `afterSaveHref`、`null` のときは `"/mypage/account"`）
- アカウントの画面は門番の機能 `pageMypage` のパス（項目ごとの機能は無い）。マイページごと閉じるなら `pnpm ops features set pageMypage off`。表と API は一覧に関わらず開いたまま

### マイページのメニュー(拡張点 mypageMenu)

マイページのトップのカード（`components/MainMenu`）は受け口 `mypageMenu` の項目から描く。`MainMenu` は props なし。項目は `mypageMenu/items/<key>.ts`（`export const item: MypageMenuItem`）、上の Tier の項目の一部の上書きは `<key>.override.ts`、組み立ては `mypageMenu/buildMypageMenu.ts`（hidden を除く → 操作を結ぶ → order・key 順）。

- 上流の項目: `invite`（10）・`account`（20）・`notifications`（25）・`logout`（30）・`other`（40）。order は 10 刻み、同じ値は key 順
- 項目は 2 形
  - リンク: `{ key, order, icon, title, description, href, showChevron?, variant? }`
  - 操作: `{ key, order, icon, title, description, action: "logout", pendingTitle?, variant? }`。`MainMenu` が `action` を `useLogout` に結び、処理中は `pendingTitle`（無ければ `title`）を出して押せなくする。結び先の無い操作の項目は描かない
- `icon` は lucide のアイコン（`RichMenuCard` と同じ型）。`variant` は `default`・`muted`・`destructive`
- 閉じた機能のパス（招待 = 規則 `mypageInvite`、通知の設定 = 規則 `messagingPreferences`、その他の操作 = 規則 `mypageOther`）のカードは、`RichMenuCard` の棚の Link（`gate="auto"`）が描かない
  - 棚の Link が隠すのは門番の規則が掛かったパスだけ。規則の無いパス（外部リンク・fork の設定で出し分けるだけの画面）の fork 項目は、項目のファイルで静的な設定を読み `hidden: !<設定>` と書く（モジュールの読み込み時に決まる値に限る。フックの結果では隠せない）
- 見え方は認可ではない（各画面と API の守りは別）

**fork が項目を足す**

`src/features/core/user/mypageMenu/items/<key>.ts` に置き `pnpm generate extensions`（名前は印なし、key = ファイル名）。並べたい位置の order を選ぶ（例: 招待とアカウントの間 = 15）。

```typescript
// src/features/core/user/mypageMenu/items/coins.ts
import { CoinsIcon } from "lucide-react";

import type { MypageMenuItem } from "@/features/core/user/types";

export const item: MypageMenuItem = {
  key: "coins",
  order: 15,
  icon: CoinsIcon,
  title: "コイン履歴",
  description: "コインの購入と利用の履歴",
  href: "/mypage/coins",
  showChevron: true,
};
```

**上流の項目を変える・隠す・並べ替える**

上流の項目の隣に `<key>.override.ts` を置き `pnpm generate extensions`。書ける鍵は `hidden`・`order`・`title`・`description`・`icon`・`variant`・`pendingTitle` だけ（それ以外・対象の無い override は `pnpm check extensions` が止める。上流は override を出荷しない）。

```typescript
// src/features/core/user/mypageMenu/items/invite.override.ts — 招待のカードを隠す
import type { MypageMenuItemOverride } from "@/features/core/user/types";

export const override: MypageMenuItemOverride = { hidden: true };
```

```typescript
// src/features/core/user/mypageMenu/items/logout.override.ts — ログアウトを最後にして文言を変える
import type { MypageMenuItemOverride } from "@/features/core/user/types";

export const override: MypageMenuItemOverride = { order: 90, title: "サインアウト", pendingTitle: "サインアウト中..." };
```

- 操作の種類（`action`）は上流が持つ（型 `MypageMenuAction` と `MainMenu` の結び）
- 上書きの型は `MypageMenuItemOverride`（注釈 `: MypageMenuItemOverride` でも `satisfies` でもよい）。リンクの項目に `pendingTitle` を重ねても無視される
- 回帰: `pnpm test src/features/core/user`（`mypageMenu/buildMypageMenu.test.ts`・上流の 4 枚の `mypageMenu/upstreamMenu.test.ts`・上書きの重ね方の型の `mypageMenu/overrideSpread.test.ts`）

### 退会時のクリーンアップハンドラ(拡張点 cleanupHandlers)

1. 対象ドメインの `services/server/` に `UserCleanupHandler` 型 `(userId: string, tx: DbTransaction) => Promise<void>` の関数を作る
2. `src/features/core/user/cleanupHandlers/<名前>.ts` に項目を置き `pnpm generate extensions`:
   `export const handler: UserCleanupItem = { required: true, enabled: () => <フラグ>, run: cleanupOnWithdraw };`

```typescript
// src/features/<domain>/services/server/cleanupOnWithdraw.ts
import type { DbTransaction } from "@/lib/crud/drizzle/types";

export async function cleanupOnWithdraw(userId: string, tx: DbTransaction): Promise<void> {
  // userId に紐づくリソースを tx で後始末する
}
```

required / optional の目安:

- 失敗したときにデータ不整合が起きる → `required`（例: 残高・ポイントのクリア）
- 失敗しても許容できるベストエフォート → `optional`（例: 通知送信、外部 API への連携通知）
- 未処理リクエストのキャンセルのような中間的なものはケースバイケース

> optional でも、ハンドラ内の SQL が失敗すると PostgreSQL のトランザクション自体が aborted 状態になり、後続の処理（監査ログ記録等）も失敗して結局ロールバックされる（`executeCleanup` は SAVEPOINT を張らない）。`tx.transaction(...)`（ネストトランザクション = SAVEPOINT）で囲んだ DB 操作は、失敗してもそこだけ巻き戻る。

### システムの連絡(登録の完了のメール)

本登録の後（`registration/registerFromAuth.ts` → `sendRegistrationCompleteMail.ts`）に、`userConfig.signupMode` で連絡を選んで送る口 `messagingService.sendMessage` でメールアドレスへ送る。失敗しても登録は続く（呼び手が受けてログに出す）。一時の失敗で cron の送り直し待ち（`queued`）になったものは失敗にしない。仕組み: src/features/core/messaging/services/server/sendMessage/README.md。

| 鍵 | 選ぶ条件 | vars |
| --- | --- | --- |
| `user.registrationComplete` | `signupMode` が `earlyRegistration` 以外 | `displayName`・`serviceNameShort`・`siteUrl`（`business.url`、ボタンの行き先） |
| `user.earlyRegistrationComplete` | `signupMode` が `earlyRegistration` | `displayName`・`serviceNameShort`（ボタンなし） |

- 取引の連絡（好みを見ない）。定義 `messages/<名前>.ts`、見た目はひな形 `welcome`（ようこそ、`src/features/core/messaging/layouts/welcome/`。見た目を替える fork はその描き方の `.replace`、文言は上書きの `values`）
- 欄: ロゴ（事業の設定）と `badge` 札 → `heading` お祝いの行 → `thanks` お礼 → 区切り → `guide` 案内 → `button`（あれば）→ 区切り → `footer`。改行はそのまま出す
- 件名と文面の回帰: `pnpm test src/features/core/user/messages`
