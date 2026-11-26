# Wallet ドメイン

## Overview

- 複数種類のアプリ内通貨（ポイント、コイン等）を統一的に管理するウォレット機能
- テーブル: `wallets`（残高）、`wallet_histories`（履歴）、有効期限を使う通貨は `wallet_lots`（ロット）
- 消費し尽くしたロット（`remaining = 0`）は `lotPruneRetentionDays` が過ぎたら増設点 expiryRules の項目 `plugs/expiryRules/walletLotsPrune.ts`（cron `expiry-prune`。有効期限を使う通貨が無ければ何も消さない）が消す
- 通貨種別: `regular_point`、`temporary_point`、`regular_coin`（足すのは設定の `currency`）
- 残高: `balance`（総残高）- `locked_balance`（予約済み）= 利用可能残高
- ウォレットは遅延作成（初回操作時に自動作成）
- 閉じた機能との連携（画面）: 残高・購入画面は相手の入切を `useGate()` で見る。クーポン欄 `CouponInput` はクーポンか決済が閉じていれば描かない・`CurrencyPurchase` は決済が閉じていれば描かない・振込の案内 `ActiveTransferBanner` は決済が閉じていれば出さない
- 決まり（付与の種類・ロックした wallet の渡し方・予約の流れ・取り消し・購入特典・有効期限の導入・監査の範囲）は札 `.claude/rules/items/domains/wallet.md`
- 長さのため分けた文書: `API.md`（データモデル・サービス API・型）、`Extension.md`（通貨・付与の種類・有効期限・特典）、`Internals.md`（トランザクションとロック・予約・監査・ロット・失効通知の仕組み）

## Usage

### 基本操作

```typescript
import { walletService } from "@/domains/core/wallet/services/server/walletService";

// 残高を増やす
await walletService.adjustBalance({
  userId: "user-123",
  walletType: "regular_point",
  changeMethod: "INCREMENT",
  amount: 1000,
  sourceType: "admin_action",
  reason: "キャンペーン付与",
});

// 残高を減らす
await walletService.adjustBalance({
  userId: "user-123",
  walletType: "regular_point",
  changeMethod: "DECREMENT",
  amount: 500,
  sourceType: "user_action",
});

// ウォレット取得（存在しなければ自動作成）
const wallet = await walletService.getWallet(userId, "regular_point");
```

### 予約→確定フロー（ガチャ・購入等）

```typescript
import { db } from "@/lib/drizzle";

await db.transaction(async (tx) => {
  // 1. 残高を予約（ロック）
  await walletService.reserveBalance(
    { userId, walletType: "regular_point", amount: 100 },
    tx,
    { lock: true }
  );

  // 2. 処理実行（ガチャ抽選など）
  const result = await executeGacha();

  // 3. 予約を確定消費
  await walletService.consumeReservedBalance(
    { userId, walletType: "regular_point", amount: 100, sourceType: "user_action" },
    tx
  );
});
```

実装例（ガチャ）:

```typescript
async function playGacha(userId: string, cost: number) {
  return db.transaction(async (tx) => {
    // 1. 残高を予約
    await walletService.reserveBalance(
      { userId, walletType: "regular_point", amount: cost },
      tx,
      { lock: true }
    );

    try {
      // 2. ガチャ抽選
      const prize = await drawPrize();

      // 3. 予約を確定消費
      await walletService.consumeReservedBalance(
        {
          userId,
          walletType: "regular_point",
          amount: cost,
          sourceType: "user_action",
          reason: "ガチャプレイ",
          meta: { gachaId: prize.gachaId },
        },
        tx
      );

      return prize;
    } catch (error) {
      // 失敗時は予約解除
      await walletService.releaseReservation(
        { userId, walletType: "regular_point", amount: cost },
        tx
      );
      throw error;
    }
  });
}
```

### 管理者操作時のユーザー通知

