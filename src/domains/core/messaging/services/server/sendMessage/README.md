# sendMessage（送る口）

## Overview

連絡定義（`defineMessage`）を受けて送信と配達を書き、送信チャンネルの項目で送る口。公開の入口は `messagingService`（`../messagingService.ts`）の `sendMessage` / `sendMessageToMany` / `sendFreeMessage` / `previewMessage` / `estimateRecipients`。使い方と宛先の線はドメインの README（../../../README.md）。

## API

- `sendMessage(definition, { recipient, vars, idempotencyKey?, scheduledAt?, source?, … })`: 1 人（`{ userId }` か `{ channel, address }`）
- `sendMessageToMany(definition, { target | recipients, vars, … })`: `target` = `MessageTargetSpec`（`{ type: "all" }` / `{ type: "role", roles }` / `{ type: "group", groupId }`）か `recipients: [{ userId }, …]`
- `sendFreeMessage({ origin: { layout } | { id, version }, values, edited?, category, vars?, recipients | target, channels?, scheduledAt?, … })`: 自由連絡 = カテゴリー + レイアウトか DB のテンプレート + 欄の中身で送る（管理の送信、D117・D125・D171）。管理の送る画面・一括送信も fork のコードからの管理の送信も同じ口（下の「fork のコードから管理の送信」）
- `previewMessage`（送信チャンネルごとの組んだ中身 `fields` と描いた結果）・`estimateRecipients({ target })` → `{ count, fixedAtSend: true, memberLimit?, overLimit? }`（グループは一員の数と人数の上限、利用できない人を外す前の数。送る時に展開で数え直す）
- 戻り値は送信の id・状態・数。選んだ宛先で宛先の無い受信者・止めた受信者は理由つきで返る
- 定義の誤りは 500、`enabled: false` は送信を作らず `status: "disabled"`、vars の誤り・知らない鍵は 400、冪等の鍵の重複は 409
- 連絡はその定義のフォルダのドメインに属する（生成の一覧の鍵 `<ドメインのフォルダ名>.<ファイル名>`）。ドメインが門で閉じていれば（そのフォルダを載せた機能が全部閉、`gate.domainOpen`）、送る口は送信も配達も作らず `status: "disabled"` を返す（投げない = 呼び手の業務は止めない、警告を 1 行）。上流のドメインも fork のドメインも同じで、fork は自分の規則の入切で自分の連絡を止められる（`domainGate.ts`、D77）
  - cron（掃き出し）は閉じたドメインの連絡の置いてある行を送らず、状態を戻して 1 時間先送りする（開けば送る。保持の掃除の日数を過ぎれば消える）
  - テキストの編集も閉じたドメインの連絡を一覧に出さず、1 件・保存・戻すは 404

## Internals

### 流れ

1. 生成の一覧（`messageRegistry`）の定義に上書きを `applyMessageOverride` で重ね（所属のカテゴリー = 送る時に決めた物（送信に残したカテゴリー、組み直し）> 上書きの付け替え `category`（D166）> 定義。種別・送信チャンネルは付け替えた先のカテゴリーから、上書きの `channelModes` は固定を丸ごと差し替える）、`validateMessageDefinition` で検査（レイアウト・欄の中身・`{{鍵}}`）。最後にテキストの編集（門 `messagingOverrides` が開の時、欄の道 = レイアウトの欄の鍵、../overrides/README.md）を欄ごとに重ねる（`resolveDefinition` の 1 か所。版を移せない・検査を通らない行はコードの値、警告 1 行）。重ねた値は送信の `values` に入るので、組み直しは送った時の文言のまま
   - 専用の日付・日時の値は差し込む時に人が読む字にする（型の印 `<鍵>@type` から、lib `displayVarValues`。送信に残す値は ISO）。共通の値 `serviceName`・`serviceNameShort`・`appBaseUrl` は `deps.context()`
   - 差し込みの表には共通の埋め込み情報と当たる enrichers の日本語の別名の行も入る（vars のうち enricher と同じ鍵の値もその別名で書ける。例 wallet の `displayName` = `{{表示名}}`）（`{{受信者名}}` = `{{recipientName}}`、D126。`content.ts` が `varMap` で足す）。定義の検査も別名を通す
   - 中身の組み立ては `content.ts` の 1 つ（`buildContent` / `buildContents`）: 定義の欄の中身に差し込む → 送信チャンネルごとに描き方の 3 段（lib/messaging `buildChannelContent`: レイアウトの描き方 > 送信チャンネルの汎用 > 要約）→ 中身と見出し（要約の題）。email = `MessageLayoutContent`（送信チャンネルが宛先ごとに描く）、inApp = `MessageLayoutContent` + レイアウトの版（送信チャンネルが受け取り箱の行に要約の列とレイアウト・欄の中身を書く、`buildRowContent` が記録の段と秘密の決まりを当てる）、line = 要約から。どの段でも描けない送信チャンネルは送信を書く前に 500（送信チャンネルと理由）
   - 組み立てを通る所: 送信の見出し（秘密の鍵は差し込まない）・全員同文の描画（`rendered`）・その場の行・プレビュー・まとめ送りの描き直し・cron の共有のお知らせの行・cron の送る行・テキストの編集のプレビュー
   - enrichers は当て先（連絡の鍵・カテゴリー・種別・全部、D127）で選ぶ。使える鍵の検査（`enricherKeysFor`）と実行（`context.ts`）が同じ `enrichersFor`
