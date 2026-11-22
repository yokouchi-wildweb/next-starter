# messaging ドメイン

## Overview

利用者への連絡（メール・お知らせ = 受け取り箱・LINE・fork の送信チャンネル）の基盤。連絡定義（`messages/<名前>.ts`、書き方は src/lib/messaging/README.md）を送る口が送信（`message_dispatches`）と配達（`message_deliveries`、受信者 × 送信チャンネルの 1 行）に記録し、送信チャンネルの受け口の項目で送る。

連絡の形 = **カテゴリー + レイアウト + 欄の中身**。定義連絡（自動）も管理者のテンプレート（手動）も同じ形で、送信チャンネルはカテゴリーだけが持ち、見た目はレイアウト（`layouts/`）が全送信チャンネルの分を持つ（描けない送信チャンネルは送信チャンネルの汎用の描き方か要約で描く）。文面の `{{名前}}` は埋め込み情報（共通 = 受信者ごとに埋まる / 専用 = テンプレートごとに送る人が入れる・定義連絡の vars、英語の鍵と日本語の別名 `varNames`）。部品ごとの形と「なぜそうなっているか」（採らなかった案と理由）は [Internals.md](Internals.md)。

- 語: 口 = 呼び出す入口(関数・HTTP の route) / 送信 = 1 回の送信の記録(`message_dispatches` の 1 行)
- 送る口 `messagingService.sendMessage` / `sendMessageToMany`（`@/features/messaging/services/server`）が送信・配達の記録・配信停止・本文の残し方を 1 か所で守る。`lib/mail` の `send()` はメールの送信チャンネルの項目が使う
- このドメインが持つ口: 本人の口（受け取り箱・好み・端末の帳簿）・配信停止の受け口と確認のページ・管理の口（送る・一括送信・送信・テンプレート・テキストの編集）・provider の webhook・cron 3 本。業務の送信 API は持たない: 送り手（各ドメインの service・cron・fork の route）がサーバーから送る口を呼ぶ
- 機能の門（`src/featureGate/rules/`）: `messagingDispatches`（送信の管理、既定 開）・`messagingBroadcast`（管理の送信、既定 閉）・`messagingTemplates`・`messagingOverrides`（既定 閉）・`messagingPreferences`（好みのページと API、既定 閉）・`messagingInbox`（受け取り箱のページと未読のモーダル、既定 閉）・`messagingTracking`（開封・クリックの記録、既定 閉）。送る口・cron・配信停止の受け口・webhook・本人の受け取り箱 API は門の外で常に開

## Usage

### 送る

```ts
import { messagingService } from "@/features/messaging/services/server";
import { message as orderShipped } from "@/features/order/messages/orderShipped";

await messagingService.sendMessage(orderShipped, {
  recipient: { userId },          // 宛先を直に渡すなら { channel: "email", address }
  vars: { orderNo: "A-1" },       // 定義の vars の zod で検査（合わなければ 400）
  idempotencyKey: `order-shipped:${orderId}`,
});

await messagingService.sendMessageToMany(campaign, {
  target: { type: "group", groupId },  // { type: "all" } / { type: "role", roles } / { type: "group", groupId }
  vars: { title: "…" },                // 選んだ利用者なら target の代わりに recipients: [{ userId }, …]
});
```

