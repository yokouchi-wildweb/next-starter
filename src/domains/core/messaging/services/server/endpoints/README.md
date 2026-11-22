# endpoints（端末の帳簿）

## Overview

利用者 × 送信チャンネル × 宛先（プッシュの購読トークン・電話番号など）の帳簿 `message_endpoints`。読むのは自前の宛先の引き方（`resolveAddresses`）を持たない送信チャンネルの項目（送る口が有効な行から宛先を引く）。

- 受け付ける送信チャンネル: 送信チャンネルの受け口に項目があり、`enabled` で、`resolveAddresses` を持たない送信チャンネルだけ。**上流の email・inApp・line は自前の帳簿なので受け付けない（上流だけでは登録できる送信チャンネルが 0 で、どれも 400）**。push・SMS などを fork が足すと登録できる
- 通知の許可・Service Worker・ネイティブの SDK は fork が持つ（ここは宛先を受けて残すだけ）

## API

- `/api/me/messaging/endpoints`（`createMeRoute`、門なし = 常に開）
  - `GET` 本人の一覧 / `POST` `{ channel, address, kind?, metadata? }`（本人の同じ宛先は更新して有効に戻す。**他人が登録した宛先は付け替えず 409**）/ `DELETE ?id=`（他人の id は 404）
  - 返す DTO: `id`・`channel`・`kind`・`addressHint`（宛先の末尾 6 文字）・`isActive`・`lastUsedAt`・`createdAt`。宛先の全体と `metadata` は返さない
  - 汎用の形: `address` 2048 文字まで、`kind` 32 文字まで、`metadata` は平らな値で 2KB まで（秘密は入れない）
- 送信チャンネルごとの宛先の形: 送信チャンネルの項目が `endpoint: { address: <zod> }` を宣言すると登録の口がそれで検査し（誤りは 400）、変換の後の値を残す。例（fork の SMS）: `endpoint: { address: z.string().transform((v) => v.replace(/-/g, "")).pipe(z.string().regex(/^\+[1-9]\d{6,14}$/)) }`
- client `services/client/endpointClient.ts`、hook `useMessageEndpoints()`（`{ endpoints, register, remove, … }`）

## Internals

- 最後に使った時刻: 送る口が送れた宛先の `last_used_at` を送信チャンネルごとに 1 回の UPDATE で記録（送れなかった宛先は記録しない。記録の失敗は警告だけ）
- 退会: user の後片付けの項目 `cleanupHandlers/messagingEndpoints.ts`（required、失敗したら退会ごと戻す）が本人の行を全部消す

## Verification

- `pnpm test src/domains/core/messaging/services/server/endpoints`
