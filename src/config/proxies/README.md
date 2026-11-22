# src/config/proxies — proxies の上書き

## Overview

`src/proxies`(URL の入口の判断)の値は、テーマのフォルダ `src/proxies/<テーマ>/config.ts` ごとに持ち主になり、上書きはこのフォルダに `<テーマ>.config.ts` を 1 本ずつ置く。fork がテーマを足すときの形がこれ。

- 上流は値を持つテーマを持たない(デモモードの値は demo ドメインの設定 `../domains/demo.config.ts`、ページの公開とデモの入切は門番の規則、メンテナンスは setting)
- 転送の規則は config でなく受け口 `src/proxies/redirects/<名前>.ts`(fork が独立した行を足す一覧)
- ドメインのあるページの公開はそのドメインの上書き(`../domains/<名前>.config.ts`)に書く

## Related

- 置き方・中身の決まり・1 対 1 の検査: [../README.md](../README.md)
- 転送の受け口: [../../proxies/redirects/README.md](../../proxies/redirects/README.md)