- 冪等の鍵 `idempotencyKey`: 同じ鍵の 2 回目は送る前に 409（送信の UNIQUE と、保持の掃除で移した鍵の表 `message_idempotency_keys` の両方を見る）。画面はフォームを開くたびに `crypto.randomUUID()`、同じフォームの再送信は同じ鍵。バッチの再実行で送った対象を除くのは `messagingService.existingIdempotencyKeys(keys)`。並走した実行が先に送った時も 409（実例: wallet の失効の知らせ `src/features/core/wallet/services/server/notification/expirationNoticeSender.ts`）
- cron・CLI からの送信は `runAsSystem`（`@/lib/audit`）の中。送り元 `source` の既定は定義の鍵
- 予約は `scheduledAt`（過ぎた時刻と `schedule.maxDaysAhead` 日より先は 400）。required と秘密を差し込む連絡は予約・全員宛てにできない（400）
- 管理者が定義連絡を送る口（記録の宛先から・全員・ロール・グループへ、テキストの編集・送信チャンネルの絞り・管理者の値だけを受ける）は `/api/admin/messaging/definitions/**`（services/server/admin/README.md）。定義の `adminVars`（管理者が入れる値）・`recordVars`（記録から埋める値）・`adminTargets`（送れる宛先）・`channelModes`（送信チャンネルの固定）が受ける物を決める

### 宛先（target）

- 4 つ: 全員 `all`・ロール `role`・ユーザーグループ `group`・選んだ利用者（`recipients`、管理の API では `{ type: "users", userIds }`）。送信の列 `target`（jsonb）に指定のまま残る
- **グループ宛て = 送り始めに固定**: cron の最初の展開が 1 つの文（`INSERT … SELECT`）で、その時点の一員（利用できる利用者・送り始め以前の登録）を送信の受信者の一覧 `message_dispatch_recipients` に書き、配達はその一覧だけから作る。後でグループが変わっても受信者は変わらない。お知らせは受信者ごとの行（共有の行は作らない）
  - 送る時の検査: 門 `userGroups` が閉・グループが無い = 404、しまった・壊れた・版の無い予約のグループ・人数の上限（userGroup の `memberLimit`）超え = 409、時間切れ = 503。誤りなら送信を作らない。予約したグループは今の版を送信に固定する
  - 固定の時に使えない（門が閉・しまった・上限・版が無い・時間切れ）→ 送信を `cancelled` にして `metadata.cancelReason` に理由。管理の選択肢は門 `userGroups` が閉なら空（グループ宛てを出さない）
- **全員・ロール宛ての時刻の線**: 送り始め（`scheduled_at ?? created_at`）より後に登録した人には届かない。お知らせは送信に 1 行の共有の行（全員・ロール、受信者に依る差し込みが無い時）で、見せるかは受け取り箱が読む時に決める（`show_to_later_signups`・好み。services/server/inbox/README.md）
- 条件で集めた人に送る: ユーザーグループ（src/features/core/userGroup/README.md）。SQL で書ける条件 = userGroup の条件の部品 `criteria/<名前>.ts` を動的・定期のグループで使う / SQL で書けない条件 = fork の task が静的グループを書く（`staticMemberWriter.replaceMembers`）

### 連絡を足す

1. `pnpm generate message -- <domain> <name> --category <key> --label <名前> [--core]` が送る側のドメインに `messages/<名前>.ts`（鍵 `<ドメインのフォルダ名>.<名前>`、レイアウト notice と欄の中身の雛形）を書き、`src/registry/messageRegistry.ts` と拡張点を作り直す（使い方 scripts/structure/message/README.md）。core のドメインは `--core` = 上流だけ
2. カテゴリー（category）= 利用者から見て 1 つの出来事（「〜した時」。例 likeReceived・itemSold・passwordReset）。種別（7 つ）と送信チャンネルはカテゴリーが持ち、連絡は書かない。無ければ先に `categories/<名前>.ts` を足す
3. 上流のカテゴリー: emailVerification・passwordReset・emailChange・earlyRegistration（functional・email）/ accountLocked（security）/ registrationComplete・walletExpired・walletAdjusted・bankTransferCheck（transactional。bankTransferCheck = お振込の確認、振込審査の一覧から管理者が送る確認の連絡、メール・お知らせとも既定で入）/ walletExpiring（activity、利用者が止められる）
   - promotion（promotion、管理画面「一般的なプロモーション」・利用者「キャンペーン情報」、管理者が書く宣伝の既定）/ announcement（管理画面「一般的なお知らせ」・利用者「運営からのお知らせ」）/ operatorDirect（direct、管理画面「一般的な個別連絡」・利用者「個別のご連絡」、管理者からの個別の連絡と一括の既定）
   - カテゴリーの名前は 2 つ: `label` = 利用者に見せる（好みの設定・配信停止・受け取り箱）、`adminLabel` = 管理画面（無い = `label`）
   - 種別の表示名（`constants/kindLabels.ts` の `MESSAGE_KIND_LABELS`）: functional 機能通知 / transactional 手続き通知 / security セキュリティ / announcement 運営告知 / direct 個別連絡 / activity アクティビティ / promotion プロモーション
