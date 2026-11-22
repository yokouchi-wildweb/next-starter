# Wallet ドメイン — Extension

## Overview

- `README.md` の Extension の節を分けた文書（通貨設定・付与の種類・有効期限の導入・失効通知の設定・購入の特典の表示）。決まりは札 `.claude/rules/items/features/wallet.md`

## Extension

### 通貨設定

#### 設定ファイル

通貨の既定は **`src/domains/core/wallet/config.ts` の `currency`**。fork は上書き **`src/config/domains/wallet.config.ts`** で値を変え、通貨を足す(アイコンは `config.ui.ts` の `currencyIcons`、上書き `src/config/domains/wallet.ui.config.ts`)。呼び手は `walletConfig.currency` を読む。

```typescript
// src/config/domains/wallet.config.ts(fork の例: 通貨を 1 つ足す)
import type { CurrencyConfig } from "@/domains/wallet";
import type { WalletOverride } from "@/domains/wallet/config";

export type Extra = { currency: { premium_ticket: CurrencyConfig } };

export default {
  currency: {
    premium_ticket: {
      slug: "premium-ticket",  // URLパス用（/wallet/premium-ticket）
      label: "プレミアムチケット", // 表示名
      unit: "枚",               // 単位
      color: "#8B5CF6",         // テーマカラー
      packages: [{ amount: 1, price: 300 }], // 購入パッケージ
      metaFields: [],           // 管理画面の補足入力フィールド
    },
  },
  expiration: { premium_ticket: { expirationDays: null, sweepEnabled: false } },
} satisfies WalletOverride<Extra>;
```

Extra に書いた型は、既定の型と深く合成されてそのまま残る(`src/lib/defineConfig/README.md`「Extension」)。足す通貨は `CurrencyConfig` に限らず、自分の型で書ける:

- 足した欄やリテラル型を後で型で読む通貨は、その型ごと書く。例: チケット通貨 `export type Extra = { currency: { premium_ticket: CurrencyConfig & { isTicket: true } } };` → fork のコードの `(typeof walletConfig.currency)[K] extends { isTicket: true }` が効く(`CurrencyConfig` だけで書くと `isTicket` が消え、チケットの種別の型が never になる)
- 古い設定から移すときは、通貨のキーを手で数えずにコマンドで書き出し、全部を Extra と値に写す。移した後の確かめ: `npx tsx -e 'import("./src/domains/core/wallet/config.ts").then((m) => console.log(Object.keys(m.walletConfig.currency).join("\n")))'`


購入の制限 `purchaseRestriction`(`"none"` | `"phoneVerified"`、上流の既定 `"none"`):

- `"phoneVerified"` は SMS 認証済みの利用者だけが購入できる
- SMS 認証の機能 `phoneVerification` を要するので、config.ts の `featureRequirements` で宣言し、機能が閉のままなら門 build の `pnpm check proxies` が失敗する(直し方: `pnpm ops features set phoneVerification on` か上書きに `"none"`)
- サーバーでも強制する: 財布に入金する購入(purchaseRequest の type 設定 `requiresWalletType`)の開始・再利用・再開で `initiatePurchase` が `assertWalletPurchaseAllowed`(`services/server/wrappers/purchaseRestriction.ts`)を呼び、必須で未認証なら 403
- 財布を通らない購入(direct_sale 等)は止めない
- 画面(`WalletBalance`)は表示のためだけに同じ値を読む

#### 設定項目

| 項目 | 必須 | 説明 |
|------|------|------|
| `slug` | ✓ | URLパス用識別子 |
| `label` | ✓ | UI表示名 |
| `unit` | ✓ | 数値の単位（"pt", "コイン"など） |
| `color` | ✓ | テーマカラー（HEX） |
| `icon` | - | アイコンは `config.ui.ts` の `currencyIcons`(通貨と同じキー) |
| `packages` | ✓ | 購入パッケージ配列 |
| `metaFields` | ✓ | 管理画面用の補足フィールド（空配列可） |

#### metaFields

管理画面でのポイント調整時に入力できる補足フィールド。

