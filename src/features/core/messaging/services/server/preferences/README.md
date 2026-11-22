# preferences（配信停止の判定と好みの読み書き）

## Overview

配信停止の単位 = カテゴリー × 送信チャンネル。連絡定義の `category` がカテゴリーの鍵（受け口 `categories/`）。本人が好みを見て切り替える口（`messagingService.getMessagePreferences` / `setMessagePreference`）と、送る口・受け取り箱が使う停止の判定を持つ。画面は ../../../components/README.md。

- 好みに従う連絡 = 種別の性質 `userStoppable`（activity・promotion）で required でない連絡。ほかの種別と required は好みを見ない
- 門: `messagingPreferences`（住所 ページ `/mypage/account/notifications` と API `/api/me/messaging/preferences`、`dependsOn: ["pageMypage"]`、既定 閉）。閉の間ページと API は 404。表とワンクリックの受け口は門に関わらず開。住所の定数は `constants/preferences.ts`（`MESSAGE_PREFERENCES_PAGE_PATH` / `MESSAGE_PREFERENCES_API_PATH`）

## API

- `GET /api/me/messaging/preferences` → `MessagePreferencesDto`（`dto.ts`）= `{ allOptedOut, categories[{ key, optedOut }], kinds[{ kind, optedOut }], groups[{ key, label, kind, optedOut }], channels[{ key, label, hasAddress, connectHref, optedOut, kinds[{ kind, groups[{ key, label, optedOut, categories[{ key, label, description, optedOut, via }] }] }] }] }`
  - 形 = 送信チャンネル（有効な送信チャンネル）> 種別の枠（`userStoppable` の種別、`MESSAGE_KINDS` の順）> グループ（受け口 `categoryGroups`。グループの無いカテゴリーは `key` null で先、見出しは `order` の順）> カテゴリー。送信チャンネルに出るカテゴリー = カテゴリーの送信チャンネルにその送信チャンネルがある。カテゴリーの無い送信チャンネルは `kinds` が空
  - 広い停止の状態: `allOptedOut`（全部）・`categories[].optedOut`（カテゴリーまるごと）・`channels[].optedOut`（送信チャンネルまるごと）・`kinds[].optedOut`（種別まるごと）・`groups[].optedOut`（グループまるごと、全送信チャンネル `"*"`。利用者が止められるカテゴリーを持つ見出しのグループごと）・`channels[].kinds[].groups[].optedOut`（グループ × その送信チャンネル）。全部の停止はほかの行の値を書き換えない（画面が `allOptedOut` から見せ方を決める）
  - `via`（`cell` / `category` / `group` / `kind` / `channel` / `all` / null）= どの行で止まっているか（この順で先に当たった物）
  - `hasAddress` = 送信チャンネルの `resolveAddresses`、無ければ端末の帳簿の有効な行（送る側の展開と同じ）/ `connectHref` = 送信チャンネルの項目の宣言（サイト内の住所は門で閉じていれば null。上流は line だけ: `/api/auth/line/login?redirect_after=<好みのページ>`）
- `PATCH` → 変えた後の表。止め方は 6 つ: 1 マス `{ category, channel, optedOut }`・カテゴリーまるごと `{ category, channel: "*" }`・送信チャンネルまるごと `{ category: "*", channel }`・全部 `{ category: "*", channel: "*" }`・種別まるごと `{ kind, optedOut }`・グループまるごと `{ group, channel?, optedOut }`（`channel` 省略か `"*"` = 全送信チャンネル、D123）。知らないカテゴリー・知らないグループ（利用者が止められるカテゴリーの無いグループも）・止められないカテゴリー・開いていない送信チャンネルは 400。止める = 行を足す（あれば何もしない）、再開 = 行を消す
- `setMessagePreference(userId, input, { source? })`: `source` = 書いた入口（既定 `user`、会員登録の同意なし = `PREFERENCE_SIGNUP_SOURCE` `signup`）。サーバーの呼び手だけが渡す

