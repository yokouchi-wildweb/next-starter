# accountLifecycle — 休会・退会・復帰

## Overview

本人がアカウントを休会する・退会する・休会から戻る手続きを集めた、表を持たない core ドメイン。状態は user の列 `status`、遷移の記録は user の `recordStatusTransition`(`user_status_histories`)が持つ。

- 休会: `active` → `inactive`(状態の履歴 `self_pause`・監査)
- 退会: `active` → `withdrawn` + user の `executeCleanup`(受け口 `cleanupHandlers`)・監査を 1 トランザクションで
- 復帰: `inactive` → `active`(`self_reactivate`)
- 画面: `/mypage/pause`(`Pause`)・`/mypage/withdraw`(`Withdraw`)・`/reactivate`(`Reactivate`)・`/reactivate/complete`・`/mypage/other`(`OtherActions` = 休会・退会の入口。閉じた機能のカードは棚の Link(`@/components/Navigation` の Link。閉じた機能へのリンクは描かない)が描かない)。ルートは `src/app/(user)/...`
- 呼び出しの層: 画面の部品 → hooks `usePause` / `useWithdraw` / `useReactivate` → ClientService(`services/client`)→ API → ServerService(`services/server`)

## API

- `POST /api/account-lifecycle/pause`・`/withdraw`: 認証済み。成功の後に userLoginEvent の `recordLogoutEvent` と Cookie の削除
- `POST /api/account-lifecycle/reactivate`: 休会中(`inactive`)だけ。Cookie を出し直す

## Extension

設定の持ち主 `config.ts`(既定・型 `AccountLifecycleOverride`・合成 `accountLifecycleConfig`)、上書き `src/config/features/accountLifecycle.config.ts`(値はリテラル。置き方: `src/config/README.md`)。

- `withdraw.description: string`: 退会の画面(`/mypage/withdraw`)の説明文。`WithdrawDescription` が 1 つの段落で出し、`\n` は改行になる。既定は 2 文(データにアクセスできなくなる・再利用は新規登録)。画面を写さずに文だけ変える受け口

## Internals

### 入切

- 門番の規則 `pause`(`/api/account-lifecycle/pause`)・`withdraw`(`/api/account-lifecycle/withdraw`)と、マイページ × 機能の規則(親 `pageMypage` と子の両方に依存する規則)`mypagePause`・`mypageWithdraw`・`mypageOther` がパスを閉じる
- このフォルダはどの規則の `domains` にも載らない基盤: 表・汎用 API・cron を持たず、閉じる物はパスだけ
- 門番の規則 `pause` は復帰のパス(`/reactivate` と `/api/account-lifecycle/reactivate`)を載せない(後から閉じても既に休会中の人が API で戻れるように)。画面 `/reactivate` は loader が `pause` の閉で notFound を返す

### ほかのドメインに残すもの

- user: 列 `status`・`recordStatusTransition`・`executeCleanup` と受け口 `cleanupHandlers`・`setStatusWithdrawn`(管理のソフトデリートも使う)・drizzle の base
- userLoginEvent: `recordLogoutEvent`(route が呼ぶ)
- auth: セッションの Cookie の発行・削除

## Verification

- 設定の合成: `pnpm test src/features/core/accountLifecycle/config.test.ts`

## Related

- 状態と履歴・退会の後始末の受け口: `src/features/core/user/README.md`
- 門番の規則: `src/featureGate/README.md`
