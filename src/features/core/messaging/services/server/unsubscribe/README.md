# unsubscribe（配信停止の受け口と確認のページ）

## Overview

メールの配信停止のリンクの受け口 `/api/messaging/unsubscribe` と、人が開く確認のページ `/unsubscribe`。どちらも常に開（門の外、ログイン不要）。署名つきトークンで止める種類と経路を運ぶ。

## API

- 引数の名前は `token`（API とページで同じ、`UNSUBSCRIBE_TOKEN_PARAM`）
- `POST /api/messaging/unsubscribe?token=…`: RFC 8058 のワンクリックと確認のページのボタン。止めるのはこの POST だけ → `{ ok: true }`、トークンの誤りは 400 `{ ok: false, error: "invalid_token" }`。何度届いても同じ。HTML は返さない
- `GET /api/messaging/unsubscribe?token=…`（One-Click に対応しないメールソフトでヘッダの URL を人が開いた時）: 止めずに同じトークンで確認のページへ 303（`unsubscribePageUrlForToken`、起点 `getAppBaseUrl()`）。トークンは確かめない（誤りはページが見せる）。古い `?t=` は運ばない
- 確認のページ `/unsubscribe?token=…`（`src/app/(user)/(public)/unsubscribe/`、access public）: loader が `describeUnsubscribeToken`（止める種類と経路の表示名、書き込みなし）→ 入れ物 `components/Unsubscribe`（確認 → `useUnsubscribe(token)` の `submit` = POST → 結果）。見た目は fork が `_components/` の Screen で差し替える

## Internals

- トークン = base64url(JSON `{ v: 1, r, c, ch, a?, mk?, d? }`) + `.` + HMAC-SHA256(`MESSAGING_UNSUBSCRIBE_SECRET`)。`r` 受信者・`c` 種類・`ch` 経路・`mk` 送った連絡の鍵・`d` 送った回の id（`mk`・`d` の無い前のトークンも同じ版で通り、結び付きは null）。`signUnsubscribeToken` / `verifyUnsubscribeToken` / `isUnsubscribeConfigured`（`token.ts`）
- 住所は 2 つ: ワンクリックの POST の先 = `buildUnsubscribeUrl`（`getAppBaseUrl()` + `/api/messaging/unsubscribe?token=`、`List-Unsubscribe` のヘッダ）/ 確認のページ = `buildUnsubscribePageUrl`（`/unsubscribe?token=`、メールの本文のリンク）。メールの項目はヘッダの URL から `unsubscribePageUrlOf` で同じトークンのページの URL を作る（好みのページが開いていれば本文のリンクはそちら）
- 止める行（`recordOneClick.ts`）: `user:<id>` → `message_preferences`（種類 × 経路、source `one_click`）/ `addr:<hash>` → `message_suppressions`（reason `one_click`、scope = 種類）
- 停止を連絡・回に結ぶ: どちらの行にも `source_message_key`・`source_dispatch_id`（トークンの `mk` / `d`）。好みのページ・前のトークン・バウンスの停止は null。同じ行が既にあれば書き換えない（最初の出どころが残る）。`source_dispatch_id` は FK を持たない（回が消えても停止の行は残す）
- 鍵 `MESSAGING_UNSUBSCRIBE_SECRET` は `pnpm ops setup env` が乱数で作る（既にある env ファイルにも足りなければ足す）。変えると送ったメールの停止のリンクは無効になる。鍵が無いと好みに従うメールは送られない（../sendMessage/README.md）

## Verification

- `pnpm test src/features/core/messaging/services/server/unsubscribe` と `src/app/api/messaging/unsubscribe/route.test.mts`
- `curl -i "<origin>/api/messaging/unsubscribe?token=abc"` は 303 で Location `<app base url>/unsubscribe?token=abc`、何も記録しない