4. 見た目 = レイアウト（`layouts/<名前>/`、`layouts/README.md`）。上流は simple（シンプルなお知らせ）・notice（汎用のお知らせ）・link（認証のリンク）・welcome（ようこそ）・statement（お知らせの明細）・alert（セキュリティの警告）。定義は `layout` と `values`（レイアウトの欄の中身）を書く
5. 実例: auth の連絡（link・alert）・user の連絡（welcome）・wallet の失効の知らせ（statement、cron、`runAsSystem` + 冪等の鍵）と残高の変更（notice）・管理者が記録の宛先から送る bankTransferReview のお振込の確認（statement、`recordVars`・`adminTargets: ["records"]`）

### 運用で間違えやすい線

仕組みが線を引いた所。定義の側の線は src/lib/messaging/README.md「定義で間違えやすい線」。

- 送信チャンネルはカテゴリーが決める: 配信停止の単位はカテゴリー × 送信チャンネルなので、送信チャンネルが送信や連絡ごとに変わると好みのページの表が嘘になる。上流のカテゴリーの送信チャンネルは `categories/<名前>.override.ts` の `channels`。1 本だけ別の送信チャンネルで届けるには別のカテゴリーを足してその連絡を属させる

```ts
// src/features/<domain>/categories/itemSoldInApp.ts(fork、お知らせだけで届ける「出品した物が売れた時」)
import type { MessageCategory } from "@/lib/messaging";

export const category: MessageCategory = { key: "itemSoldInApp", label: "出品した物が売れた時(お知らせ)", kind: "activity", channels: ["inApp"] };
```

- その送信は送信チャンネルを絞るだけ: 管理者が手で送る時だけカテゴリーの送信チャンネルの中で絞れる(足せない、外・空は 400)。組ごとに送り分けるなら組ごとにカテゴリーを作る(例 `campaignMail` = email、`campaign` = email + inApp)
- 種別は止められるか・好み・宛先の停止(suppression)・記録の既定を決め(`MESSAGE_KIND_TRAITS`)、カテゴリーは停止の単位と集計の軸。カテゴリーの上書きは `key`・`kind` を変えられない。連絡の上書きは所属の `category` を付け替えられ(fork のカテゴリーへも、functional の連絡も、D166・D167)、送信チャンネルの固定 `channelModes` を丸ごと差し替えられる(種別の性質の検査は付け替えた後の値で見る)。上流の連絡を止めるのは `messages/<名前>.override.ts` の `{ enabled: false }`
- 機能の連絡(functional): `enabled: false`・テキストの編集・間引き・email を外すことは検査で止まる。文面 = レイアウトの描き方の `.replace`(見た目)か fork のファイルの上書きの `values`(文言) / 流れごと = 送り手(auth など)の口を替える
- 種別まるごとの停止はデータだけ: 種別まるごとの行は後から足すカテゴリーにも当たる。上流の画面はスイッチを出さないが、送る口・受け取り箱・好みの見え方は同じ判定で見る。会員登録で宣伝に同意しなかった人 = promotion の種別まるごとの行(source `signup`)。見せたい fork は hook `useMessagePreferences` の `setKind` と `preferences.kinds`、サーバーは `messagingService.setMessagePreference(userId, { kind, optedOut }, { source })`
- カテゴリーのグループ(`categoryGroups/`)は好みのページの見出しで、止める単位ではない(後から足したカテゴリーが止まるかが決まらないため)
- 全員・ロール宛てのお知らせは共有の 1 行で配達の行が無く、届かなかった人を数えられない。email を含むカテゴリーなら、届かなかった人は `GET /api/admin/messaging/send-results/[dispatchId]`(送信チャンネルごとの数と `failed` / `bounced` / `suppressed` の人と理由)か、`unknown` も見るなら `GET /api/admin/messaging/dispatches/[id]/deliveries?status=…` の `reason`・`errorCode` で見る
- 間引き `untilRead` が見るのは受け取り箱の既読だけ(会話の既読とは別)。既読にする口は `POST /api/me/messaging/inbox/[id]/read` か messagingService の既読

