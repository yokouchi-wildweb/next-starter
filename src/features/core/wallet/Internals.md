# Wallet ドメイン — Internals

## Overview

- `README.md` の Internals の節を分けた文書（トランザクションとロック・残高予約・監査の範囲・ロット・失効通知の仕組み）。決まりは札 `.claude/rules/items/features/wallet.md`

## Internals

### トランザクション統合

#### 外部トランザクションとの統合

全ての操作関数は `tx?: TransactionClient` を受け取り、外部トランザクションに参加可能。

```typescript
import { db } from "@/lib/drizzle";
import type { TransactionClient } from "@/features/core/wallet";

await db.transaction(async (tx: TransactionClient) => {
  // 複数操作を1トランザクション内で実行
  await walletService.adjustBalance(params1, tx);
  await walletService.adjustBalance(params2, tx);
  await someOtherService.doSomething(tx);
});
```

#### 単独実行

`tx` を渡さなければ内部で新規トランザクションが作成される。

```typescript
// 単独で実行（内部でトランザクション作成）
await walletService.adjustBalance(params);
```

#### 行ロック（lock オプション）

競合を防ぐため `SELECT FOR UPDATE` で行ロックを取得。

```typescript
// 行ロック付きで操作
await walletService.adjustBalance(params, tx, { lock: true });
await walletService.reserveBalance(params, tx, { lock: true });
```

- `debitBalance` は wallet を渡さなければ常に行ロックで読む（`lock` オプションなし）
- `adjustBalance` / `reserveBalance` / `consumeReservedBalance` / `debitBalance` は取得済みの `wallet` を受け取れる（再取得せず、`lock` も見ない）
- `wallet` を渡す契約: 呼び出し元が同じトランザクション内でその行のロックを保持していること。ロックなしで読んだ値を渡すと更新が失われる（実行時の検査はない）
- `releaseReservation` は `wallet` を使わない

### 残高予約フロー

#### 概念

```
balance: 1000, locked_balance: 0
    ↓ reserveBalance(300)
balance: 1000, locked_balance: 300  ← 利用可能: 700
    ↓ consumeReservedBalance(300)
balance: 700, locked_balance: 0     ← 確定消費完了
```

#### 利用可能残高

```
利用可能残高 = balance - locked_balance
```

#### フロー図