```typescript
metaFields: [
  {
    name: "productId",        // フィールド名（meta.productIdとして保存）
    label: "商品ID",          // 表示ラベル
    formInput: "textInput",   // "textInput" | "textarea"
    placeholder: "例: ITEM-001",  // プレースホルダー（任意）
    description: "説明文",        // フィールド説明（任意）
    rows: 2,                      // textarea時の行数（任意）
  },
]
```

#### ユーティリティ関数

```typescript
import {
  getCurrencyConfig,
  getCurrencyConfigBySlug,
  getWalletTypeBySlug,
  getSlugByWalletType,
  getMetaFieldsByWalletType,
  isValidSlug,
} from "@/domains/core/wallet/utils/currency";

// walletType から設定取得
getCurrencyConfig("regular_point");

// slug ↔ walletType 変換
getWalletTypeBySlug("point");         // → "regular_point"
getSlugByWalletType("regular_point"); // → "point"

// metaFields 取得
getMetaFieldsByWalletType("regular_coin");
// → [{ name: "productId", ... }, { name: "notes", ... }]
```

### 付与の種類（reason key）

区分（`reason_category`: bonus / admin_adjustment …）より細かい「どの施策の付与か」を、機械向けの名前で行に持たせる（管理画面のコイン創出の施策ごとの内訳に使う）。集計の軸の決まりは札 reason_key。

- **施策を足す = 種類の項目 1 つ + 書き込みで `reasonKey` を渡す**:
  1. `src/domains/core/walletHistory/reasonKeys/<名前>.ts` に `export const reasonKey: WalletReasonKeyItem = { key, label, category, sortOrder? }` → `pnpm generate extensions`（型: `walletHistory/types/reasonKey.ts`。key の重複は一覧の読み込みで例外）
  2. 書き込み（`adjustBalance` / `consumeReservedBalance` / `debitBalance` / `bulkAdjustByType` / `bulkAdjustByUsers` / `createWalletBulkAdjustJob`）で `reasonKey: "<key>"` を渡す
- **区分は種類から決まる**: `reasonKey` を渡せば `reason_category` は項目の `category`。`reasonCategory` も渡して食い違う・未登録の key は書き手の誤りとして `DomainError` 500（`code: wallet_reason_key_mismatch | wallet_reason_key_unknown`）
- `reasonKey` なしは今まで通り（`reasonCategory ?? "other"`、`reason_key` は null）
- **requiresKey**: 区分の config の `requiresKey: true`（上流の既定 = `bonus`）の書き込みに `reasonKey` が無いと `console.warn`（書き込みは止めない）。上流のコードは `pnpm test src/domains/core/wallet/services/server/wrappers/reasonKey.test.ts` の静的な検査で必ず渡す
- **管理者の調整**: `/api/admin/wallet/[userId]/adjust`・`bulk/adjust-by-type` は `reasonKey` を受ける。省略して区分も省略（または `admin_adjustment`）なら固定キー `admin_adjustment`。他の区分を選んだ調整は種類なし。未登録の key は 400
- 上流の項目: `coupon_attribution_reward`（bonus、クーポン帰属報酬の付与）・`admin_adjustment`（admin_adjustment、管理者の調整）・`compensation`（admin_adjustment、お詫び・補填。書き手 = 一括付与 `--kind compensation`。発行には数えない。返金 refund は本物の返金のために空けておく）
- **過去の行に種類を埋める**（冪等・時間予算付き・dry-run あり）: `backfillWalletReasonKeys(rules, { dryRun, deadline?, chunkSize? })`（`walletHistory/services/server/reasonKeyBackfill.ts`）
  - 規則 = `{ key, reasonPatterns, fromCategories?, includeNullReason? }` の配列（種類の項目には持たせない: 1 回きりの移行の物）。対象 = `reason_key IS NULL` かつ区分が `fromCategories`（既定 = 種類の category）かつ `reason` がどれかの LIKE（`%` は規則に書く）に一致
  - 2 つ以上の規則に一致する行は書かずに `conflicts` に数える。`unmatchedRequiresKey` = requiresKey の区分で種類の無いまま残る行
  - 上流の分: `pnpm task walletHistory:reason-key-backfill -- --dry-run` → dry-run なしで実行（締切で止まったら再実行で続きから）。規則 `UPSTREAM_REASON_KEY_BACKFILL_RULES`（クーポン帰属報酬・管理者の調整）
  - fork の分: fork 自身のドメインの 1 回きりの移行 `src/domains/<ドメイン>/scripts/migrations/<名前>.ts` で自分の規則を渡す（済んだら消してよい。書き方: `src/lib/task/README.md`）
  - **区分の書き換え**は fork が明示して選ぶ別のやり方: `fromCategories` に別の区分（reason_category の導入前は全部 `other`）を入れると、その行の区分も種類の category に書き換わり、**過去の期間の合計（コイン創出の `wallet_bonus_grant` など）が変わる**。dry-run の `categoryRewrites` で件数を見てから流す
  - 文の解釈（LIKE）はこの移行の中だけ。集計の時に `reason` を解かない