2. 冪等の鍵を `message_dispatches` と `message_idempotency_keys` の両方で確かめる（重複・INSERT の UNIQUE 違反は 409）
3. 送信を 1 行書く（`message_key`・`kind`・`category`・`target`・`record`・`headings`・`channel_counts` など）
4. 小さな送信（選んだ宛先が `smallSendMaxRecipients` 人以下）: 受信者 × 送信チャンネルに展開して配達の行を作り、最初の束（`inRequestBatchSize`）を送信チャンネルの `send(targets)` へ。残りは `queued` + `next_attempt_at` で cron が送る
5. 大きな送信と `target`（全員・ロール・グループ）: 送信だけを書き（`processing`）、展開と送信は cron が束ごとに行う（`expand.ts` の `expandBroadcastChunk`・`resolveTargetChunk`、グループの固定は ../sweep/README.md）
6. 予約（`scheduledAt`）: 送信だけを `scheduled` + `scheduled_at` で書く（選んだ宛先の一覧も送信の `target` に）。cron が時刻に `processing` にして 5 と同じく送る。粒度は cron の周期

### 送信の記録と組み直し（dispatchResolved.ts、D128）

- 送信に残す物: 出どころ（定義連絡の鍵 `message_key` / DB のテンプレートの `template_id`・`template_version`。どちらも無い = 自由連絡のレイアウトだけ）・直した印（`template_edited`）・カテゴリー・種別・送信チャンネル・レイアウトの鍵と送った版（`layout`・`layout_version`）・欄の中身（`values`、差し込む前の字）
- `values` の残し方は `vars` と同じ: record `vars` / `full` は残す、`meta` は送り残しの間だけ（送信を閉じる時に消す）、required と秘密を差し込む連絡は残さない
- お知らせの行（`message_inbox_items`）は記録ではなく届けた中身: 記録の段・required に依らずレイアウトの鍵・版・欄の中身を残す（秘密の欄は空の字で差し込む、D120・D130）。書き手 = その場の行・cron の送る行・間引き（どれも `buildRowContent`）と cron の共有の行
- 組み直し（cron の送る行・全員宛ての共有のお知らせの行・失敗の再送・送信の詳細の「同じ内容で送る」）は送信の物と `vars` だけで描く（`resolvedOfDispatch`）。定義・テンプレート・テキストの編集は引き直さないので、送った後に直しても予約・後回しの中身は変わらない
  - 送った版から今の版へレイアウトの改版の対応（`revisions[版]`）で読み替える。段の対応が無い・今より新しい版 = `layout_unreadable`、レイアウトが無い = `layout_missing`、欄の中身が無い = `values_missing`（cron は配達を `failed`）
  - 描かない振る舞い（間引き `throttle`・required・静かなお知らせ `silent`・vars の zod の秘密の印）だけはコードの定義（`message_key` の生成の一覧の定義 + fork の上書き）から読む。定義が無ければ間引かない

### 自由連絡（templateDefinition.ts、D117・D125・D171）