```
┌─────────────────────────────────────────────────────────┐
│                    予約→確定フロー                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. reserveBalance      locked_balance += amount        │
│         ↓                                               │
│  2. 処理実行            （ガチャ、購入処理など）           │
│         ↓                                               │
│  3a. consumeReserved    balance -= amount               │
│      Balance            locked_balance -= amount        │
│                                                         │
│  3b. releaseReservation locked_balance -= amount        │
│      （失敗時）          （balance は変更なし）           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 監査ログ（audit_logs）ポリシー

ウォレットには「**業務台帳としての wallet_histories**」と「**統制ログとしての audit_logs**」の **2 系統**の記録があり、責務が異なる。混同しないこと。

#### 役割の違い

| 観点 | `wallet_histories` | `audit_logs` |
|------|-------------------|-------------|
| 目的 | 財務台帳（残高変動の元帳） | 統制・コンプラ・セキュリティトレイル |
| 何を残すか | 残高の前後値・delta・通貨種別・request_batch_id | 誰が（actor_type / actor_id / IP / UA / request_id）何をしたか |
| 対象 | **全ての残高変動** | **介入操作のみ** |
| 保持期間 | 業務上の要件で決定（通常は無期限） | retention_days で行単位制御（既定 365 / wallet は 730 日） |

#### 「介入 (intervention)」と「業務 (business)」の判断軸

audit_logs に載せるのは **「介入」操作のみ**。「業務」操作は載せない。

**「介入」として audit に載せる**:

- 管理者が業務フロー外で手動操作する（actor_type=admin、admin 専用 API 経由）
- ポリシーを曲げる・緊急対応・手動修正・ユーザーの財産に直接介入する操作

**「業務」として audit に載せない**:

- システム設計通りに自動実行される高頻度処理（ガチャ消費、購入決済確定など）
- ユーザー操作の正常系（actor_type=user による課金・消費）
- 既に `wallet_histories` で財務的に追跡できているもの

**迷ったときの判断**:

- その関数が **admin から呼ばれる前提が 1 つでもあるか?** → Yes なら「介入」→ audit に載せる
- 同じ関数が admin / system 両方から呼ばれる場合: **載せる（actor_type で後から区別可能）**
- 件数規模が大きい bulk 介入は `aggregate` モード（1 ジョブ 1 行）で集約記録する

#### ウォレット操作の対応一覧

| 操作 | 用途 | wallet_histories | audit_logs | action |
|------|------|------------------|-----------|--------|
| `adjustBalance` | **管理者による残高調整** | ✅ 記録 | ✅ 記録（介入） | `wallet.balance.adjusted` |
| `bulkAdjustByType` | **管理者による通貨種別単位の一括調整** | ✅ 記録（detail） | ✅ 1 行集約（aggregate） | `wallet.balance.bulk_adjusted_by_type` |
| `bulkAdjustByUsers` | **バッチジョブによるユーザー指定一括調整** | ✅ 記録（detail） | ✅ チャンク単位 1 行集約 | `wallet.balance.bulk_adjusted_by_users` |
| `clearBalance` | **ソフトデリート時の残高クリア** | ✅ 記録 | ✅ 記録（介入） | `wallet.balance.cleared` |
| `reserveBalance` | 残高予約（ロック） | — (残高変動なし) | ❌ 業務扱い | — |
| `releaseReservation` | 予約解除 | — (残高変動なし) | ❌ 業務扱い | — |
| `consumeReservedBalance` | 予約消費（購入決済確定など） | ✅ 記録 | ❌ 業務扱い | — |
| `debitBalance` | TX 内即時引落（クーポン適用など） | ✅ 記録 | ❌ 業務扱い | — |

#### なぜ consume/debit を audit に載せないか

ガチャプレイ・購入決済確定などは高頻度な **業務フロー**であり、これを audit に載せると:

- 単位時間あたりの audit_logs 書き込みが爆発し、ストレージ・I/O コストが増大する
- 「介入」を検索するときに「業務」イベントに埋もれて統制目的が果たせなくなる
- ダウンストリーム側で既にドメイン履歴（ガチャプレイ履歴、購入履歴）を持っているケースが多く、三重記録になる

**業務イベントは `wallet_histories` とドメイン履歴で十分に追跡できる。audit はあくまで「介入」専用。**

#### 保持期間（retention_days）

ウォレット系 audit は **730 日（2 年）** を採用。コンプライアンス対象ドメインとしての推奨値（[auditLog/README.md](../auditLog/README.md) 参照）。

各 wrapper 内で `WALLET_AUDIT_RETENTION_DAYS = 730` として定数化されている。

#### 横展開：他ドメインで判断するとき

同じ「介入 vs 業務」の判断軸は他のドメイン（`userItem`、`couponGrant`、`subscription` 等）でも適用できる。詳しくは [auditLog/README.md](../auditLog/README.md) を参照。

### 有効期限（ロット管理）

#### 仕組み

付与単位の台帳（`wallet_lots`）+ FIFO 消費によるロット会計。

- 付与（INCREMENT）のたびにロットを1本作成: `remaining = 付与額`, `expires_at = 付与時刻 + expirationDays`
- 消費（DECREMENT）のたびに失効日が近いロットから順（FIFO）に `remaining` を減算
- SET は取得時期の情報を破壊するため、全ロットを「現在取得扱い」の1本に置き直す（re-baseline）
- 不変条件: `SUM(wallet_lots.remaining) = wallets.balance`（全6経路の残高変更が同一TX内でロットを更新して維持）
- 失効スイープ（cron）が期限切れロットの残額を没収し、`wallet_histories`（reason_category: `expiration`）と audit に記録

残高が頻繁に増減しても、消費は常に最古ロットから引かれるため、失効するのは「本当に expirationDays の間使われずに残った分」だけ。

#### 数え方（expirationBasis）

通貨ごとに失効日の数え方を選べる。省略時は `"grant"`。

```typescript
// 付与ごと（既定）: 付与ごとに「付与時刻 + 180日」で失効する
regular_coin: { expirationDays: 180, sweepEnabled: true },