```ts
// fork: src/domains/campaign/scripts/migrations/reason-key-backfill.ts（fork のドメイン campaign の 1 回きりの移行）
import type { OneShotTask } from "@/lib/task";
export const task: OneShotTask = {
  name: "campaign:reason-key-backfill",
  run: async () => {
    const { backfillWalletReasonKeys } = await import("@/domains/core/walletHistory/services/server/reasonKeyBackfill");
    return backfillWalletReasonKeys(
      [
        { key: "rank_bonus", reasonPatterns: ["ランクボーナス:%"] },
        { key: "signup_bonus", reasonPatterns: ["新規登録ボーナス"], fromCategories: ["bonus", "other"] }, // 区分も直す（過去の合計が変わる）
      ],
      { dryRun: process.argv.slice(3).includes("--dry-run") },
    );
  },
};
```

- 列 `reason_key` に index は置かない: 集計は `type`・`reason_category`・`created_at` で絞ってから GROUP BY する（既存の `(reason_category, created_at)` で足りる）。遅いと分かったら CONCURRENTLY で足す

```ts
// src/domains/core/walletHistory/reasonKeys/rankBonus.ts（fork の施策）
import type { WalletReasonKeyItem } from "@/domains/core/walletHistory/types/reasonKey";
export const reasonKey: WalletReasonKeyItem = { key: "rank_bonus", label: "ランクボーナス", category: "bonus" };

// 書き手
await walletService.adjustBalance(
  { userId, walletType: "regular_coin", changeMethod: "INCREMENT", amount, sourceType: "system", reason: `ランクボーナス: ${tierLabel}`, reasonKey: "rank_bonus" },
  tx,
);
```

### 有効期限の導入（ダウンストリーム）

- 「コインは取得から180日で失効」のような有効期限を通貨単位で有効化できる。デフォルトは全通貨で無効で、無効な通貨では一切の挙動変化がない（ロットテーブルへの書き込みもゼロ）。仕組みは `Internals.md`

1. `src/domains/core/wallet/config.ts` の `expiration` で対象通貨を有効化:
   ```typescript
   regular_coin: { expirationDays: 180, sweepEnabled: true },
   ```