管理画面からの残高変更（`POST /api/admin/wallet/[userId]/adjust`）時と一括付与（`pnpm task wallet:bulk-grant` の notify）時に、ユーザーの受け取り箱へ知らせ（連絡 `wallet.adjustmentNotice`、inApp）を送れる。管理画面の操作は操作タイプ別にフラグで制御:

```typescript
// src/domains/core/wallet/config.ts の既定(fork は src/config/domains/wallet.config.ts で上書き)
{
  notifyOnAdjust: {
    increment: false,  // 増加時に通知
    decrement: false,  // 減少時に通知
    set: false,        // 残高設定時に通知
  },
}
```

- 文面は連絡定義 `plugs/messages/adjustmentNotice.ts`（題「{{currencyLabel}}残高が変更されました」、本文「操作 / 金額 / 残高」の行 + `{{reasonLine}}`）。変える fork は隣に `adjustmentNotice.override.ts` を置く（[messaging README](../messaging/README.md)・src/lib/messaging/README.md）
- 差し込む値は送り手 `services/server/notification/sendAdjustmentNotification.ts` の `adjustmentNoticeVars` が組む: `currencyLabel`（通貨の label）・`methodLabel`（`config.ts` の `adjustmentNotification.changeMethodLabels`、知らない操作はそのまま）・`delta`（符号付きの額）・`balance`（変更後の残高）・`reasonLine`（理由があれば「改行 + 理由: <理由>」、無ければ空）・`amount`（符号なしの額、単位付き。例「1,000 コイン」）・`reason`（理由だけ。見出しも改行も付けない、無ければ空）。`amount` と `reason` は既定の文面では使わず、`adjustmentNotice.override.ts` で文面を組み替える時に読む（例「『{{amount}}』が付与されました。」+ 空行 + 「理由: {{reason}}」）
- 送信の失敗は残高の変更に影響しない（送り手は投げずにログに出す）。取引の連絡なので受信者の好みでは止まらない

### 取引の取り消し

間違えて入れた取引(付与の誤り・一括調整の誤り・交換の巻き戻しなど)を、逆向きの調整で打ち消す。行は消さず、取り消しの行を足す。

- コマンド(運用者): `pnpm task wallet:reverse-history -- --history <行の id>[,<行の id>...] --reason "<理由>"` か `-- --batch <request_batch_id> --reason "<理由>"`(一括操作の 1 回分の全部の行)
  - 先に `--dry-run` で計画(ユーザー・通貨・増減・残高の前後)を確かめてから、外して打つ
  - 本番は `--env production --confirm=production`(書く入口の守り: `scripts/runner/guard/README.md`)
  - 実行は `task_runs` に記録され、取り消す行ごとの止める鍵 `wallet-reverse:<行の id>` で同じ行を二度取り消さない
- サービス: `walletService.reverseHistory({ historyIds | requestBatchId, reason, dryRun }, tx?)`(`services/server/wrappers/reverseHistory.ts`)。管理画面から呼ぶときも同じ関数
- 打ち消し方:
  - INCREMENT の行 → 同じ額の DECREMENT、DECREMENT の行 → INCREMENT(同じ通貨)。書き込みは `adjustBalance`(残高・ロット・履歴・監査 `wallet.balance.adjusted`)
  - 取り消しの行は元の行と同じ `reason_category`・`reason_key` で書く。区分ごと・種類ごとの集計(コイン発行の内訳など)で元の行が打ち消される
  - 取り消しの行の印: `meta.reversesHistoryId` = 元の行の id、`source_type` = `admin_action`、全部の行で 1 つの新しい `request_batch_id`、`reason` = 渡した理由
  - 選んだ行は新しい行から順に戻す(後の操作を先に戻す)。全部を 1 つの transaction で書く(1 行でも止まれば何も書かない)
- 取り消せない(何も書かずに止める): 残高を置き換えた行(SET。逆が後の行に依るので、手で `admin_adjustment` の調整をする)・額 0 の行・取り消しの行そのもの・既に取り消した行・今は書けない区分と種類(消した・付け替えた reason key)・利用可能な残高が足りない DECREMENT(付けた分を既に使った等)
- ロット(有効期限): INCREMENT の取り消しは元のロットではなく古いロットから順に減らす(`consumeLotsFifo`)。DECREMENT の取り消しは今日付けの新しいロットになる
- 他のドメインの状態(購入・クーポンの利用・紹介報酬)は戻さない。wallet の行だけ