## Internals

- 好み（`message_preferences`、止めた時だけ行）: 利用者 × カテゴリー × 送信チャンネル × 種別。カテゴリー・送信チャンネルの `"*"`（`MESSAGE_ALL`）は全部に当たる。種別まるごとの行（`kind` X、`"*"` `"*"`）は種別 X の全カテゴリー・全送信チャンネル（後から足すカテゴリーにも）。`kind` が `"*"` の行は種別を問わず、`kind` のある行は連絡の種別が同じ時だけ当たる（service の行は `"*"` を null で持ち、読み替えは `store.ts` だけ）
- グループまるごとの行（D123）: `category` = `"group:<グループの鍵>"`・`channel` = 送信チャンネルか `"*"`・`kind` `"*"`（列は足さない。カテゴリーの鍵は `:` を含まないので重ならない）。当たるカテゴリーは送る時・読む時にカテゴリーの受け口の `group` で決める（後からグループに入れたカテゴリーも止まる、外したカテゴリーは止まらない）。書き方と引き方は `groupRows.ts`（`groupRowCategory`・`groupRowOfCategory`・`preferenceCategoryKeys`）
- **当たる行が 1 つでもあれば止める**（和。許可の行・優先の順は無い）。送る口（`findOptOuts` → `checkStops`）・受け取り箱の見え方（`inbox/visibility.ts`）・好みの見え方（`preferenceVia`）の 3 か所が同じ判定
- 広い行の下で 1 マスを再開すると 1 つの transaction で書き分ける: 種別まるごと → 種別の行を消し、同じ種別のほかのカテゴリーはカテゴリーまるごと、このカテゴリーのほかの送信チャンネルはマス / カテゴリーまるごと → このカテゴリーのほかの送信チャンネルのマス / グループまるごと（`"*"`）→ 同じグループのほかのカテゴリーはカテゴリーまるごと、このカテゴリーのほかの送信チャンネルはマス / グループ × 送信チャンネル → 同じグループのほかのカテゴリーでその送信チャンネルを持つ物のマス（書き分けた後はグループの行が無いので、後から入ったカテゴリーは止まらない）/ 送信チャンネルまるごと → その送信チャンネルを持つほかのカテゴリーのマス。**全部の行は書き分けない**（via all のまま）。書き分けは今あるカテゴリーの行だけ
- カテゴリーとグループの受け口は初めて使う時に `validateMessageCategories` で確かめる（`pnpm check extensions` と同じ検査）
- 宛先の停止（`message_suppressions`、正規化した宛先 = 前後の空白を外して小文字の sha256）: required でない連絡は `hard_bounce`・`complaint`・`manual` にいつも従い、`one_click` は範囲が連絡のカテゴリーか `"*"` の時だけ。required は `hard_bounce` だけ。宛先が複数なら止めた宛先だけ外す。住所の停止に従う種別は性質 `addressStop`（functional・security は hard bounce だけ）
- 全員・ロール宛てのお知らせの共有の行は書く時に好みを当てず、受け取り箱が読む時に送信の `category` と見る人の inApp の好みで外す
- メール: 好みに従う連絡の宛先に `List-Unsubscribe: <停止の URL>`・`List-Unsubscribe-Post: List-Unsubscribe=One-Click`（送信チャンネルの宛先 `ChannelSendTarget` の `category`・`headers`）。本文の最後の停止のリンクは、門 `messagingPreferences` が開なら好みのページ、閉なら確認のページ（../unsubscribe/README.md）。provider の一括停止の機能は使わない
- 退会: user の後片付けの項目 `cleanupHandlers/messagingPreferences.ts`（required）が本人の行を消す（利用者の削除の FK cascade でも消える）

## Verification

- `pnpm test src/features/core/messaging/services/server/preferences`（`store.db.test.ts` は `DATABASE_URL` がある時だけ）と `services/server/sendMessage/stops.test.ts`
