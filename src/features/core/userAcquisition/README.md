# userAcquisition — サインアップ流入経路（マルチタッチアトリビューション）

## Overview

- ユーザーがサインアップ完了するまでの流入タッチ（UTM パラメータ / 広告クリック ID / 外部リファラー）をサービス側 DB に保存する core ドメイン。GA に依存せず first-touch / last-touch / パス分析を自前データで行える
- 閉じられる機能（門番の規則 `src/featureGate/rules/userAcquisition.ts`、上流の既定は閉）。記録するかは規則の入切だけで決まる: 流入経路の proxy・本登録の route・本登録の保存は `gate.enabled("userAcquisition")` が開のときだけ動く。閉じると DB の表（user_acquisitions / user_acquisition_touches）も db:push から外れ、GA4 へ判別表も渡さない
- 有効化した時点以降のサインアップから蓄積される（過去のサインアップには遡及できない）
- 集計 UI は core に同梱しない（データレイヤーのみ）
- 使う時・直す時の決まりは札 `.claude/rules/items/features/userAcquisition.md`

## Usage

- 有効化: `pnpm ops features set userAcquisition on`（→ `src/config/featureGate/switches.config.ts`）
- 無効化: `pnpm ops features set userAcquisition off`（cookie 蓄積・保存とも停止。既存データはそのまま）
- 管理画面のユーザー詳細に出す: `getUserAcquisition` / `getUserAcquisitionTouches` をページの loader（SSR）または管理 API から呼び、downstream 側で描画する

### 招待リンクの生成レシピ（downstream 実装用）

core は招待コード文字列のコピー UI（InviteCode）までを提供する。リンク化は downstream で:

```ts
import { getAppBaseUrl } from "@/lib/url";

// 基本形
const inviteUrl = `${getAppBaseUrl()}/?invite=${encodeURIComponent(code)}`;

// GA 併用時も基本形のままで OK: googleTag 基盤が invite のみの流入を
// campaign_source/medium=invite として GA4 に自動分類する（src/lib/googleTag/README.md 参照）。
// UTM を併記したい場合（GTM 直貼り等、googleTag 基盤を経由しない構成）はこちら
// （UTM が最優先されるため、サービス側 DB と GA の集計ラベルは一致する）
const inviteUrlWithUtm = `${getAppBaseUrl()}/?invite=${encodeURIComponent(code)}&utm_source=invite&utm_medium=invite`;
```

### 集計レシピ

#### first-touch 別サインアップ数（期間指定）

```sql
SELECT COALESCE(first_utm_source, '(direct/none)') AS source,
       COALESCE(first_utm_medium, '(none)')        AS medium,
       COUNT(*)                                    AS signups
FROM user_acquisitions
WHERE signup_at >= '2026-07-01' AND signup_at < '2026-08-01'
GROUP BY 1, 2
ORDER BY signups DESC;
```

last-touch 集計は `first_` を `last_` に読み替えるだけ。
「シグナル無し（行が無い）ユーザー」も分母に含めたい場合は users から LEFT JOIN する。

#### タッチ経路（パス）分析

```sql
SELECT path, COUNT(*) AS users
FROM (
  SELECT user_id,
         STRING_AGG(COALESCE(utm_source, referrer_host, '(direct)'), ' > ' ORDER BY touch_index) AS path
  FROM user_acquisition_touches
  GROUP BY user_id
) t
GROUP BY path
ORDER BY users DESC
LIMIT 50;
```

#### ダッシュボード常設化する場合

単発クエリなら上記で十分。管理画面に常設するなら（analytics の README「レスポンスキャッシュ（withAnalyticsCache）」）:

1. まず `withAnalyticsCache` でクエリ結果をキャッシュ
2. 日次系列が必要になったら analytics の拡張点 `rollupMetrics` に flow メトリクス（例: `signup_by_source`、dimensions=first_utm_source）を登録して事前集計に載せる

## API

### 読み取り API（server-only）

```ts
import {
  getUserAcquisition,        // 1:1 サマリー（無ければ null）
  getUserAcquisitionTouches, // タッチ明細（時系列昇順）
} from "@/features/userAcquisition/services/server";
```

### 公開の口（edge-safe、`@/features/core/userAcquisition/lib/classifyVisit`）