## API

HTTP の口と返す形は口のフォルダの README:

- 送る口（`sendMessage` / `sendMessageToMany` / `sendFreeMessage`・プレビュー・見込み・間引き・本文の残し方・送信の結果）→ services/server/sendMessage/README.md
- 管理の口 `/api/admin/messaging/**`（自由連絡を送る・一括送信・定義連絡を管理者が送る `definitions/**`・送信の結果 `send-results/[dispatchId]`・1 人の受け取れる送信チャンネル `recipients/[userId]/channels`・送信の読む口・送信の操作・続きを送る・利用者ごとの履歴）→ services/server/admin/README.md
- テンプレート `/api/admin/messaging/templates/**`・レイアウトのプレビュー `/api/admin/messaging/layouts/preview` → services/server/templates/README.md / テキストの編集 `/api/admin/messaging/overrides/**` → services/server/overrides/README.md
- 本人の受け取り箱 `/api/me/messaging/inbox/**` → services/server/inbox/README.md / 好み `/api/me/messaging/preferences` → services/server/preferences/README.md / 端末の帳簿 `/api/me/messaging/endpoints` → services/server/endpoints/README.md
- 配信停止 `/api/messaging/unsubscribe` と確認のページ `/unsubscribe` → services/server/unsubscribe/README.md
- provider の webhook `/api/webhook/messaging/[channel]/[provider]` → services/server/webhooks/README.md
- 画面（入れ物・部品・hook・ページ）→ components/README.md
- 表と値の一覧 → entities/README.md

## Extension

### 値（config）

`config.ts` の既定、fork は `src/config/features/messaging.config.ts` で上書き:

- 送る画面・テンプレートの編集: `initialLayout` `"simple"`（最初に開くレイアウト。管理画面で選べる使えるレイアウトであること = 連絡の一覧の検査）
- 送る口: `smallSendMaxRecipients` 100（これ以下の選んだ宛先は要求の中で展開）/ `inRequestBatchSize` 50（要求の中で送る最初の束）/ `requiredRetry` { attempts 3, delaysMs [200, 1000] } / `transientRetry` { maxAttempts 5, baseDelaySeconds 60, factor 4 } / `expandChunkSize` 500 / `schedule.maxDaysAhead` 90
- 送信チャンネル: `channels.line.enabled` false（開ける fork は `channels: { line: { enabled: true } }` と LINE の env・機能 `userLineProfile`）
- cron: `sweep` { budgetMs 240000, deliveryChunkSize 100, expandChunksPerRun 20, leaseSeconds 300 } / `retention` { eventsDays 30, deliveriesDays 90, dispatchesDays 730, idempotencyKeyDays null, chunkSize 1000, budgetMs 240000 } / `subscribers` { lagSeconds 120, maxAttempts 5, batchSize 100, budgetMs 240000 }
- 受け取り箱: `inbox.showUnreadModal` true（門 `messagingInbox` が開の間に未読のモーダルを出すか）/ `inbox.unreadModalPaths` `["/"]`（完全一致、末尾 `*` で前方一致）
- 門の入切は `src/config/featureGate/switches.config.ts`（`pnpm ops features set <name> on|off`）

