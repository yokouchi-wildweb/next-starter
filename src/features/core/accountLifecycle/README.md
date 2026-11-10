# accountLifecycle — 休会・退会・復帰

本人がアカウントを休会する・退会する・休会から戻る手続きを集めた、表を持たない core ドメイン(設定の議会 D118・D125)。状態は user の列 `status`、遷移の記録は user の `recordStatusTransition`(`user_status_histories`)が持つ。

## 中身

```
accountLifecycle/
├── services/
│   ├── server/pause.ts        # active → inactive(状態の履歴 self_pause・監査)
│   ├── server/withdraw.ts     # active → withdrawn + user の executeCleanup(受け口 cleanupHandlers)・監査、1 トランザクション
│   ├── server/reactivate.ts   # inactive → active(self_reactivate)
│   └── client/{pause,withdraw,reactivate}.ts   # POST /api/account-lifecycle/<name> を呼ぶ ClientService
├── hooks/{usePause,useWithdraw,useReactivate}.ts
└── components/
    ├── Pause/(PauseDescription)       # /mypage/pause
    ├── Withdraw/(WithdrawDescription) # /mypage/withdraw
    ├── Reactivate/                    # /reactivate
    └── OtherActions.tsx               # /mypage/other(休会・退会の入口。閉じた機能のカードは棚の Link が描かない)
```

- API: `POST /api/account-lifecycle/pause`・`/withdraw`(認証済み、成功後に userLoginEvent の `recordLogoutEvent` と Cookie の削除)・`/reactivate`(休会中 `inactive` だけ、Cookie を出し直す)
- 画面: `/mypage/pause`・`/mypage/withdraw`・`/mypage/other`・`/reactivate`(`src/app/(user)/...`)

## 入切

- 門番の規則 `pause`(`/api/account-lifecycle/pause`)・`withdraw`(`/api/account-lifecycle/withdraw`)と、マイページとの交わりの規則 `mypagePause`・`mypageWithdraw`・`mypageOther` が住所を閉じる
- このフォルダはどの規則の `domains` にも載らない基盤(D125): 表・汎用 API・cron を持たず、閉じる物は住所だけ。休会を閉じても、休会中の人の復帰(`/reactivate` の画面と `/api/account-lifecycle/reactivate`)は塞がない(`/reactivate` の loader は `pause` が閉なら notFound)

## ほかのドメインに残すもの

- user: 列 `status`・`recordStatusTransition`・`executeCleanup` と受け口 `cleanupHandlers`・`setStatusWithdrawn`(管理のソフトデリートも使う)・drizzle の base
- userLoginEvent: `recordLogoutEvent`(route が呼ぶ)
- auth: セッションの Cookie の発行・削除