| 関数 | 返すもの | 使い手 |
| --- | --- | --- |
| `classifyVisit({ url, referrer, now }, definitions?)` | 流入タッチ（cookie の圧縮表現）か null | `src/proxies/attribution.ts` |
| `getChannelDefinitions()` | 判別表 `AcquisitionChannelDefinition[]`（シリアライズできる値） | `src/wiring/GoogleTag.tsx`（GA4 へ） |
| `getAttributionCookieMaxAgeSeconds()` | タッチ cookie の maxAge（秒） | proxy |

cookie の読み書き（`parseAttributionCookie` ほか）は `lib/attributionCookie.ts`、cookie 名は `constants`。

### 判別表（獲得経路の定義）

1 行 = 「この URL パラメータが付いていたら、この source / medium の流入」（型 `types/channel.ts`）:

```ts
{ param: "gclid", kind: "clickId", channel: { source: "google", medium: "cpc" } }
{ param: "invite", kind: "link", channel: { source: "invite", medium: "invite" } }
```

- `kind`: `clickId` = 広告のクリック ID（GA / 広告が自分で判別する）| `link` = 独自のリンクの印（招待など。GA4 は判別しないので lib/googleTag が campaign_source / medium を送る）
- `channel: null` = 値を extras に保存するだけで source / medium は補わない
- 並び = 優先順位: clickId の行 → link の行。同じ種類の中は表の順（先の行が source を決める）
- UTM と外部リファラーは行ではなく分類の判定のルール（UTM が常に最優先、リファラーは最後）
- 行の出どころ:
  - clickId の行 = config の `clickIdParams`（値は fork が config で変える）
  - それ以外 = 受け口 `channels/<名前>.ts` の `export const channel: AcquisitionChannelItem`（`pnpm generate extensions` → `extensions/channels.ts`、鍵 = `param`）。上流の項目は招待 `channels/invite.ts` 1 つ
- 項目の `enabled?: () => boolean`: 持ち主の機能が閉じている間は行を出さない。招待の行は `gate.enabled("referral")`（パラメータ名は referral の `INVITE_LINK_PARAM`、source / medium は config の `referralParam`）
- 同じ `param` が config と項目の両方にあると `getChannelDefinitions()` が例外（項目どうしの重複は一覧の読み込みで例外）

### テーブル

| テーブル | 関係 | 役割 |
| --- | --- | --- |
| `user_acquisitions` | users と 1:1 | first/last タッチを型付きカラムに非正規化したサマリー。集計はこちら |
| `user_acquisition_touches` | users と 1:N | 全タッチの明細（touch_index 昇順 = 時系列）。パス分析・線形配分用 |

設計方針:

- **集計軸（source / medium / campaign / referrer_host）は型付きカラム** — GROUP BY・インデックスが直接効く
- **ロングテール（utm_term / utm_content / gclid / gaClientId 等）は extras(jsonb)** — 集計軸に昇格したくなった値だけ将来カラム化
- 行が無いユーザー = 計測可能な流入シグナル無し（オーガニック直訪のみ）
- 再入会（withdrawn → active）時は新しい獲得ジャーニーとして上書き
- 解析用の値は users テーブル本体ではなく、このサテライトテーブルに持つ

## Extension

- 独自の印（例: 自前のアフィリエイト `?aff=`）を経路にする: `channels/<名前>.ts` に `export const channel: AcquisitionChannelItem` を 1 つ置いて `pnpm generate extensions`（core の編集は不要）
- 設定: `config.ts`（`userAcquisitionConfig`: cookieMaxAgeDays=30 / maxTouches=15 / referralParam の source・medium / clickIdParams）、上書き `src/config/features/userAcquisition.config.ts`（型 `UserAcquisitionOverride`）。clickId の行の値は fork が config で変える

## Internals

### 全体フロー

```
訪問者（匿名）                             サインアップ本登録
──────────────────────────────           ─────────────────────────────────
UTM / クリックID / 外部リファラー付き        POST /api/auth/register
ページ閲覧のたびに proxy が                  → cookie をサーバーサイドで復元
httpOnly cookie (acq_touches) に            → register() → recordSignupAcquisition()
タッチを追記（DB 書き込みなし）               → user_acquisitions / user_acquisition_touches へ確定保存
                                            → cookie 削除
```