2. デプロイ後**すぐに**初期化を1回実行する。方式は2つあり、**どちらか一方だけ**を実行する。
   対象通貨の指定は**必須**: `--wallet-type <通貨>`（繰り返し・カンマ区切り可）で指定した通貨だけ、`--all` でロット管理が有効な全通貨
   （どちらも無いと使い方を出して止まる。存在しない通貨・`expirationDays: null` の通貨を含む指定は何も書き込まずに止まる）:

   | 方式 | タスク | 既存残高の扱い | 導入直後の失効 |
   |---|---|---|---|
   | 導入日から数える | `wallet:lots-init` | 全額を「実行日取得扱い」の初期ロット1本に変換 | expirationDays の間は何も失効しない |
   | 実際の付与日から数える | `wallet:lots-init-from-history` | 付与履歴（`wallet_histories`）からロットを復元 | 既に expirationDays を超えて残っている分は次回スイープで没収される |

   ```bash
   # 導入日から数える
   pnpm task wallet:lots-init -- --wallet-type regular_coin

   # 実際の付与日から数える（先に dry-run で対象件数と没収見込み額を確認する）
   pnpm task wallet:lots-init-from-history -- --wallet-type regular_coin --dry-run
   pnpm task wallet:lots-init-from-history -- --wallet-type regular_coin
   ```
   **注意**: config 有効化から初期化完了までの間、その通貨の消費はロット不整合エラー（500）になる（どちらの方式でも同じ。
   影響は初期化を待っている通貨だけ）。低トラフィック帯に実施するか、メンテナンスモードを併用すること。

   **運用中の構成に通貨を足す**（すでに別の通貨で失効を運用している）場合は、**足した通貨だけを `--wallet-type` で指定する**。
   `--all` は運用中の通貨のロットも作り直し、その通貨の全ユーザーの失効カウントが実行日から数え直しになる
   （失効間近だった残高も expirationDays 延びる）。手順は 1 → デプロイ → 足した通貨だけを初期化、で導入時と同じ。
   通貨ごとに違う方式（`wallet:lots-init` / `wallet:lots-init-from-history`）を選んでもよい

   `wallet:lots-init-from-history` を選ぶ場合の前提と注意:
   - **直近 expirationDays ぶんの `wallet_histories` が欠けていないこと**。履歴を残さない残高変更
     （`adjustBalance` の `skipHistory: true`、DB の直接更新など）があると、その分だけ復元結果がずれる
     （履歴に無い付与は「期限を過ぎた分」として扱われる）
   - 復元の規則: 消費は FIFO なので残高は新しい付与の側に残る。履歴を新しい順に辿り、残高を使い切るまで
     付与額を割り当てる。SET はその時点で残り全額を取得した扱いにする（通常の SET と同じ解釈）。
     `created_at` が NULL の履歴行は読み飛ばす
   - 期限を過ぎた分は「実行開始時刻に失効するロット」1本になる。**初期化そのものは没収しない**。
     没収は通常の失効スイープ（`wallet-expire-lots`）が行うため、履歴・audit・通知の経路は通常と同じ
   - **`sweepEnabled: true` とセットで使うこと**。期限を過ぎたロットは失効間近の照会（`getExpiringLots` など）に
     出ないため、`sweepEnabled: false` のままだと没収もされず画面にも出ない状態で残る
   - **期限を過ぎた分には失効予告が届かない**（予告を送る猶予が無い）。本通知は、通知の cron が
     スイープより前に1回以上動いていれば届く。規約の告知などで事前に周知しておくこと
   - dry-run の `overdueAmount` は没収見込み額の上限。実際の没収額は locked_balance 保護によりこれ以下になる