### 一括付与と補填

複数のユーザーに同じ額か人ごとの額をまとめて付ける(キャンペーンの付与・障害のお詫び・報酬の配り直しなど)。

- コマンド(運用者): `pnpm task wallet:bulk-grant -- --wallet-type <通貨> --kind grant|compensation (--users <id>[,<id>...] --amount <n> | --file <path> [--amount <既定の額>]) --reason "<理由>" [--notify] [--dry-run]`
  - `--file`: 1 行 `id` か `id,額`(額の無い行は `--amount`)。空行と `#` の行は飛ばす
  - 先に `--dry-run` で人数・合計・飛ばす人を確かめてから、外して打つ。本番は `--env production --confirm=production`
  - 止める鍵: 中身(通貨・種類・理由・ユーザーと額の組)から 1 つ `wallet-grant:<hash>`。同じ付与を二度打つと拒否する(意図して同じ物をもう一度付けるなら理由を変える)
  - 間違えた付与は束ごと取り消す: `pnpm task wallet:reverse-history -- --batch <結果の requestBatchId> --reason "<理由>"`(上の「取引の取り消し」)
- サービス: `walletService.bulkGrant({ walletType, grants: [{ userId, amount }], kind, reason, notify?, dryRun })` → `{ requestBatchId, granted, skipped, total, notified, notifyFailed }`。管理画面から呼ぶときも同じ関数
- 管理の API: `POST /api/admin/wallet/bulk/grant`(管理者のみ、門 wallet、body = サービスの引数 `{ walletType, kind, grants, reason, notify?, dryRun? }`、戻り値 = サービスの結果)。1 回は `userConfig.bulkUpdate.maxIds` 人まで(既定 1000、超えると 400。多い時は画面側で分けて送る。束ごとに requestBatchId が分かれる)。上流は画面を作らない: fork が画面から dry-run → 確かめ → 本番の順に呼ぶ
- 画面から: `useBulkGrantWallet().trigger({ walletType, kind, grants, reason, notify?, dryRun? })`(`walletClient.bulkGrant` を上限ずつの束に分けて順に送り、結果をまとめて返す。束ごとに request_batch_id が分かれるので結果は `requestBatchIds`。途中の束の失敗は `ChunkRunError`(`@/utils/runInChunks`)= 何束目まで済んだかと済んだ束の結果。まとめは `mergeBulkGrantResults`)
- 一括操作の部品: `bulkWalletGrantAction(meta, options?)`(`@/domains/core/wallet/components/AdminWalletBulkGrantAction`)= 通貨・種類・全員に同じ額・理由・知らせ → 確かめる(dryRun)→ 実行の小窓つきの `BulkActionItem`(人ごとの額は hook を直に使う)。上流は項目を差さない。fork は利用者一覧の項目を自分のドメインの `plugs/adminBulkActions/<名前>.tsx` に置き(`domain: "user"` で利用者の一覧を名指す)、門 wallet で出し分ける:

```tsx
// <fork のドメイン>/plugs/adminBulkActions/walletGrant.tsx
export const bulkAction: UserAdminBulkActionItem = { ...bulkWalletGrantAction<User, AdminBulkActionAccess>({ key: "walletGrant", lists: ["general"], order: 40 }), feature: "wallet", domain: "user" };
```
- 書き方: 全員を 1 つの transaction で `bulkAdjustByUsers` に通す(額ごとにまとめる、INCREMENT、`source_type` admin_action、1 つの `request_batch_id`、監査 `wallet.balance.bulk_adjusted_by_users` は額の組ごと)。1 人でも書けなければ全部戻す
- 種類: `grant` = 付与の種類 `admin_adjustment`、`compensation` = `compensation`。区分はどちらも `admin_adjustment`(発行には数えない)
- 飛ばす: 知らない id・削除済みのユーザー。先に止める: 額が正の整数でない・同じユーザーが 2 回・空・1 回 10,000 人超え(1 つの transaction で財布を行ロックするため。ファイルを分ける)・知らない通貨・理由なし
- `--notify`: commit の後に 1 人ずつ残高変更の inApp の知らせ(`sendAdjustmentNotification`、inApp が閉じていれば送らない)。送れなくても付与は戻さない
- もっと大きな相手(全員・条件で選ぶ)は今までどおり一括の job(`createWalletBulkAdjustJob`)。このコマンドは id の並びだけを受ける