- **cookie 蓄積**: `src/proxies/attribution.ts`（proxy のレスポンスデコレーター）
- **cookie コーデック**: `lib/attributionCookie.ts`（edge-safe）
- **確定保存**: `services/server/recordSignupAcquisition.ts`（bestEffort）
- 訪問の分類と判別表: `lib/classifyVisit.ts`

### タッチの記録ルール（cookie 側）

- 対象: GET のページナビゲーションのみ（/api/・/_next/・アセットは除外）
- タッチ条件: `utm_*` あり / 判別表の行のパラメータ（クリック ID・招待リンク `invite` など）あり / 外部リファラーあり
- source/medium 補完の優先順位: **UTM > クリック ID（clickId の行）> 招待リンクなど（link の行）> 外部リファラー**。UTM 無し+クリック ID → その行の channel、UTM 無し+招待リンク → `source=invite, medium=invite`、UTM 無し+外部リファラーのみ → `source=リファラーホスト, medium=referral`
- 招待リンクの medium は `invite`: GA が外部サイトからの自然リンク流入を `referral` に自動分類するため、混ざらない別語彙にしている（config で変更可）
- 重複抑止: 直前タッチと同一チャンネル（source/medium/campaign/referrer_host）は追記しない
- 上限: `maxTouches`（既定 15）超過・cookie が 3000 バイト（`ACQUISITION_COOKIE_MAX_BYTES`）を超えたときは **first-touch を必ず保持**して古い中間タッチから間引く
- 有効期限: 追記のたびにリフレッシュ = 最終タッチから `cookieMaxAgeDays`（既定 30 日）

### 招待リンク連携（referral / referralReward）

referral の招待リンクのパラメータ（`INVITE_LINK_PARAM` = `invite`）付きの URL を踏んだときの扱いは、
**解析と機能で系統が分かれており、それぞれ独立にオンオフできる**:

- **解析（本ドメイン、機能 `userAcquisition` の入切でゲート。判別表の招待の行は紹介の機能が開いている間だけ出る）**: タッチとして記録され、
  紹介経由の流入が広告・SNS 等と同じ土俵で集計できる。コード自体は extras（`extras.invite`）に
  残るため「どの紹介者経由のサインアップか」まで追える
- **機能（referral ドメイン、機能 `referral` の入切でゲート）**: コードが
  referral 専用 cookie（`pending_invite`、last-touch 優先で上書き・30日）に保持され、
  サインアップフォームへのプリフィルと本登録時の自動適用が動く。
  **解析が無効でも招待リンクは機能する**。実装は `referral/lib/inviteLinkCookie.ts` /
  `src/proxies/inviteLink.ts` / `GET /api/referral/pending-invite-code`、
  挙動の詳細（プリフィル・明示的拒否の意味論）は referral README を参照

パラメータ名は referral の物（`referral/lib/inviteLinkCookie.ts` の `INVITE_LINK_PARAM`）。本ドメインはその名前を判別表の行（`channels/invite.ts`）として分類に使うだけで、招待リンクの cookie は referral が自分の名前だけで動かす。

### 制限

- cookie はクライアント改ざんが可能。zod で形式・長さは検証するが値の真正性は保証しない（解析用データとして許容）
- **ブラウザまたぎでタッチ履歴は引き継がれない（既知の制限）**: アプリ内ブラウザ（X/Instagram 等）で
  流入した後、認証メールをデフォルトブラウザで開いてサインアップ完了した場合、cookie が別物のため
  マルチタッチ履歴は失われる（GA も同様に抱える WebView 横断の一般的な限界）。
  例外として**招待コードはメールリンク URL 経由で引き継がれる**ため、紹介経由ユーザーは開いた先の
  ブラウザで invite タッチが復元され、紹介チャンネルの解析は維持される（referral README 参照）
- redirect 等のインターセプト系 proxy が応答したリクエストではタッチを拾えない（リダイレクト後の着地 URL に UTM を残す運用を推奨）
- `_ga` cookie が存在すれば client_id をサマリー extras（`gaClientId`）に保存する — GA 側データとの突合用

## Verification

- 回帰テスト: `pnpm test src/features/core/userAcquisition/lib/classifyVisit.test.ts`（URL・リファラー → タッチの表、GA4 の招待キャンペーン、紹介が閉じたときの行）

## Related

- 招待リンクの機能側: `src/features/core/referral/README.md`
- GA4 への自動分類: `src/lib/googleTag/README.md`
