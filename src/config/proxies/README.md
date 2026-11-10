# src/config/proxies — proxies の上書き

`src/proxies`(URL の入口の判断)の値は、テーマのフォルダ `src/proxies/<テーマ>/config.ts` ごとに持ち主になり、上書きは `<テーマ>.config.ts` を 1 本ずつ置く(設定 D93)。上流は値を持つテーマを持たない(設定 D113。デモモードの値は demo ドメインの設定 `../features/demo.config.ts`、ページの公開とデモの入切は門番の規則、メンテナンスは setting)。fork がテーマを足すときの形がこれ。

- 転送の規則は config でなく受け口 `src/proxies/redirects/<名前>.ts`(fork が独立した行を足す一覧、[../../proxies/redirects/README.md](../../proxies/redirects/README.md))
- ドメインのあるページの公開はそのドメインの上書き(`../features/<名前>.config.ts`)に書く
- 置き方・中身の決まり・1 対 1 の検査: [../README.md](../README.md)
