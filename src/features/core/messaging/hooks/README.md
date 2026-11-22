# messaging/hooks

## Overview

連絡のドメインの hook(画面の流れとデータ)。入口は `hooks/index.ts` だけ(部品・画面・fork はここから読む)。
送る画面の hook は公開の部品として小さく分けてあり(D191)、上流の送るモーダル(自由連絡の `useMessageSendModal`、定義連絡の汎用のモーダル)もこれだけで組む。fork は同じ hook で自前の送る画面を組める。部品の使い分けは ../components/README.md。

## Usage

送る画面の公開の hook(どの送る画面にも共通の部品):

- 進行 `useSendSteps({ open, editing })`: 書く → 確認 → 結果(`toConfirm` / `backToEdit` / `finish(result)` / `reset`)。書きかけ(開いていて結果の段でなく `editing`)の間はページを離れる前に確かめ、Modal の `confirmOnClose` に渡す `closeConfirm` を返す
- 二重送信の鍵 `useIdempotencyKey()`: 開いた時に 1 つ、送るのに成功したら `renew`。鍵を作る関数は入口から出さない(鍵の持ち方を画面ごとに作らない)
- 表示例 `useSendPreview({ fetcher })`: 渡した口で「あなた宛ての表示例」を描いて持つ(`run` / `close`)
- 自分へのテスト送信 `useSendTest({ fetcher })`: 渡した口へ毎回新しい鍵を付けて送る
- 送信チャンネルの初めの規則 `initialChannelsOff(channels, on)`(純粋な関数): on に無い物を外し、全部外れる時は外さない
- レイアウトの描き方のプレビュー `useLayoutPreview`、送信の詳細の住所 `dispatchDetailHref(一覧の住所, id)`

定義連絡を管理者が送る口(`/api/admin/messaging/definitions/**`):

- 選択肢 `useDefinitionSendOptions({ recordTarget } | { entry: "broadcast" }, enabled)`
- 送る `useDefinitionSend()`(鍵は呼び手が `useIdempotencyKey` で持って渡す)、表示例 `useDefinitionPreview()`・テスト `useDefinitionTest()` = 上の 2 つを定義連絡の口でつないだ物
- 汎用のモーダルの流れ `useDefinitionSendModal({ entry, onSent? })`: 上の hook を組んだ物(連絡定義の選択・送信チャンネルの固定・管理者の値・直せる欄・宛先・予約・送る)。入れ物 `DefinitionSendModal` はこれを並べるだけ

送った後と 1 人宛ての材料:

- 送信の結果 `useSendResults(dispatchId, { limit? })`: 届かなかった人(無限スクロール、カーソル)と送信チャンネルごとの数
- 受け取れる送信チャンネル `useRecipientChannels(userId, { message } | { category } | {})`

口の形は ../services/server/admin/README.md の API。

## Verification

- 送る画面の公開の hook: `hooks/sendHooks.test.tsx`
- 自由連絡の送るモーダルの流れ: `hooks/sendModalHooks.test.tsx`
- 定義連絡の汎用のモーダルの流れ: `hooks/definitionSendModal.test.tsx`