- 出どころ `origin` = レイアウト `{ layout: 鍵 }`（管理画面で選べる `adminSelectable` の物だけ。無い・ほかのレイアウトは 400、`sender.ts` の `freeSourceOf`）か DB のテンプレート `{ id, version }`（型 `MessageFreeOrigin`）。管理用の連絡定義は持たない
- 送信: `message_key` は null（定義の鍵は `TEMPLATE_MESSAGE_KEY` = `messaging.template`。送信にも事件にも書かない）。出どころはレイアウト（`layout`）だけか `template_id`・`template_version`
- カテゴリー（必須）の種別は自由連絡で送れる種別（性質 `adminFreeText` がある announcement・direct・promotion、`adminSendableKinds`）。種別はカテゴリーから（レイアウトは種別を持たない）。誤りは 400
- **送信チャンネル = カテゴリーの送信チャンネル − 定義の off 固定 ∩ その送信の絞り（`channels`）**（`resolveChannels`、連絡定義の `channelModes` D212）。コードの送信は off を黙って落とす。絞りは free の中から選び on はいつも入る。カテゴリーの外・off・空の絞りは 400
- `values` = レイアウトの欄の中身（選んだレイアウト、DB のテンプレートは版のレイアウト）。レイアウトの欄の zod で検査し、`{{鍵}}`・`{{別名}}` = 埋め込み情報の一覧（共通 + 当たる enrichers + 版の専用の宣言）の中だけ（知らない名前・名前の重なりは 400）。上書きは重ねない
- 専用の別名（`{{開始日時}}`）は定義にする前に `{{鍵}}` へ書き換える（送信の `values` は鍵だけ: cron の組み直しは宣言を引き直さない）
- 直した印 `template_edited` = 入力の `edited: true` か、送る中身（書き換えの前）が版の中身（今のレイアウトの版へ読み替えた物）と違う（false は信じない。レイアウトの送りはいつも false、`edited: true` は 400）
- DB のテンプレート: 今の公開版を送信に固定（今の公開版でない・取り下げ済み・未公開は 409、無いテンプレートは 404）。専用の値 `vars`（`{ 鍵: 値 }`、送信に 1 組、レイアウトの送りでは 400）は版の宣言の型で検査（必須の欠け・型の違いは 400、空は既定値）。値は送信の `vars` に残り（定義連絡の vars と同じ 1 つの列、D202）、残し方・消し方も同じ。cron・再送の差し込みの表 = 送信の `vars`（検査し直さない）
- 送信には欄の中身（`values`）を残し、予約・cron の組み直し・再送はその中身で描く（後でテンプレートを直しても送った中身のまま。再送は同じ出どころを残す）
- 画像（`storage://`）: お知らせの行を書く時に送信へ結ぶ（../inbox/README.md「画像」）。テンプレートの画像も送信ごとに複製して送信が持つ

### fork のコードから管理の送信

管理者が画面で送るのと同じ形を、fork のサーバーのコード（service・cron・route）から送る。管理者の確かめは呼び手の責任（送る口は管理者を見ない）。

```ts
import { messagingService } from "@/domains/core/messaging/services/server";

await messagingService.sendFreeMessage({
  origin: { layout: "simple" }, // 管理画面で選べるレイアウト(adminSelectable)。DB のテンプレートなら { id, version }(今の公開版)
  values: { subject: "メンテナンスのお知らせ", body: "{{displayName}} 様、…" }, // レイアウトの欄の中身
  category: "announcement", // 種別 announcement・direct・promotion のカテゴリー
  target: { type: "all" }, // か recipients: [{ userId }]
  source: "myFeature.maintenance",
});
```

### 宛先の引き方

- 利用者の宛先は送信チャンネルの `resolveAddresses`、無ければ端末の帳簿（`message_endpoints` の有効な行）。宛先が複数なら 1 行の `targets` にまとめ、1 つでも送れたら `sent`
- 選んだ宛先で宛先の無い受信者は `suppressed` + `no_address` の行。全員・ロール・グループは行を作らず `channel_counts.<送信チャンネル>.skipped_no_address` に数える
- 送信チャンネルの項目が無い・`enabled: false` は `channel_off`。受信者の鍵は `user:<id>` か `addr:<正規化した宛先の sha256>`
- 帳簿を読む送信チャンネルで送れた宛先の `last_used_at` を送信チャンネルごとに 1 回の UPDATE で記録（失敗しても結果は変えない）

### 配信停止の確かめ（stops.ts）