// 最後の残高変更から: 180日の間、残高が変わらなければ残高全額が失効する
regular_point: { expirationDays: 180, expirationBasis: "lastActivity", sweepEnabled: true },
```

| | `"grant"`（既定） | `"lastActivity"` |
|---|---|---|
| 失効する単位 | 付与ごと（古い付与から順に） | 残高全額 |
| 失効日 | 付与時刻 + expirationDays | 最後の残高変更 + expirationDays |
| 入金を続けて使わないユーザー | 古い付与から失効する | 入金のたびに全額の失効日が延びる |

`"lastActivity"` の決めごと:
- **残高変更に数えるもの**: 付与（INCREMENT）・消費（DECREMENT / debit / 予約分の消費）・SET。一括操作（bulkAdjust*）も同じ。
  これらはロット会計と同じ TX で、残っている全ロットの `expires_at` を「その時刻 + expirationDays」に揃える
- **数えないもの**: 予約（reserve）と予約解除（release）は残高を変えないので数えない。**失効スイープ自身の没収も数えない**
  （スイープはロット会計を通らないので、没収で失効日が延びることは無い）。`skipHistory` の有無は関係ない
- **ロットの形**: 付与は新しいロットを作らず、残っているロットに足し込む。残っているロットはウォレットあたり1本以下になり、
  延長の UPDATE は1行で済む。足し込んだロットの `granted_amount` は付与額の累計（付与ごとの額は `wallet_histories` にある）
- **失効間近の照会・失効通知・スイープ**は数え方によらず同じに動く。失効日が延びた場合、予告は新しい失効日に対して改めて届く
  （予告の冪等性は失効日ごとのため）
- **locked_balance 保護との関係**: 予約中で失効しきれなかった分は期限切れロットに残り、次の残高変更（予約分の消費を含む）で失効日が延びる
- **初期化**: `wallet:lots-init` は数え方によらず「実行日 + expirationDays」の1本を作る。
  `wallet:lots-init-from-history` は残高全額を「最後の残高変更 + expirationDays」の1本にする
  （直近 expirationDays の `wallet_histories` から、失効の没収（reason_category: `expiration`）を除いた最新の行を使う。
  範囲内に行が無ければ全額が期限を過ぎた分になる）
- **運用中の通貨で数え方を切り替える**: ロットの作り直しは要らない。`"grant"` → `"lastActivity"` では、
  切り替え後の最初の残高変更で残っている全ロットの失効日が揃う（それまでは元の失効日のまま）。
  切り替え時点から揃えたい場合はその通貨を `--wallet-type` で指定して初期化をやり直す（運用ルールの「再実行」の注意を参照）。
  `"lastActivity"` → `"grant"` は、残っているロットが次の付与から付与ごとの扱いに戻る

### 失効通知の挙動

#### 挙動の決めごと

- **スイープとは別の cron で送る**。送信は外部通信で時間がかかるため、没収の実行時間とウォレット行ロックに影響させない。
  失効の per-user 記録は同一TXで `wallet_histories` に書かれており、通知はそれを後から読む（取りこぼさず、再実行できる）
- **同じ対象には1回しか届かない**（`message_dispatches` の冪等性キー）。cron の実行が重なっても、途中で中断して
  やり直しても二重送信にならない
- **本通知を後から有効化しても、過去の失効分はさかのぼって送らない**（初回実行は開始位置を記録するだけ）
- **予告は暦日単位**。同じ日に失効するロットはその日の合計額として1通にまとまる。cron が止まっていた日があっても、
  次回実行が止まっていた分をまとめて回収する
- **予告の段を追加・有効化した初回**は、各段が自分の帯だけを担当する。例: 30日前と7日前の段があり3日後に失効する
  ロットがある場合、届くのは7日前の段の通知だけ（有効化当日に全段ぶんが一斉に届くことはない）
- **送らない相手**: `targetStatuses` に無いステータス（退会・停止・仮登録など）/ demo ユーザー。
  メール未登録のユーザーには `inApp` が指定されていればそれだけ送り、送れるチャネルが無ければスキップする
- **送信に失敗した通知は再実行しても再送されない**（冪等性キーの行が送信前に作られるため）。
  `message_dispatches` に失敗として残るので運用で確認する。メール基盤の障害で失敗が連続した場合は、
  その実行を打ち切って損失を抑える（cron のレスポンスが `aborted: true` になる）
- 通知は失効履歴1行につき1通。同じ夜に2通貨が失効すれば2通届く（まとめない）

#### 送信量の目安

実測値（下流のテスト環境、ローカル → Neon + SendGrid。**`sendConcurrency: 5` で 8 件・2 スライスのみの小標本。参考値として扱うこと**）:

- 接続が温まった状態の1件あたり **約 0.65〜0.7 秒**（メール + サービス内通知、サービス内通知のみのどちらも同程度）
- 5 件のスライス1回の周期は約 1.7 秒（送信 約 0.7 秒 + スライス間 約 1 秒。スライス間の内訳は未特定）
- 実行の最初のスライスには DB 接続の確立で約 1.3 秒が上乗せされる（1回の実行につき1度だけ）
- 並列送信の動作は確認済み（送信 8 件 / 失敗 0 件 / 重複なし。チェックポイントを巻き戻して再実行しても二重送信なし）

1件の送信は「送信記録の作成 → メール基盤への通信 → 通知レコード作成 → 記録の確定 → 監査ログ」を順に行うため、
件数あたりの時間はこれ以上短くならない。本番（DB と同一リージョン）ではこれより速い見込みだが未計測。
3 スライス以上での伸び方も未計測のため、下の表は規模が大きいほど誤差が出る前提で読むこと。

> 以前ここに載せていた「1ユーザーあたり 1.7〜3.9 秒」は 3 件だけの計測で、DB 接続の確立時間を含んだ過大な値だった。

1回の実行の時間予算は 240 秒。上の実測からの推定値:

| sendConcurrency | 1回の実行 | 毎時実行 | 15分ごと |
|---|---|---|---|
| 1（計算値・未計測） | 約 140〜340 件 | 約 3,400〜8,200 件/日 | 約 13,000〜33,000 件/日 |
| 5（既定） | 約 700 件 | 約 17,000 件/日 | 約 67,000 件/日 |

- 5 の行はスライス周期 約 1.7 秒からの推定（240 秒 ÷ 1.7 秒 × 5 件）
- 1 の行は実測が無い。1件 約 0.7 秒に、スライス間の約 1 秒が毎回かかる場合を下限、かからない場合を上限とした計算値

- 調整は `sendConcurrency` と cron の実行間隔の2つで行う（cron を予告用と本通知用に分けても処理量は変わらない）。
  `sendConcurrency` はメール基盤の流量制限と DB の同時接続数に収まる範囲で上げる
- **`wallet:lots-init` の直後は既存の全残高が同じ日に失効するロットになる**ため、最初の失効日（init から
  expirationDays 日後）に通知が全ユーザーぶん集中する。ユーザー数が数万規模なら、既定値のままでは送りきるのに
  数日かかる。**失効日を迎える前に `sendConcurrency` の引き上げと実行間隔の短縮を済ませておくこと**
- 本通知は数日かけて送りきっても実害は小さいが、予告は段の日数が猶予の上限になる（1日前の段は1日で送りきる必要がある）
- 1日に数十万件を超える規模はこの仕組みの対象外。外部のキューや一括送信 API が必要

#### 有効期限の実装ファイル

- ロット会計（全経路から呼ばれる）: `services/server/lots/lotAccounting.ts`
- 失効スイープ: `services/server/lots/sweepExpiredLots.ts`
- 初期化（導入日から数える）: `services/server/lots/initWalletLots.ts`
- 初期化（実際の付与日から数える）: `services/server/lots/initWalletLotsFromHistory.ts`
  （復元ロジックの純粋関数: `utils/lotPlanning.ts` / テスト: `pnpm test src/features/core/wallet/utils/lotPlanning.test.ts`）
- 初期化の対象通貨の決定: `utils/expiration.ts` の `resolveWalletLotsInitTypes`（テスト: `pnpm test src/features/core/wallet/utils/expiration.test.ts`）
- 照会: `services/server/lots/getExpiringLots.ts`
- 失効通知の cron 本体: `services/server/notification/sendWalletExpirationNotices.ts`
  （予告: `sendPreExpiryNotices.ts` / 本通知: `sendExpiredNotices.ts` / 共通の送信処理: `expirationNoticeSender.ts`、テスト `expirationNoticeSender.test.ts`）
- 文面: `messages/expiringNotice.ts`・`expiredNotice.ts`・`adjustmentNotice.ts`（テスト: `pnpm test src/features/core/wallet/messages`）
- 通知用の対象抽出: `services/server/lots/findUsersWithExpiringLots.ts`
- 通知用のスイープ結果照会: `services/server/lots/listExpirationResults.ts`
- 消費済みロットの prune: `services/server/lots/pruneConsumedLots.ts`
- 設定: `src/features/core/wallet/config.ts` の `expiration`

### トラブルシューティング

#### Q. API呼び出しで500エラーが返る

サーバーログの `DomainError` を確認。よくある原因：
- 残高不足（409）
- バリデーションエラー（400）
- DB接続エラー（500）

#### Q. 残高が更新されない / 表示が古い

- SWRの `revalidateKeys` を確認
- `mutate()` でキャッシュを手動更新

#### Q. 「残高が不足しています」エラー

利用可能残高 = `balance - locked_balance` を確認。
予約中の残高がある場合、見かけ上の残高より少なくなる。

#### Q. 大量更新時のパフォーマンス

- `meta` の頻出キーにGINインデックスを追加
- `request_batch_id` で絞り込んでから `meta` で検索