### 受け口（extensionPoints.ts）

項目は `<受け口>/<名前>.ts` に `export const <単数> = { … }` で置き、`pnpm generate extensions` が `extensions/<受け口>.ts` にする（置くだけで載る）。項目の型は `@/lib/messaging`（src/lib/messaging/README.md「受け口の項目」）。fork は自分のドメインの同じ名前のフォルダに置く。

- `channels/`（`channel`: `MessageChannel`）: 送信チャンネル（プッシュ・SMS など。宛先の決め方・描き方の 3 段の宣言・送る関数・webhook・端末の帳簿の宛先の形。送信チャンネルは自分の欄を持たない）。上流は email・inApp・line（channels/README.md）
- `layouts/`（`layout`: `MessageLayoutItem`、フォルダ 1 つ = レイアウト 1 つ。メールの描き方 `email.tsx` と お知らせの描き方 `inApp.tsx` は別の生成の一覧 `layoutEmails`（server）・`layoutInApps`（client））: 見た目。上流は simple・notice・link・welcome・statement・alert。上流の物は隣の `layout.override.ts` で `disabled`（無効）・`adminSelectable` を変えられる（layouts/README.md）
- `enrichers/`（`enricher`: `MessageEnricher`）: 連絡に足す値（当て先 = 連絡の鍵・カテゴリー・種別・全部、provides の zod と日本語の別名、値を返す関数）。上流は `displayName`（管理者の連絡の宛名、名前が無ければ「お客様」）
- `categories/`（`category`: `MessageCategory`）: カテゴリー（種別・送信チャンネル・グループ・表示名・説明）。上流のカテゴリーは隣の `<名前>.override.ts` で `label`・`description`・`channels`・`defaultChannels`（送る画面で最初に入っている送信チャンネル）・`group`・`adminLabel`（管理画面の名前）を変えられる（`key`・`kind` は不可、functional・security の email は外せない = `pnpm check extensions`）
- `categoryGroups/`（`group`: `MessageCategoryGroup`）: カテゴリーのグループ（好みのページの見出し、同じ種別のカテゴリーだけ、`order` の順）。上流は出荷しない
- `sources/`（`source`: `MessageSource`）: 送り元の表示名。上流は管理の送り元 4 つ（`adminSend`・`adminSendTest`・`adminBulk`・`adminBulkTest`）。送信の詳細の送り元は `sources/` → 同じ鍵の連絡の `label` → 一括の対象 `<対象>.bulk(.test)` の順に引く（`services/server/admin/sourceLabels.ts`）
- 記録の宛先は受け口ではない: 持ち主のドメインの `<domain>/recordTargets/<名前>.ts`（`recordTarget`: `MessageRecordTarget`、型は lib/messaging）。管理一覧で選んだ記録 → 宛先（1 人 1 件 `{ userId, vars, recordIds }`）・送れる連絡定義の並び `messages`・送った後の処理（定義連絡の送る口の記録の入口だけ、D196）。鍵 = `<ドメインのフォルダ名>.<ファイル名>`。`pnpm generate registry` が `src/registry/recordTargetRegistry.ts` に集め（絞らない）、読み手は門番 `loadRecordTarget`（`services/server/domainGate.ts`、閉じたドメインを落とす）を通す。fork の物は fork の自分のドメインに置く。上流は `bankTransferReview.reviews`（services/server/admin/README.md）
- `adminBulkActions/`（`bulkAction`: `MessagingDispatchAdminBulkActionItem`、型は `types/adminBulkAction.ts`、client）: 送信一覧の一括操作。上流の既定 = `delete.tsx`（削除）。fork は項目を足す・`<名前>.override.ts` で `enabled`・`order`（作り方: src/lib/tableSuite/README.md「一括操作の受け口」）
- `subscribers/`（`subscriber`: `MessageSubscriber`）: 送った後の事件の購読（少なくとも 1 回）。上流の項目は無い（services/server/subscribers/README.md）