3. 失効スイープと prune のスケジュール: `wallet-expire-lots`（失効の没収）と `wallet-lots-prune`（消費済みロットの掃除）は
   `src/app/api/cron/` に配線済みで、1 で `expirationDays` / `sweepEnabled` を設定した時点から日次で本体が動く
   （**追加作業なし**。設定前は呼ばれても即 skipped を返す）。前提は cron の配線（`vercel.json` を `pnpm generate cron` で生成済み、
   Vercel 以外は `pnpm task --due` を毎分。[cron 基盤 README](../../../lib/cron/README.md#スケジュールのセットアップ) 参照）。

   失効通知を送る場合は `wallet-expiration-notice`（毎時）も必要。設定は下の「失効通知の設定」を参照。
   **通知の cron は最初の失効日より前に1回以上動かしておくこと**（本通知は初回実行で開始位置を記録するだけで、
   それより前に没収された分には送られない）。

   wallet-lots-prune は remaining = 0 になったロット行の物理削除。付与のたびに行が増えるため、
   回さないと wallet_lots が単調増加する(付与の多いプロジェクトで回し続ける決まりは札 `lots_prune_required`)。
   保持日数は `walletConfig.lotPruneRetentionDays`（デフォルト30日）で調整可能。

#### 運用ルール

- **初期化は指定した通貨のロットだけを作り直す**。他の通貨のロットには触れない。`--all` は有効な全通貨が対象になるため、
  運用中の通貨がある構成では使わず、作り直す通貨を `--wallet-type` で指定する
- **wallet:lots-init の再実行は対象通貨の失効カウントをリセットする**。導入時の1回だけ実行し、再実行は障害復旧時に限る
- **wallet:lots-init-from-history の再実行は、その時点の残高と履歴からロットを作り直す**。既に没収された分は
  残高から引かれているので二重に没収されることはない。導入時と違う方式で再実行すると失効日が変わる点に注意
- **無効化→再有効化**: 無効化中は消費がロットに反映されないため、再有効化時は必ずその通貨を指定して初期化
  （`wallet:lots-init` / `wallet:lots-init-from-history` のどちらか）を再実行して re-baseline すること
- **sweepEnabled: false**: ロット記録と失効間近照会だけ先行させ、没収は行わない（規約告知期間などに使用）
- **locked_balance 保護**: 失効額は利用可能残高（`balance - locked_balance`）が上限。予約中の分は失効せず次回スイープに持ち越し
- 規約側の文言は数え方に合わせる: `"grant"` = 「失効は取得が古い順に充当（FIFO）」、`"lastActivity"` = 「最後の残高変更から○日で全額失効」

### 失効通知の設定

`sweepEnabled: true` にするとスイープは残高を没収するが、**通知を設定しない限りユーザーには何も知らされない**
（履歴行が残るだけ）。通貨ごとに「予告を送るか」「本通知を送るか」「どのチャネルで送るか」を設定できる。
**デフォルトはどちらも送らない**。

設定(上書き `src/config/domains/wallet.config.ts` の `expiration`。既定は `src/domains/core/wallet/config.ts`):

```typescript
// config は段だけ。送信チャンネルは連絡のカテゴリー(walletExpiring・walletExpired)、文面は連絡定義(messages/expiringNotice.ts・expiredNotice.ts)
expiration: {
  regular_coin: {
    expirationDays: 180,
    sweepEnabled: true,
    notice: {
      // 失効予告: 段の配列。空配列 = 予告なし
      preExpiry: [
        { daysBefore: 30 },
        { daysBefore: 7, messageKey: "shop.pointExpiringSoon" }, // 段ごとに送信チャンネルを変えるなら自分のカテゴリーの連絡へ向ける
      ],
      // 失効時の本通知: null = 本通知なし
      expired: {},
    },
  },
},
```

- `notice` は省略可（省略 = 何も送らない）。`enabled` フラグは無く、空配列 / `null` が OFF を表す
- 送信チャンネルはカテゴリーが決める: 予告 = カテゴリー `walletExpiring`(種別 transactional = 利用者は止められず、送るかはこの段が決める D207・D208。email・inApp)、本通知 = カテゴリー `walletExpired`(transactional、email・inApp)。全部の通貨・段で変えるならカテゴリーの上書き `src/domains/core/messaging/categories/<カテゴリー>.override.ts` の `channels`
- `messageKey`(段・本通知ごとに任意): 送る連絡の鍵(省略 = 上流の `wallet.expiringNotice` / `wallet.expiredNotice`)。通貨・段ごとに送信チャンネルを変えたい fork は、その送信チャンネルのカテゴリーと、同じ vars を受ける連絡定義を自分のドメインに足して向ける(生成の一覧に無い鍵は cron が止まる)。前の設定の `channels` は無くなった(残っていると cron が止まって知らせる)
- メールの無い利用者: メールの行が宛先なし(no_address)になり、ほかの送信チャンネルで届く
- **文言**: 連絡の定義 `messages/expiringNotice.ts`（予告、鍵 `wallet.expiringNotice`）・`messages/expiredNotice.ts`（本通知、`wallet.expiredNotice`）。レイアウトの欄の中身（件名・札・宛名・本文・足元）を持つ。変える fork は隣に `<名前>.override.ts` を置く（段ごと・通貨ごとの文面の設定は無い。段で変えたいときは `{{daysBefore}}` を使う）
  - 差し込む名前: 共通 `{{currencyLabel}}`・`{{amount}}`・`{{displayName}}`（宛名、名前が無ければ「お客様」）・`{{serviceNameShort}}` / 予告 `{{expiresOn}}`・`{{daysBefore}}` / 本通知 `{{expiredOn}}`・`{{balanceAfter}}`
  - 見た目: レイアウト `statement`（明細、`src/domains/core/messaging/layouts/statement/`）。欄: `badge` 見出しの札（「… からのお知らせ」、ロゴの下）→ `addressee` 宛名（「… 様」）→ 区切り → `body` 本文（改行はそのまま）→ 区切り → `footer`。見た目を替える fork はその描き方の `.replace`、文言は上書きの `values`
  - inApp は受け取り箱（`message_inbox_items`）に入る。題と本文はレイアウトの要約（題 = 件名、本文 = メールと同じ本文）
- 送り方: 送る口 `messagingService.sendMessage`(送信チャンネルを渡さない。予告も本通知も種別 transactional なので受信者の好みでは止まらない、D208)。二重送信の鍵は `wallet-expiring:<通貨>:<日数>:<利用者>:<失効日>` / `wallet-expired:<履歴の id>`。ページごとの送信済みの除外は `messagingService.existingIdempotencyKeys`（送信の表と鍵の移し先の表の両方）
- 全体設定 `walletConfig.expirationNoticeSettings`: `targetStatuses`（送信対象のユーザーステータス。既定 active / inactive）、
  `sendConcurrency`（同時送信数。既定 5）、`dateTimeZone`（文面の日付と予告の日境界。既定 Asia/Tokyo）
- スケジュール登録は不要: `wallet-expiration-notice` は配線済みで、`notice` を設定した時点から毎時動く（Vercel Hobby では 1 日 1 回）。
  時刻は `src/app/api/cron/wallet-expiration-notice/task.ts`（毎時 15 分）。変えるなら同じフォルダに `task.override.ts` を置く（[cron 基盤 README](../../../lib/cron/README.md)「upstream のタスクを外す・時刻を変える」）

| sweepEnabled | preExpiry | expired | 挙動 |
|---|---|---|---|
| false | 任意 | 任意 | 何も送らない（予告は抑止。失効履歴が生まれないので本通知も発生しない） |
| true | `[]` | `null` | 通知なしで没収 |
| true | 段あり | `null` | 予告のみ |
| true | `[]` | 設定あり | 本通知のみ |
| true | 段あり | 設定あり | 両方 |

予告は `sweepEnabled: true` の通貨にしか送られない。没収しない通貨（告知期間モード）に「○日に失効します」と
告げると虚偽の通知になるため。

### 購入の特典の表示（拡張点 purchaseBonuses）

購入画面にランク特典・支払い方法の特典などを出す受け口。**表示だけ**で、特典の付与はサーバーの購入完了ポストフック（purchaseRequest の受け口 `completeHooks`）が行う。上流の提供元は 0（特典を持たない fork の画面は今まで通り）。

```
purchaseBonuses/<key>.ts           ← 提供元（export const provider: PurchaseBonusProvider）。fork が置く
purchaseBonuses/<key>.override.ts  ← 上の Tier の提供元の enabled・order を変える
extensions/purchaseBonuses.ts      ← 一覧（生成物、pnpm generate extensions）
hooks/usePurchaseBonuses.ts        ← 全提供元をまとめる hook（と純関数 orderedProviders / combinePurchaseBonusSources）
types/purchaseBonus.ts             ← 提供元・特典・文脈の型
```

- 提供元: `{ key, order, enabled?, useSource() }`。`useSource` は hook（SWR などを呼んでよい）で、読み方 `{ forPackage?, forPaymentMethod?, forPurchase? }` を返す。各読み方は `PurchaseBonus | null`（null = その場所に出さない）
- 特典: `{ key?, label, amount? }`。`label` が見せる文言、`amount` は追加で付く通貨の量（まとめの行と購入後の残高に足す）
- `usePurchaseBonuses()` は使う提供元（`enabled` が false を除き order・key 順）の `useSource` を毎描画 1 回ずつ同じ順で呼び、`{ forPackage, forPaymentMethod, forPurchase, totalForPurchase }` を返す（同じ場所の特典は提供元の順に並ぶ）
- 出る場所（container が hook を呼び、表示の部品へ省略可の props で渡す。渡さなければ今まで通り）

| 読み方 | 文脈 | container → 部品の props | 見た目 |
|--------|------|------------------------|--------|
| `forPackage` | `{ walletType, amount }` | `WalletBalance` → `PurchaseList` の `packageBonuses` | パッケージの行に成功色のバッジ（`label`） |
| `forPaymentMethod` | `{ walletType, method }`（`paymentMethods[].id`） | `CurrencyPurchase` → `SupportedPaymentMethods` の `methodBonuses`（`(methodId) => PurchaseBonus[]`） | 選べるカードの名前の横にバッジ。準備中・ブロック中のカードには出さない |
| `forPurchase` | `{ walletType, purchaseAmount, paymentMethod }`（未選択 = null） | `CurrencyPurchase` → `PurchaseSummaryCard` の `bonuses` | まとめに 1 行ずつ（`label`、`amount` があれば `+N単位`）。購入後の残高 = 今の残高 + 購入数 + `amount` の合計 |

- fork が container を自前で持つ（`_components/` にコピーした）ときは、その container で `usePurchaseBonuses()` を呼び、上の props を部品へ渡す
- `enabled` は読み込み時に決まる値に限る（設定の値など）。描画ごとに変わる条件は読み方の中で null を返す

**fork の例: 表示と付与で同じ計算を使う**

特典の量の計算は fork のドメインに純関数で 1 つだけ置き、サーバーの付与（`completeHooks` の項目）と表示（提供元）の両方から呼ぶ。表示と付与の数がずれない。

```typescript
// src/domains/rankBonus/utils/rankBonusAmount.ts（fork のドメイン。純関数）
export function rankBonusAmount(purchaseAmount: number, ratePercent: number): number {
  return Math.floor((purchaseAmount * ratePercent) / 100);
}
```

```typescript
// src/domains/core/purchaseRequest/services/server/hooks/definitions/rankBonus.ts（付与。サーバー）
import type { PurchaseCompleteHook } from "@/domains/core/purchaseRequest/services/server/hooks/purchaseCompleteHookRegistry";
import { rankBonusAmount } from "@/domains/rankBonus/utils/rankBonusAmount";

export const hook: PurchaseCompleteHook = {
  key: "rank_bonus",
  priority: 10,
  handler: async ({ purchaseRequest, tx }) => {
    const rate = await findRankRate(purchaseRequest.user_id, tx); // fork のサービス
    const amount = rankBonusAmount(purchaseRequest.amount, rate);
    // amount を walletService で付与する(tx を使う)
  },
};
```

```typescript
// src/domains/core/wallet/purchaseBonuses/rankBonus.ts（表示。クライアント）
import type { PurchaseBonusProvider } from "@/domains/core/wallet/types/purchaseBonus";
import { useMyRankRate } from "@/domains/rankBonus/hooks/useMyRankRate"; // fork の hook(SWR)
import { rankBonusAmount } from "@/domains/rankBonus/utils/rankBonusAmount";

export const provider: PurchaseBonusProvider = {
  key: "rankBonus",
  order: 10,
  useSource: () => {
    const rate = useMyRankRate(); // 読み込み中・ランクなし = 0
    return {
      forPackage: ({ walletType, amount }) =>
        walletType === "regular_coin" && rate > 0 ? { label: `ランク特典 +${rankBonusAmount(amount, rate)}` } : null,
      forPurchase: ({ walletType, purchaseAmount }) =>
        walletType === "regular_coin" && rate > 0
          ? { label: "ランク特典", amount: rankBonusAmount(purchaseAmount, rate) }
          : null,
    };
  },
};
```

- 置いたら `pnpm generate extensions`。上の Tier の提供元を止める・並べ替えるのは隣に `<key>.override.ts`（`export const override: PurchaseBonusProviderOverride = { enabled: false }`）
