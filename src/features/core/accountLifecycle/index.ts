// src/features/core/accountLifecycle — 休会・退会・休会からの復帰(本人の手続き)。表は持たない(状態は user の列 status、履歴は user の statusHistory)。中身: ./README.md
// 住所の入切は門番の規則 pause・withdraw(と画面の mypagePause・mypageWithdraw・mypageOther)。このフォルダは基盤(どの規則の domains にも載らない、設定 D125):
// 閉じるのは住所だけで、休会を閉じても休会中の人の復帰(/reactivate・/api/account-lifecycle/reactivate)は開いたまま
// 入口: 部品 ./components/<Name>、hook ./hooks/<name>、サーバーの処理 ./services/server/<name>(route が呼ぶ)
export {};
