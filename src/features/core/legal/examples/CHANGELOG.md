# 法務の文書の例文の変更履歴

`examples/<kind>.ts` を変えたら 1 行足す(新しい物が上)。fork は自分の上書き `src/config/features/legal.config.ts` の own の文面に取り入れるかを決める(例文を直接は編集しない)。上流の出荷は notice で案内する。

- 2026-11-09: 作成。今までの `src/config/documents/{terms,privacy,tradelaw}.config.ts` の文面を写した(日付は持たない。特商法の表示の許認可の節は id "licenses" の空の節にし、中身は legal の licenses の欄から埋める)