### 失効間近の照会（失効予告 UI・通知のデータソース）

失効予告の UI はダウンストリームで作る。通知は組み込みの失効通知（設定だけで送れる、`Extension.md`「失効通知の設定」）か、下のデータレイヤ（`API.md`「失効通知のデータレイヤ（独自の通知を組む）」）で自前に組む。

```typescript
// サーバー: 本人の失効間近ロット（失効日ごとに集約）
const { lots, totalExpiring } = await walletService.getExpiringLots(userId, "regular_coin", 30);

// サーバー: 複数ユーザーの失効間近合計（通知バッチ用）
const summaries = await walletService.getExpiringSummaryByUsers(userIds, "regular_coin", 7);

// クライアント: 本人の失効間近残高（/api/me/wallet/expiring）
const { data } = useMyExpiringLots(userId, "regular_coin", 30);
// data: { lots: [{ expiresAt, amount }], totalExpiring, withinDays }
```

UI レシピ例（ダウンストリームで実装）:
- 残高ページに「うち ○○ コインが ○月○日 に失効します」バナー → `useMyExpiringLots` の `lots[0]`
- 失効前・失効後のユーザー通知 → `Extension.md`「失効通知の設定」（設定だけで送れる）

### 管理機能

#### 管理API

```
POST /api/admin/wallet/{userId}/adjust
```

```json
{
  "walletType": "regular_point",
  "changeMethod": "INCREMENT",
  "amount": 5000,
  "reason": "キャンペーン補填",
  "meta": {
    "orderId": "ORDER-1234",
    "notes": "特別対応"
  }
}
```

#### 管理UIコンポーネント

```typescript
import { AdminWalletAdjustModal } from "@/domains/core/wallet/components/AdminWalletAdjustModal";
```

## API

- データモデル・サービス API・型のエクスポート・履歴のメタ情報・失効通知のデータレイヤ API は `API.md`

## Extension

- 通貨設定・付与の種類（reason key）・有効期限の導入と運用ルール・失効通知の設定・購入の特典の表示（拡張点 walletPurchaseBonuses）は `Extension.md`

## Internals

- トランザクション統合・残高予約フロー・監査ログのポリシー・有効期限（ロット管理）・失効通知の挙動と送信量・トラブルシューティングは `Internals.md`

## Verification

- 購入の特典: `pnpm test src/domains/core/wallet`（`hooks/usePurchaseBonuses.test.ts`・`hooks/usePurchaseBonuses.render.test.tsx`・`components/WalletBalance/purchaseBonusParts.test.tsx`）
- 付与の種類の静的な検査: `pnpm test src/domains/core/wallet/services/server/wrappers/reasonKey.test.ts`
- ロットの復元・対象通貨: `pnpm test src/domains/core/wallet/utils/lotPlanning.test.ts`・`utils/expiration.test.ts`
- 文面: `pnpm test src/domains/core/wallet/messages`
- 失効通知の送信処理: `pnpm test src/domains/core/wallet/services/server/notification/expirationNoticeSender.test.ts`

## Related

- [purchaseRequest ドメイン（コイン購入の決済フロー・外部決済連携）](../purchaseRequest/README.md)
- walletHistory ドメイン（付与の種類の点 walletHistoryReasonKeys・backfill）: `src/domains/core/walletHistory/`
- 監査の判断軸の横展開: [auditLog/README.md](../auditLog/README.md)