ほかの差し替え:

- 連絡の上書き `messages/<名前>.override.ts`（文言・`enabled`・`throttle`・`adminEditableOnly` など、src/lib/messaging/README.md）/ 見た目 = レイアウトの描き方の 1 行スイッチの `.replace`（`layouts/README.md`）
- 管理一覧の一括操作の項目 `<domain>/adminBulkActions/<名前>.tsx` は `bulkMessageAction`（components/README.md）
- 画面は fork が `_components/` の Screen で公開の入れ物・部品・hook を組む（CLAUDE.md core_ui）
- `constants/sources.ts` の `MESSAGING_SOURCES`: 送り元の識別子（wallet の失効の知らせが使う。`USER_HUB_DETAIL_SEND` / `SHIPPING_REQUEST_BULK` は fork の送り元として残す）

## Internals

部品ごとの形と背景（レイアウト・描き方の 3 段・定義・テンプレート・埋め込み情報・テキストの編集・送信の記録・秘密・受け取り箱・enrichers）は [Internals.md](Internals.md)。仕組みの詳細は各フォルダの README:

- 送る口の流れ（定義 → 送信 → 展開 → 配達 → 送信チャンネルの send → 記録）・間引き・配信停止の確かめ・宛先の引き方 → services/server/sendMessage/README.md
- 送信チャンネルの項目（メールの描き方・お知らせの共有の行・LINE の再送の鍵）→ channels/README.md
- 展開・送信の掃き出し・グループの固定・送信を閉じる・保持の掃除・続きを送る（cron `messaging-send-sweep` / `messaging-retention`）→ services/server/sweep/README.md
- 配信停止の判定（好み・宛先の停止・メールの List-Unsubscribe）→ services/server/preferences/README.md
- 受け取り箱の見える行・既読・画像の台帳・静かな行 → services/server/inbox/README.md
- 内部の事件と購読（cron `messaging-subscribers`）→ services/server/subscribers/README.md
- 生の SQL（`sql```）の日時は ISO の文字列 + `::timestamptz` か Drizzle の演算子（.claude/rules/core/services.md raw_sql）。生の SQL の組み立ては db を持たないファイル（`sweep/retentionSql.ts`・`inbox/cursorSql.ts` など）にあり、`services/server/rawSqlParams.test.ts` の一覧が検査する

## Verification

- `pnpm test src/features/core/messaging`（送る口・cron・好み・受け取り箱・管理の口・部品と hook）。DB の検査（`*.db.test.ts`）は `DATABASE_URL` がある時だけ
- 生成の一覧の全件の検査: `services/server/sendMessage/messageRegistry.test.ts`（上書きを重ねた後の定義・鍵の一致・カテゴリーの送信チャンネルの全部で描けるか）
- 受け口の検査: `pnpm check extensions`（カテゴリー・グループ・functional の email）
- 門: `FEATURE_GATE_CHECK=all pnpm test src/featureGate scripts/structure/proxies`
- 画面と送信の確かめ: `/devcheck`（送るモーダル・未読のモーダル・好みのページ・配信停止のページ）

## Related

- [lib/messaging](../../../lib/messaging/README.md) … 連絡定義・上書き・検査・受け口の項目の型
- [lib/mail](../../../lib/mail/README.md) … メールの送信と見た目の部品（メールの送信チャンネルの項目が使う）
- [userGroup](../userGroup/README.md) … グループ宛ての宛先（条件の部品・静的グループ・人数の上限）
- [analytics](../analytics/README.md) … 連絡の集計（門 `messagingAnalytics`、`/api/admin/analytics/messaging/**`）
- [auditLog](../auditLog/README.md) … 管理の操作の記録先