- 確かめる所: 小さな送信の展開・cron の展開・cron が送る直前（キューの後で止めた人も外す。宛先の 1 つにもう送れた行は sent のまま送り直しをやめる）
- 判定（`findOptOuts` → `checkStops`）は好みの見え方・受け取り箱の見え方と同じ（../preferences/README.md）
- 外した受信者: 選んだ宛先は `suppressed` + `preference` / `suppression` の行、全員・ロール・グループは行を作らない。どちらも `channel_counts.<送信チャンネル>.suppressed` に数え、どの送信チャンネルでも止められた受信者は `recipient_count` から引く
- メール: 好みに従う連絡の宛先に送る口が `category` と `List-Unsubscribe`・`List-Unsubscribe-Post`（RFC 8058）を付ける。**`category` があるのに鍵 `MESSAGING_UNSUBSCRIBE_SECRET` が無い = 送らず permanent（`unsubscribe_key_missing`）**

### 送信の結果

- ChannelError の分類: `sent` → `sent` / `permanent` → `failed` / `unknown` と send が投げた例外 → `unknown`（自動で送り直さない）/ `transient` → 非 required は `queued` のまま `next_attempt_at` を広げて cron（`transientRetry`、尽きたら `failed`）
- 送信チャンネルの冪等の鍵 = 配達の行の id（宛先が複数なら `<id>:<番号>`）

### 本文の残し方（定義の `record`、既定 `vars`）

- `meta` = 件名・題（`headings`）だけ / `vars` = + 送信の vars の写しと全員同文の描画結果（`rendered`）+ 受信者ごとの値 / `full` = + 受信者ごとの本文（配達の `body`）
- required と `secretVar` の鍵を持つ連絡は本文をどこにも残さない（`full` でも、誤りの文も理由の符号だけ）。秘密の鍵は vars の写し・件名・題に入れない。required は vars の写しも残さない
- これらの連絡はキューに置けないので要求の中で送り切る（一時の失敗は `requiredRetry` の回数だけ短く再送）。全員・ロール・グループ宛てと大きな送信は 400
- 送り残しがある送信は cron のために vars を持ち、`meta` なら送信を閉じる時に消す
- 受信者ごとの監査ログは書かない（配達の行で追う。管理者の操作は管理の口が監査）

### 間引き（throttle.ts）

定義か上書きの `throttle: { by, mode, seconds }` を持つ連絡は、送信チャンネルの send の前に受信者ごとに間引く（要求の中の送りも cron も同じ処理）。上流の定義は宣言しない。

- 鍵 = 受信者の鍵 × `message_key` × `by` の値（送信の vars）の sha256。配達の行と受信者ごとのお知らせの `throttle_key` に入る
- `untilRead`（送信チャンネルに inApp）: 同じ鍵の未読のお知らせがあれば置き換える（中身を最新に、`collapsed_count` + 1、前の送信を `collapsed_dispatch_ids` に、`dispatch_id` は今の送信、`published_at` = 今）。inApp の配達は `sent` + `throttled`、ほかの送信チャンネルは `suppressed` + `throttled`（送信の `skipped_throttled`）
- `window`（と inApp の無い `untilRead`）: 同じ鍵の前の送り（`seconds` 以内に sent か送る途中）があれば間引く。inApp は未読なら置き換え、既読なら新しいお知らせ。間引いた行は window の起点にしない
- 最初の 1 通・window の後・既読の後はふつうに送る。`{{collapsedCount}}` = ふつうは 1、置き換えた時はその回数（throttle のある連絡だけの鍵）
- 排他: 鍵の `pg_advisory_xact_lock` を持った取引の中で送信 × 受信者の行を読み直して 1 度だけ決め、その受信者の全部の行に書く（要求の中と cron が重なっても 2 通にならない。送信チャンネルの呼び出しの間は lock を持たない）。お知らせの行はこの取引の中で書く（形は `src/domains/core/messaging/plugs/messagingChannels/inApp/createInAppChannel.ts` の `inAppItemRow`）
- 間引くのは受信者ごとの行だけ: 全員・ロール宛て（共有の 1 行）は間引かない。グループ宛てと選んだ宛先は間引く
- `collapsed_dispatch_ids` は FK を持たない。削除・保持・画像はお知らせの今の `dispatch_id` に従う

## Verification

- `pnpm test src/domains/core/messaging/services/server/sendMessage`（`sender` / `content` / `stops` / `throttle` / `authoredSend` / `schedule`）
- `messageRegistry.test.ts`: 生成の一覧の全件を上書きを重ねた後に検査（`checkMessageRegistry`、鍵の一致・カテゴリーの送信チャンネルの全部で描けるか）。出荷の前に通す
- `store.db.test.ts` は `DATABASE_URL` がある時だけ
